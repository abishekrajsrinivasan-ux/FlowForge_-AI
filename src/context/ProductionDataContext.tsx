import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  Dataset,
  ProductionRecord,
  ActionRecord,
  ScenarioRecord,
  ImprovementTrackingRecord,
  RecommendationRecord,
} from '../types/database';
import {
  GlobalFilters,
  OeeCalculationResult,
  MachineBottleneckScore,
  PredictiveBottleneckResult,
  TargetRiskForecast,
  ProductionRiskRadarResult,
} from '../types/analytics';
import { calculateOee } from '../engine/oeeEngine';
import { calculateLosses, LossBreakdownResult } from '../engine/lossEngine';
import { calculateBottlenecks } from '../engine/bottleneckEngine';
import { analyzeRootCauses, RootCauseFactor } from '../engine/rootCauseEngine';
import { calculateTargetRisk } from '../engine/targetRiskEngine';
import { calculateProductionRiskRadar } from '../engine/riskRadarEngine';
import { generateRecommendations } from '../engine/recommendationEngine';
import { getSupabase, onSupabaseConfigChanged } from '../lib/supabase';
import { useAuth } from './AuthContext';
import {
  saveRecordsToIndexedDB,
  getRecordsFromIndexedDB,
  deleteRecordsFromIndexedDB,
} from '../lib/indexedDbStorage';

// High-speed in-memory cache for all loaded/uploaded datasets (starts empty - real user data only)
const datasetRecordsCache = new Map<string, ProductionRecord[]>();

interface ProductionDataContextType {
  datasets: Dataset[];
  activeDataset: Dataset | null;
  activeDatasetId: string | null;
  setActiveDatasetId: (id: string | null) => void;
  productionRecords: ProductionRecord[];
  filteredRecords: ProductionRecord[];
  filters: GlobalFilters;
  setFilters: (filters: Partial<GlobalFilters>) => void;
  resetFilters: () => void;
  oee: OeeCalculationResult;
  losses: LossBreakdownResult;
  bottlenecks: MachineBottleneckScore[];
  currentBottleneck: MachineBottleneckScore | null;
  predictiveBottlenecks: PredictiveBottleneckResult[];
  rootCauses: RootCauseFactor[];
  targetRisk: TargetRiskForecast;
  riskRadar: ProductionRiskRadarResult;
  recommendations: RecommendationRecord[];
  actions: ActionRecord[];
  scenarios: ScenarioRecord[];
  improvementTracking: ImprovementTrackingRecord[];
  loading: boolean;
  isAnalyzing: boolean;
  setIsAnalyzing: (analyzing: boolean) => void;
  loadingDatasetName: string | null;
  setLoadingDatasetName: (name: string | null) => void;
  saveNewDataset: (dataset: Dataset, records: ProductionRecord[], columns: unknown[]) => Promise<void>;
  deleteDataset: (id: string) => Promise<void>;
  updateActionStatus: (actionId: string, status: ActionRecord['status']) => Promise<void>;
  addAction: (action: Omit<ActionRecord, 'id' | 'created_at'>) => Promise<void>;
  saveScenario: (scenario: Omit<ScenarioRecord, 'id' | 'created_at'>) => Promise<void>;
  addImprovementTracking: (record: Omit<ImprovementTrackingRecord, 'id' | 'recorded_at'>) => Promise<void>;
  refreshData: () => Promise<void>;
}

const DEFAULT_FILTERS: GlobalFilters = {
  datasetId: null,
  dateRange: { start: null, end: null },
  machineId: 'ALL',
  lineId: 'ALL',
  shift: 'ALL',
  productId: 'ALL',
};

const ProductionDataContext = createContext<ProductionDataContextType | undefined>(undefined);

export const ProductionDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);
  const [productionRecords, setProductionRecords] = useState<ProductionRecord[]>([]);
  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioRecord[]>([]);
  const [improvementTracking, setImprovementTracking] = useState<ImprovementTrackingRecord[]>([]);
  const [filters, setFiltersState] = useState<GlobalFilters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingDatasetName, setLoadingDatasetName] = useState<string | null>(null);

  // Use ref to access activeDatasetId inside loadDatasets without making it a dependency
  const activeDatasetIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeDatasetIdRef.current = activeDatasetId;
  }, [activeDatasetId]);

  // Initialize and load datasets from Supabase or localStorage
  const loadDatasets = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabase();
    const currentActiveId = activeDatasetIdRef.current;

    // 1. Try loading from Supabase
    if (supabase) {
      try {
        const { data: dbDatasets, error } = await supabase
          .from('datasets')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && dbDatasets) {
          setDatasets(dbDatasets as Dataset[]);
          if (dbDatasets.length > 0 && !currentActiveId) {
            setActiveDatasetId(dbDatasets[0].id);
          }
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn('Supabase fetch failed, checking local store:', err);
      }
    }

    // 2. Fallback to localStorage — filter out any previously auto-seeded dummy datasets
    const saved = localStorage.getItem('ff_datasets');
    if (saved) {
      try {
        const parsed: Dataset[] = JSON.parse(saved);
        // Remove the old default seed so only user-uploaded data is shown
        const userUploaded = parsed.filter((d) => d.id !== 'ds_automotive_seed_01');
        if (userUploaded.length > 0) {
          // Persist the cleaned list back
          localStorage.setItem('ff_datasets', JSON.stringify(userUploaded));
          setDatasets(userUploaded);
          if (!currentActiveId) {
            setActiveDatasetId(userUploaded[0].id);
          }
          setLoading(false);
          return;
        }
      } catch (e) {
        console.error('Failed to parse local datasets:', e);
      }
    }

    // No datasets found anywhere — start with empty state; user must upload their own data
    setDatasets([]);
    setActiveDatasetId(null);
    setProductionRecords([]);
    setLoading(false);
  }, []); // No dependencies - uses ref for activeDatasetId

  useEffect(() => {
    loadDatasets();
    return onSupabaseConfigChanged(() => {
      void loadDatasets();
    });
  }, [loadDatasets]);

  // Load records and artifacts when active dataset changes
  useEffect(() => {
    if (!activeDatasetId) {
      setProductionRecords([]);
      setActions([]);
      setScenarios([]);
      setImprovementTracking([]);
      return;
    }

    const loadRecords = async () => {
      setLoading(true);

      // 1. In-memory cache lookup (instant & 100% reliable)
      if (datasetRecordsCache.has(activeDatasetId)) {
        const cached = datasetRecordsCache.get(activeDatasetId)!;
        setProductionRecords(cached);
        setLoading(false);
        return;
      }

      // 2. IndexedDB lookup (exceeds browser localStorage quota limits)
      try {
        const idbRecords = await getRecordsFromIndexedDB<ProductionRecord>(activeDatasetId);
        if (idbRecords && idbRecords.length > 0) {
          datasetRecordsCache.set(activeDatasetId, idbRecords);
          setProductionRecords(idbRecords);
          setLoading(false);
          return;
        }
      } catch (idbErr) {
        console.warn('IDB lookup warning:', idbErr);
      }

      // 3. LocalStorage check
      try {
        const localRecs = localStorage.getItem(`ff_records_${activeDatasetId}`);
        if (localRecs) {
          const parsed = JSON.parse(localRecs);
          if (Array.isArray(parsed) && parsed.length > 0) {
            datasetRecordsCache.set(activeDatasetId, parsed);
            setProductionRecords(parsed);
            setLoading(false);
            return;
          }
        }
      } catch (lsErr) {
        console.warn('LocalStorage lookup warning:', lsErr);
      }

      // 4. Supabase database check
      const supabase = getSupabase();
      if (supabase) {
        try {
          const { data: records, error } = await supabase
            .from('production_records')
            .select('*')
            .eq('dataset_id', activeDatasetId);

          if (!error && records && records.length > 0) {
            datasetRecordsCache.set(activeDatasetId, records as ProductionRecord[]);
            setProductionRecords(records as ProductionRecord[]);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.warn('Error loading dataset records from Supabase:', err);
        }
      }

      // 5. If no records exist for this specific dataset, clear state — NEVER keep another dataset's records!
      setProductionRecords([]);
      setLoading(false);
    };

    loadRecords();
  }, [activeDatasetId]);

  const activeDataset = useMemo(() => {
    return datasets.find((d) => d.id === activeDatasetId) ?? null;
  }, [datasets, activeDatasetId]);

  const setFilters = (newFilters: Partial<GlobalFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
  };

  const resetFilters = () => {
    setFiltersState(DEFAULT_FILTERS);
  };

  // Filter records dynamically based on active filters and Operator machine/line scoping
  const filteredRecords = useMemo(() => {
    if (!productionRecords.length) return [];

    return productionRecords.filter((record) => {
      // Role-based machine/line scoping for Operator
      if (user?.role === 'Operator') {
        if (user.assignedMachine && record.machine_id !== user.assignedMachine) {
          return false;
        }
        if (user.assignedLine && record.line_id !== user.assignedLine) {
          return false;
        }
      } else {
        if (filters.machineId !== 'ALL' && record.machine_id !== filters.machineId) {
          return false;
        }
        if (filters.lineId !== 'ALL' && record.line_id !== filters.lineId) {
          return false;
        }
      }
      if (filters.shift !== 'ALL' && record.shift !== filters.shift) {
        return false;
      }
      if (filters.productId !== 'ALL' && record.product_id !== filters.productId) {
        return false;
      }
      if (filters.dateRange.start && (record.date || record.timestamp)) {
        const recordDate = new Date(record.date || record.timestamp!).getTime();
        const start = new Date(filters.dateRange.start).getTime();
        if (recordDate < start) return false;
      }
      if (filters.dateRange.end && (record.date || record.timestamp)) {
        const recordDate = new Date(record.date || record.timestamp!).getTime();
        const end = new Date(filters.dateRange.end).getTime();
        if (recordDate > end) return false;
      }
      return true;
    });
  }, [productionRecords, filters, user]);

  // Derived Calculations
  const oee = useMemo(() => calculateOee(filteredRecords), [filteredRecords]);
  const losses = useMemo(() => calculateLosses(filteredRecords), [filteredRecords]);
  const bottleneckResult = useMemo(() => calculateBottlenecks(filteredRecords), [filteredRecords]);
  const rootCauses = useMemo(() => analyzeRootCauses(filteredRecords), [filteredRecords]);
  const targetRisk = useMemo(() => calculateTargetRisk(filteredRecords), [filteredRecords]);
  const riskRadar = useMemo(() => calculateProductionRiskRadar(filteredRecords), [filteredRecords]);

  const recommendations = useMemo(() => {
    if (!activeDatasetId) return [];
    return generateRecommendations(activeDatasetId, filteredRecords, bottleneckResult.scores, losses);
  }, [activeDatasetId, filteredRecords, bottleneckResult.scores, losses]);

  // Save new uploaded dataset
  const saveNewDataset = async (dataset: Dataset, records: ProductionRecord[], columns: unknown[]) => {
    if (user && user.role !== 'Admin') {
      throw new Error('Access Denied: Only Admin users can upload new datasets.');
    }
    const supabase = getSupabase();

    // 1. Immediately store into high-speed memory cache so calculation engines evaluate authentic data in 0ms
    datasetRecordsCache.set(dataset.id, records);

    // 2. Persist to IndexedDB (handles hundreds of thousands of records without localStorage quota crashes)
    await saveRecordsToIndexedDB(dataset.id, records);

    // 3. Immediately update in-memory state so UI updates instantly with authentic data
    const updatedDatasets = [dataset, ...datasets.filter((d) => d.id !== dataset.id)];
    setDatasets(updatedDatasets);
    setActiveDatasetId(dataset.id);
    setProductionRecords(records);
    resetFilters();

    // 4. Safe localStorage metadata sync
    try {
      localStorage.setItem('ff_datasets', JSON.stringify(updatedDatasets));
      localStorage.setItem(`ff_records_${dataset.id}`, JSON.stringify(records));
    } catch (storageErr) {
      console.warn('Local storage write notice (dataset held safely in memory & IndexedDB):', storageErr);
    }

    // 5. Background sync to Supabase (non-blocking)
    if (supabase) {
      (async () => {
        try {
          const datasetPayload = {
            ...dataset,
            user_id: user?.id ?? null,
          };

          const { error: dsError } = await supabase.from('datasets').insert(datasetPayload);
          if (dsError) throw dsError;

          if (columns && columns.length > 0) {
            const { error: columnsError } = await supabase
              .from('dataset_columns')
              .insert(columns);
            if (columnsError) throw columnsError;
          }

          const chunkSize = 500;
          const recordBatches = [];
          for (let i = 0; i < records.length; i += chunkSize) {
            recordBatches.push(records.slice(i, i + chunkSize));
          }

          const batchResults = await Promise.all(
            recordBatches.map((batch) => supabase.from('production_records').insert(batch))
          );
          const recordsError = batchResults.find((result) => result.error)?.error;
          if (recordsError) throw recordsError;
        } catch (err) {
          console.warn('Background sync to Supabase failed (local data remains active):', err);
        }
      })();
    }
  };

  const deleteDataset = async (id: string) => {
    if (user && user.role !== 'Admin') {
      throw new Error('Access Denied: Only Admin users can delete datasets.');
    }
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('datasets').delete().eq('id', id);
      } catch (err) {
        console.warn('Error deleting dataset from Supabase:', err);
      }
    }

    datasetRecordsCache.delete(id);
    await deleteRecordsFromIndexedDB(id);

    const updated = datasets.filter((d) => d.id !== id);
    setDatasets(updated);
    try {
      localStorage.setItem('ff_datasets', JSON.stringify(updated));
    } catch {}
    localStorage.removeItem(`ff_records_${id}`);
    localStorage.removeItem(`ff_actions_${id}`);
    localStorage.removeItem(`ff_scenarios_${id}`);
    localStorage.removeItem(`ff_imp_${id}`);

    if (activeDatasetId === id) {
      setActiveDatasetId(updated.length > 0 ? updated[0].id : null);
    }
  };

  const updateActionStatus = async (actionId: string, status: ActionRecord['status']) => {
    const completed_at = status === 'COMPLETED' ? new Date().toISOString() : null;
    const updated = actions.map((a) => (a.id === actionId ? { ...a, status, completed_at } : a));
    setActions(updated);

    if (activeDatasetId) {
      localStorage.setItem(`ff_actions_${activeDatasetId}`, JSON.stringify(updated));
    }

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('actions').update({ status, completed_at }).eq('id', actionId);
      } catch (err) {
        console.warn('Failed to update action status in Supabase:', err);
      }
    }
  };

  const addAction = async (action: Omit<ActionRecord, 'id' | 'created_at'>) => {
    const newAction: ActionRecord = {
      ...action,
      id: crypto.randomUUID ? crypto.randomUUID() : `act_${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    const updated = [newAction, ...actions];
    setActions(updated);

    if (activeDatasetId) {
      localStorage.setItem(`ff_actions_${activeDatasetId}`, JSON.stringify(updated));
    }

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('actions').insert(newAction);
      } catch (err) {
        console.warn('Failed to insert action into Supabase:', err);
      }
    }
  };

  const saveScenario = async (scenario: Omit<ScenarioRecord, 'id' | 'created_at'>) => {
    const newScenario: ScenarioRecord = {
      ...scenario,
      id: crypto.randomUUID ? crypto.randomUUID() : `scen_${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    const updated = [newScenario, ...scenarios];
    setScenarios(updated);

    if (activeDatasetId) {
      localStorage.setItem(`ff_scenarios_${activeDatasetId}`, JSON.stringify(updated));
    }

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('scenarios').insert(newScenario);
      } catch (err) {
        console.warn('Failed to insert scenario into Supabase:', err);
      }
    }
  };

  const addImprovementTracking = async (
    record: Omit<ImprovementTrackingRecord, 'id' | 'recorded_at'>
  ) => {
    const newRecord: ImprovementTrackingRecord = {
      ...record,
      id: crypto.randomUUID ? crypto.randomUUID() : `imp_${Date.now()}`,
      recorded_at: new Date().toISOString(),
    };
    const updated = [newRecord, ...improvementTracking];
    setImprovementTracking(updated);

    if (activeDatasetId) {
      localStorage.setItem(`ff_imp_${activeDatasetId}`, JSON.stringify(updated));
    }

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('improvement_tracking').insert(newRecord);
      } catch (err) {
        console.warn('Failed to insert improvement tracking into Supabase:', err);
      }
    }
  };

  return (
    <ProductionDataContext.Provider
      value={{
        datasets,
        activeDataset,
        activeDatasetId,
        setActiveDatasetId,
        productionRecords,
        filteredRecords,
        filters,
        setFilters,
        resetFilters,
        oee,
        losses,
        bottlenecks: bottleneckResult.scores,
        currentBottleneck: bottleneckResult.currentBottleneck,
        predictiveBottlenecks: bottleneckResult.predictiveBottlenecks,
        rootCauses,
        targetRisk,
        riskRadar,
        recommendations,
        actions,
        scenarios,
        improvementTracking,
        loading,
        isAnalyzing,
        setIsAnalyzing,
        loadingDatasetName,
        setLoadingDatasetName,
        saveNewDataset,
        deleteDataset,
        updateActionStatus,
        addAction,
        saveScenario,
        addImprovementTracking,
        refreshData: loadDatasets,
      }}
    >
      {children}
    </ProductionDataContext.Provider>
  );
};

export const useProductionData = () => {
  const context = useContext(ProductionDataContext);
  if (!context) {
    throw new Error('useProductionData must be used within a ProductionDataProvider');
  }
  return context;
};
