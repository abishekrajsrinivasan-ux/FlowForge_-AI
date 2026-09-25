import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import {
  Database,
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Trash2,
  Download,
  ArrowRight,
  RefreshCw,
  Sparkles,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { useProductionData } from '../context/ProductionDataContext';
import { useAuth } from '../context/AuthContext';
import { detectColumns } from '../engine/columnDetector';
import { validateDataset } from '../engine/validator';
import { uploadDatasetFile } from '../lib/supabase';
import { ColumnMappingItem, ValidationSummary } from '../types/analytics';
import { Dataset, ProductionRecord, SemanticType } from '../types/database';

export const DataManagement: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const {
    datasets,
    activeDatasetId,
    setActiveDatasetId,
    saveNewDataset,
    deleteDataset,
    refreshData,
    setIsAnalyzing,
    setLoadingDatasetName,
  } = useProductionData();

  // Wizard state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [step, setStep] = useState<
    'select' | 'mapping' | 'validation' | 'processing' | 'done'
  >('select');
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [mappings, setMappings] = useState<ColumnMappingItem[]>([]);
  const [validationResult, setValidationResult] = useState<{
    summary: ValidationSummary;
    validRecords: ProductionRecord[];
    invalidRecords: ProductionRecord[];
  } | null>(null);
  const [datasetName, setDatasetName] = useState('');
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStepText, setProcessingStepText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Open upload wizard
  const startUpload = () => {
    setCurrentFile(null);
    setRawHeaders([]);
    setRawRows([]);
    setMappings([]);
    setValidationResult(null);
    setDatasetName('');
    setErrorMsg(null);
    setStep('select');
    setIsModalOpen(true);
  };

  // Handle local CSV selection
  const handleFileSelected = (file: File) => {
    setCurrentFile(file);
    setDatasetName(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' '));
    parseFile(file);
  };

  // Quick-load bundled sample CSV
  const handleLoadSample = async (samplePath: string, name: string) => {
    try {
      const response = await fetch(samplePath);
      const csvText = await response.text();
      const file = new File([csvText], samplePath.split('/').pop() || 'sample.csv', {
        type: 'text/csv',
      });
      setCurrentFile(file);
      setDatasetName(name);
      parseFile(file);
    } catch (err) {
      setErrorMsg('Failed to load sample dataset from disk: ' + String(err));
    }
  };

  // Parse CSV — use PapaParse worker for large files to avoid blocking UI
  const parseFile = (file: File) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      worker: false, // In-thread direct parsing is significantly faster without web worker serialization
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          setErrorMsg('The selected CSV file contains no data rows.');
          return;
        }

        const headers = results.meta.fields || [];
        if (headers.length === 0) {
          setErrorMsg('Unable to parse CSV headers.');
          return;
        }

        setRawHeaders(headers);
        setRawRows(results.data);

        // Detect columns (lightweight, fine on main thread)
        const detected = detectColumns(headers, results.data);
        setMappings(detected);
        setStep('mapping');
      },
      error: (err) => {
        setErrorMsg('Error parsing CSV: ' + err.message);
      },
    });
  };

  // User alters a column mapping
  const handleMappingChange = (origName: string, newField: SemanticType) => {
    setMappings((prev) =>
      prev.map((m) => (m.originalName === origName ? { ...m, mappedField: newField } : m))
    );
  };

  // Proceed from mapping to validation
  // Use setTimeout(0) to let the UI render the step change before heavy computation
  const runValidation = () => {
    setStep('validation'); // show loading state immediately

    setTimeout(() => {
      const mappedTypes = mappings.map((m) => m.mappedField);

      // Map raw rows to normalized ProductionRecord objects
      const records: ProductionRecord[] = rawRows.map((raw) => {
        const rec: any = {
          machine_id: 'UNKNOWN',
          dataset_id: '',
        };

        for (const m of mappings) {
          if (m.mappedField === 'ignore') continue;
          const val = raw[m.originalName];
          if (val === null || val === undefined || String(val).trim() === '') continue;

          switch (m.mappedField) {
            case 'machine': rec.machine_id = String(val).trim(); break;
            case 'timestamp': rec.timestamp = String(val).trim(); break;
            case 'date': rec.date = String(val).trim(); break;
            case 'line': rec.line_id = String(val).trim(); break;
            case 'shift': rec.shift = String(val).trim(); break;
            case 'product': rec.product_id = String(val).trim(); break;
            case 'target_quantity': rec.target_quantity = Number(val); break;
            case 'actual_quantity': rec.actual_quantity = Number(val); break;
            case 'planned_time': rec.planned_time = Number(val); break;
            case 'operating_time': rec.operating_time = Number(val); break;
            case 'downtime': rec.downtime = Number(val); break;
            case 'planned_downtime': rec.planned_downtime = Number(val); break;
            case 'unplanned_downtime': rec.unplanned_downtime = Number(val); break;
            case 'changeover_time': rec.changeover_time = Number(val); break;
            case 'idle_time': rec.idle_time = Number(val); break;
            case 'ideal_cycle_time': rec.ideal_cycle_time = Number(val); break;
            case 'actual_cycle_time': rec.actual_cycle_time = Number(val); break;
            case 'total_units': rec.total_units = Number(val); break;
            case 'good_units': rec.good_units = Number(val); break;
            case 'defective_units': rec.defective_units = Number(val); break;
            case 'rework': rec.rework = Number(val); break;
            case 'downtime_reason': rec.downtime_reason = String(val).trim(); break;
          }
        }

        return rec as ProductionRecord;
      });

      const result = validateDataset(records, mappedTypes);
      setValidationResult(result);
    }, 0);
  };

  // Commit valid records — fast path: localStorage first, Supabase in background
  const commitDataset = async () => {
    if (!validationResult || !currentFile) return;

    setStep('processing');
    setProcessingProgress(20);
    setProcessingStepText('Normalizing records...');

    const datasetId = crypto.randomUUID ? crypto.randomUUID() : `ds_${Date.now()}`;

    const newDataset: Dataset = {
      id: datasetId,
      name: datasetName.trim() || currentFile.name,
      original_filename: currentFile.name,
      file_type: currentFile.name.split('.').pop() || 'csv',
      file_size: currentFile.size,
      row_count: validationResult.validRecords.length,
      upload_status: 'completed',
      processing_status: 'completed',
      validation_status:
        validationResult.summary.errors.length > 0 ? 'warnings' : 'valid',
      data_quality_score: validationResult.summary.dataQualityScore,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Link records to datasetId
    const recordsWithId = validationResult.validRecords.map((r) => ({
      ...r,
      dataset_id: datasetId,
    }));

    const columnRecords = mappings.map((m) => ({
      dataset_id: datasetId,
      original_name: m.originalName,
      normalized_name: m.originalName.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      detected_type: m.detectedType,
      semantic_type: m.mappedField,
      nullable: true,
      sample_values: m.sampleValues,
    }));

    setProcessingProgress(50);
    setProcessingStepText('Applying dataset to dashboard...');

    // Apply to context immediately (triggers recalculation & stores in memory + IndexedDB)
    await saveNewDataset(newDataset, recordsWithId, columnRecords);

    // Trigger dedicated telemetry analyzing loading screen
    setIsAnalyzing(true);
    setLoadingDatasetName(newDataset.name);

    setProcessingProgress(100);
    setProcessingStepText('Ready! Redirecting...');

    // Close modal and navigate immediately
    setIsModalOpen(false);
    navigate('/');

    // ── BACKGROUND: fire Supabase Storage upload non-blocking (don't await)
    if (currentFile) {
      uploadDatasetFile(currentFile, datasetId, user?.id).catch(() => {
        // silent — Storage upload is optional, data is already in Postgres/local
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            Dataset Management & Storage
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Ingest, normalize, validate, and store real production data into Supabase PostgreSQL.
          </p>
        </div>

        <button
          onClick={startUpload}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-all shadow-sm shadow-blue-500/20"
        >
          <Upload className="w-4 h-4" />
          Upload Production Dataset
        </button>
      </div>

      {/* DATASETS LIST TABLE */}
      <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-sm font-bold text-slate-800">
            Registered Datasets ({datasets.length})
          </h3>
          <button
            onClick={refreshData}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {datasets.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-300 rounded-lg bg-slate-50/60">
            <FileText className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-700 font-semibold text-sm mb-1">No datasets registered</p>
            <p className="text-slate-500 text-xs mb-4">
              Upload a manufacturing CSV or load a sample production fixture to begin.
            </p>
            <button
              onClick={startUpload}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-all shadow-sm"
            >
              Upload First Dataset
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Dataset Name</th>
                  <th className="py-3 px-3">Original File</th>
                  <th className="py-3 px-3">Rows</th>
                  <th className="py-3 px-3">Data Quality</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Uploaded</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {datasets.map((d) => {
                  const isActive = d.id === activeDatasetId;
                  return (
                    <tr
                      key={d.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        isActive ? 'bg-blue-50/60' : ''
                      }`}
                    >
                      <td className="py-3 px-3 font-semibold text-slate-800 flex items-center gap-2">
                        {d.name}
                        {isActive && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-blue-600 text-white font-bold tracking-wider">
                            ACTIVE
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-500">{d.original_filename}</td>
                      <td className="py-3 px-3 text-slate-800 font-bold">{d.row_count.toLocaleString()}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold ${
                            d.data_quality_score >= 90
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {d.data_quality_score}%
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-emerald-600 flex items-center gap-1 font-semibold">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                          Ready
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {new Date(d.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!isActive && (
                            <button
                              onClick={() => {
                                setIsAnalyzing(true);
                                setLoadingDatasetName(d.name);
                                setActiveDatasetId(d.id);
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-blue-700 border border-slate-200 rounded font-medium text-[11px] transition-all"
                            >
                              Set Active
                            </button>
                          )}
                          <button
                            onClick={() => deleteDataset(d.id)}
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-all"
                            title="Delete dataset"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MULTI-STEP UPLOAD & MAPPING WIZARD MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-2xl w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto font-sans">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  {step === 'select' && 'Step 1: Select Production Dataset'}
                  {step === 'mapping' && 'Step 2: Review Column Mapping'}
                  {step === 'validation' && 'Step 3: Validation & Quality Report'}
                  {step === 'processing' && 'Step 4: Ingesting & Running Calculations'}
                </h3>
                <p className="text-xs text-slate-400">
                  FLOWFORGE AI multi-dataset compatibility engine
                </p>
              </div>

              {step !== 'processing' && (
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-200 text-sm"
                >
                  ✕
                </button>
              )}
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* STEP 1: FILE SELECTION */}
            {step === 'select' && (
              <div className="space-y-4">
                {/* Drag and Drop Box */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-cyan-500 rounded-xl p-8 text-center cursor-pointer transition-all bg-slate-950/40 hover:bg-slate-950/80"
                >
                  <Upload className="w-10 h-10 text-cyan-400 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-200">
                    Click to select or drag a CSV file here
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Accepts comma-separated production records (.csv)
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileSelected(e.target.files[0]);
                      }
                    }}
                  />
                </div>

                {/* Instant Try with Sample Button */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    Instant Testing with Realistic Industrial Datasets
                  </span>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={() =>
                        handleLoadSample(
                          '/sample-data/automotive_assembly.csv',
                          'Automotive Body Shop & Assembly'
                        )
                      }
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-all"
                    >
                      Automotive Assembly Line (6 machines, 2 shifts)
                    </button>
                    <button
                      onClick={() =>
                        handleLoadSample(
                          '/sample-data/packaging_line.csv',
                          'Beverage High-Speed Packaging'
                        )
                      }
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-all"
                    >
                      Packaging Line (Alternative column names)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: COLUMN MAPPING */}
            {step === 'mapping' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-400 block mb-1">
                    Dataset Identifier
                  </label>
                  <input
                    type="text"
                    value={datasetName}
                    onChange={(e) => setDatasetName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="border border-slate-800 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">CSV Column</th>
                        <th className="py-2.5 px-3">Sample Values</th>
                        <th className="py-2.5 px-3">FLOWFORGE AI Field Mapping</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {mappings.map((m) => (
                        <tr key={m.originalName} className="hover:bg-slate-800/30">
                          <td className="py-2 px-3 font-semibold text-slate-200">
                            {m.originalName}
                          </td>
                          <td className="py-2 px-3 text-slate-400 text-[11px] truncate max-w-[150px]">
                            {m.sampleValues.join(', ')}
                          </td>
                          <td className="py-2 px-3">
                            <select
                              aria-label={`Mapping for ${m.originalName}`}
                              value={m.mappedField}
                              onChange={(e) =>
                                handleMappingChange(m.originalName, e.target.value as SemanticType)
                              }
                              className="bg-slate-950 border border-slate-700 text-cyan-300 text-xs rounded px-2 py-1 focus:outline-none focus:border-cyan-500 w-full"
                            >
                              <option value="ignore">— Ignore Column —</option>
                              <option value="machine">Machine ID (Required)</option>
                              <option value="line">Line ID</option>
                              <option value="shift">Shift</option>
                              <option value="timestamp">Timestamp</option>
                              <option value="date">Date</option>
                              <option value="product">Product / SKU</option>
                              <option value="target_quantity">Target Quantity</option>
                              <option value="actual_quantity">Actual Quantity</option>
                              <option value="planned_time">Planned Time (min)</option>
                              <option value="operating_time">Operating Time (min)</option>
                              <option value="downtime">Total Downtime (min)</option>
                              <option value="unplanned_downtime">Unplanned Downtime (min)</option>
                              <option value="changeover_time">Changeover Time (min)</option>
                              <option value="idle_time">Idle / Starvation (min)</option>
                              <option value="ideal_cycle_time">Ideal Cycle Time (sec)</option>
                              <option value="actual_cycle_time">Actual Cycle Time (sec)</option>
                              <option value="total_units">Total Units</option>
                              <option value="good_units">Good Units</option>
                              <option value="defective_units">Defective Units</option>
                              <option value="rework">Rework Units</option>
                              <option value="downtime_reason">Downtime Reason</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    onClick={() => setStep('select')}
                    className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-700"
                  >
                    Back
                  </button>
                  <button
                    onClick={runValidation}
                    className="px-4 py-2 bg-cyan-600 text-slate-950 font-bold rounded-lg text-xs hover:bg-cyan-500 shadow-md"
                  >
                    Run Data Validation
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: VALIDATION SUMMARY */}
            {step === 'validation' && validationResult && (
              <div className="space-y-4 font-mono text-xs">
                {/* Score Banner */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                      Data Quality Score
                    </span>
                    <span className="text-3xl font-bold text-cyan-400">
                      {validationResult.summary.dataQualityScore}%
                    </span>
                  </div>

                  <div className="text-right text-slate-400 space-y-0.5">
                    <div>
                      Valid Rows:{' '}
                      <strong className="text-emerald-400">
                        {validationResult.summary.validRows}
                      </strong>
                    </div>
                    <div>
                      Invalid Rows:{' '}
                      <strong className="text-rose-400">
                        {validationResult.summary.invalidRows}
                      </strong>
                    </div>
                    <div>
                      Duplicate Signatures:{' '}
                      <strong className="text-amber-400">
                        {validationResult.summary.duplicateRows}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Capabilities Breakdown */}
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5 font-sans">
                  <span className="text-xs font-bold text-slate-200 block">
                    Calculable Analytical Capabilities:
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      {validationResult.summary.calculatedCapabilities.canCalculateAvailability ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                      )}
                      <span>Availability Analysis</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {validationResult.summary.calculatedCapabilities.canCalculatePerformance ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                      )}
                      <span>Performance & Cycle Deviation</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {validationResult.summary.calculatedCapabilities.canCalculateQuality ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                      )}
                      <span>Quality & Scrap Yield</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {validationResult.summary.calculatedCapabilities.canCalculateBottleneck ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                      )}
                      <span>Bottleneck Composite Scoring</span>
                    </div>
                  </div>

                  {validationResult.summary.calculatedCapabilities.notes.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-800/80 text-[11px] text-amber-300">
                      {validationResult.summary.calculatedCapabilities.notes.map((n, i) => (
                        <div key={i}>• {n}</div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800 font-sans">
                  <button
                    onClick={() => setStep('mapping')}
                    className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-700"
                  >
                    Adjust Mapping
                  </button>
                  <button
                    onClick={commitDataset}
                    disabled={validationResult.summary.validRows === 0}
                    className="px-4 py-2 bg-cyan-600 disabled:opacity-50 text-slate-950 font-bold rounded-lg text-xs hover:bg-cyan-500 shadow-md"
                  >
                    Accept & Ingest ({validationResult.summary.validRows} rows)
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: PROCESSING PROGRESS */}
            {step === 'processing' && (
              <div className="py-8 text-center space-y-4">
                <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
                <div>
                  <h4 className="text-sm font-bold text-slate-100">{processingStepText}</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Storing records in Supabase and running OEE and Bottleneck matrices...
                  </p>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden max-w-sm mx-auto">
                  <div
                    className="bg-cyan-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${processingProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
