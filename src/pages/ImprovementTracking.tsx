import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  Plus,
  CheckCircle,
  Clock,
  Layers,
  ArrowUpRight,
  Info,
  CheckSquare,
  Activity,
  ArrowRight,
  Check,
} from 'lucide-react';
import { useProductionData } from '../context/ProductionDataContext';
import { EmptyState } from '../components/common/EmptyState';
import { calculateOee } from '../engine/oeeEngine';

export const ImprovementTracking: React.FC = () => {
  const {
    activeDataset,
    filteredRecords,
    improvementTracking,
    addImprovementTracking,
    oee,
    actions,
    updateActionStatus,
  } = useProductionData();

  // Unique machines from ALL records of the active dataset (not just filtered)
  const uniqueMachines = useMemo(() => {
    const set = new Set<string>();
    filteredRecords.forEach((r) => r.machine_id && set.add(r.machine_id));
    return Array.from(set).sort();
  }, [filteredRecords]);

  const [showModal, setShowModal] = useState(false);
  const [machineId, setMachineId] = useState('');
  const [intervention, setIntervention] = useState('');

  // Dynamically derive baseline values from the selected machine's records
  const machineOee = useMemo(() => {
    if (!machineId) return oee;
    const mRecs = filteredRecords.filter((r) => r.machine_id === machineId);
    return mRecs.length > 0 ? calculateOee(mRecs) : oee;
  }, [machineId, filteredRecords, oee]);

  const [beforeOee, setBeforeOee] = useState<number>(0);
  const [afterOee, setAfterOee] = useState<number>(0);
  const [beforeDt, setBeforeDt] = useState<number>(0);
  const [afterDt, setAfterDt] = useState<number>(0);
  const [beforeOut, setBeforeOut] = useState<number>(0);
  const [afterOut, setAfterOut] = useState<number>(0);

  // When machineId changes, pre-fill baseline values from real data
  useEffect(() => {
    const baseOee = machineOee.oee ?? 65;
    const baseDt = machineOee.totalDowntime ?? 120;
    const baseOut = machineOee.totalActualQuantity ?? 3200;
    setBeforeOee(Math.round(baseOee * 10) / 10);
    setAfterOee(Math.round(baseOee * 10) / 10);
    setBeforeDt(Math.round(baseDt));
    setAfterDt(Math.round(baseDt));
    setBeforeOut(Math.round(baseOut));
    setAfterOut(Math.round(baseOut));
  }, [machineId, machineOee]);

  const [actionStatusFilter, setActionStatusFilter] = useState<'ALL' | 'PENDING' | 'IN_PROGRESS' | 'FINISHED'>('ALL');
  const [activeActionId, setActiveActionId] = useState<string | null>(null);

  const datasetActions = useMemo(() => {
    return actions.filter((a) => !activeDataset || a.dataset_id === activeDataset.id);
  }, [actions, activeDataset]);

  const filteredAdoptedActions = useMemo(() => {
    if (actionStatusFilter === 'ALL') return datasetActions.filter((a) => a.status !== 'DISMISSED');
    if (actionStatusFilter === 'PENDING') return datasetActions.filter((a) => a.status === 'OPEN');
    if (actionStatusFilter === 'IN_PROGRESS') return datasetActions.filter((a) => a.status === 'IN_PROGRESS');
    if (actionStatusFilter === 'FINISHED') return datasetActions.filter((a) => a.status === 'COMPLETED');
    return datasetActions;
  }, [datasetActions, actionStatusFilter]);

  const pendingCount = useMemo(() => datasetActions.filter((a) => a.status === 'OPEN').length, [datasetActions]);
  const inProgressCount = useMemo(() => datasetActions.filter((a) => a.status === 'IN_PROGRESS').length, [datasetActions]);
  const finishedCount = useMemo(() => datasetActions.filter((a) => a.status === 'COMPLETED').length, [datasetActions]);

  const handleOpenAuditForAction = (action: any) => {
    setMachineId(action.machine_id || '');
    setIntervention(action.action);
    setActiveActionId(action.id);
    setShowModal(true);
  };

  const handleUpdateStatus = async (actionId: string, newStatus: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED') => {
    await updateActionStatus(actionId, newStatus);
  };

  if (!activeDataset || filteredRecords.length === 0) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-xl font-bold tracking-tight text-slate-800">
          Improvement Tracking &amp; Verification
        </h1>
        <EmptyState />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDataset || !machineId || !intervention) return;

    const oeeDiff = afterOee - beforeOee;
    await addImprovementTracking({
      dataset_id: activeDataset.id,
      machine_id: machineId,
      intervention,
      before_oee: beforeOee,
      after_oee: afterOee,
      before_downtime: beforeDt,
      after_downtime: afterDt,
      before_output: beforeOut,
      after_output: afterOut,
      observed_improvement: Math.round(oeeDiff * 10) / 10,
    });

    if (activeActionId) {
      await updateActionStatus(activeActionId, 'COMPLETED');
      setActiveActionId(null);
    }

    setShowModal(false);
    setIntervention('');
    setMachineId('');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            Improvement Tracking & Verification Audit
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Quantify empirically measured improvements before and after maintenance, SMED, or bottleneck engineering interventions.
          </p>
        </div>

        <button
          onClick={() => {
            setActiveActionId(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Log Verified Intervention
        </button>
      </div>

      {/* ADOPTED IMPROVEMENT INITIATIVES & CORRECTIVE ACTIONS BOARD */}
      <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-blue-600" />
              Adopted Corrective Initiatives Tracker ({datasetActions.length})
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Initiatives adopted from Action Center. Track execution progress and click &quot;Log Verified Audit&quot; when completed.
            </p>
          </div>

          {/* Action Status Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
            {(
              [
                { id: 'ALL', label: 'All', count: datasetActions.length },
                { id: 'PENDING', label: 'Pending', count: pendingCount },
                { id: 'IN_PROGRESS', label: 'In Progress', count: inProgressCount },
                { id: 'FINISHED', label: 'Finished', count: finishedCount },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActionStatusFilter(tab.id)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                  actionStatusFilter === tab.id
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>

        {datasetActions.length === 0 ? (
          <div className="text-center p-6 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-slate-500 text-xs space-y-2">
            <p className="font-medium text-slate-700">No corrective actions adopted yet for this dataset.</p>
            <p className="text-[11px] text-slate-500 max-w-md mx-auto">
              Visit the Continuous Improvement Action Center to adopt system recommendations or create custom tasks.
            </p>
            <Link
              to="/actions"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition-colors mt-2"
            >
              Go to Action Center
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : filteredAdoptedActions.length === 0 ? (
          <div className="text-center p-6 text-slate-400 text-xs font-sans">
            No initiatives found matching the &quot;{actionStatusFilter.toLowerCase()}&quot; filter.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAdoptedActions.map((action) => {
              const isPending = action.status === 'OPEN';
              const isInProgress = action.status === 'IN_PROGRESS';
              const isFinished = action.status === 'COMPLETED';

              return (
                <div
                  key={action.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white transition-all space-y-3 shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Machine Badge */}
                        {action.machine_id && (
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                            [{action.machine_id}]
                          </span>
                        )}

                        {/* Priority Badge */}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                            action.priority === 'CRITICAL'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : action.priority === 'HIGH'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {action.priority}
                        </span>

                        {/* Status Badge */}
                        {isPending && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" />
                            PENDING
                          </span>
                        )}
                        {isInProgress && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            <Activity className="w-3 h-3 text-blue-600 animate-spin" />
                            IN PROGRESS
                          </span>
                        )}
                        {isFinished && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            FINISHED
                          </span>
                        )}
                      </div>

                      <h4 className="text-xs sm:text-sm font-semibold text-slate-800 leading-snug">
                        {action.action}
                      </h4>

                      <div className="text-[11px] text-slate-500 font-sans flex items-center gap-3">
                        <span>Owner: <strong>{action.owner}</strong></span>
                        <span>•</span>
                        <span>Created: {new Date(action.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Right side controls */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {/* Status Selector */}
                      <select
                        aria-label="Initiative Status"
                        value={action.status === 'OPEN' ? 'OPEN' : action.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'COMPLETED'}
                        onChange={(e) =>
                          handleUpdateStatus(action.id, e.target.value as 'OPEN' | 'IN_PROGRESS' | 'COMPLETED')
                        }
                        className={`text-xs font-semibold rounded-lg px-2.5 py-1.5 border transition-all focus:outline-none ${
                          isFinished
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : isInProgress
                            ? 'bg-blue-50 text-blue-800 border-blue-300'
                            : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        <option value="OPEN">Pending</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="COMPLETED">Finished</option>
                      </select>

                      {/* Log Verified Audit button */}
                      <button
                        onClick={() => handleOpenAuditForAction(action)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs ${
                          isFinished
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
                        }`}
                        title="Log before/after intervention measurements to verify empirical OEE delta"
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                        {isFinished ? 'Audit Verified' : 'Verify & Log Audit'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* TRACKING ENTRIES */}
      <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">Historical Intervention Ledger</h3>

        {improvementTracking.length === 0 ? (
          <div className="text-center p-8 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-slate-500 text-xs">
            <p className="mb-2 font-medium">No intervention audits recorded yet for this dataset.</p>
            <p className="text-[11px] text-slate-400">
              Only verified before/after intervention measurements will be shown here. Zero synthetic data is fabricated.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {improvementTracking.map((entry) => (
              <div
                key={entry.id}
                className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3 font-mono text-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700 text-sm">[{entry.machine_id}]</span>
                    <span className="text-slate-600 font-sans text-xs">{entry.intervention}</span>
                  </div>
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <ArrowUpRight className="w-4 h-4" />
                    Net Delta: +{entry.observed_improvement}% OEE
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-2 rounded bg-white border border-slate-200">
                    <span className="text-slate-400 text-[10px] block">OEE</span>
                    <span className="text-slate-500">{entry.before_oee}%</span>
                    <span className="mx-1 text-slate-300">→</span>
                    <span className="text-emerald-600 font-bold">{entry.after_oee}%</span>
                  </div>

                  <div className="p-2 rounded bg-white border border-slate-200">
                    <span className="text-slate-400 text-[10px] block">Downtime</span>
                    <span className="text-rose-500">{entry.before_downtime}m</span>
                    <span className="mx-1 text-slate-300">→</span>
                    <span className="text-slate-600 font-bold">{entry.after_downtime}m</span>
                  </div>

                  <div className="p-2 rounded bg-white border border-slate-200">
                    <span className="text-slate-400 text-[10px] block">Output Produced</span>
                    <span className="text-slate-500">{entry.before_output.toLocaleString()}</span>
                    <span className="mx-1 text-slate-300">→</span>
                    <span className="text-blue-600 font-bold">{entry.after_output.toLocaleString()}</span>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 text-right">
                  Logged: {new Date(entry.recorded_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* LOG MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-800/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-800">Log Intervention Audit</h3>
            <form onSubmit={handleSubmit} className="space-y-3 font-sans">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Target Machine ID</label>
                  {uniqueMachines.length > 0 ? (
                    <select
                      required
                      value={machineId}
                      onChange={(e) => setMachineId(e.target.value)}
                      className="w-full bg-white border border-slate-300 text-slate-800 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                    >
                      <option value="">Select a Machine...</option>
                      {uniqueMachines.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      value={machineId}
                      onChange={(e) => setMachineId(e.target.value)}
                      className="w-full bg-white border border-slate-300 text-slate-800 rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                      placeholder="e.g. Paint-Booth-1"
                    />
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Intervention Name</label>
                  <input
                    type="text"
                    required
                    value={intervention}
                    onChange={(e) => setIntervention(e.target.value)}
                    className="w-full bg-white border border-slate-300 text-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                    placeholder="e.g. Nozzle Replacement & PID Tuning"
                  />
                </div>
              </div>

              {machineId && (
                <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-[11px] font-sans">
                  <Info className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Baseline metrics pre-filled from active dataset records for machine <strong>{machineId}</strong>.
                  </span>
                </div>
              )}

              {/* Before / After Columns */}
              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono">
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-slate-500 border-b border-slate-200 pb-1">
                    BEFORE INTERVENTION
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block">Baseline OEE (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={beforeOee}
                      onChange={(e) => setBeforeOee(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded p-1 text-slate-700 focus:outline-none focus:border-slate-400"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block">Baseline Downtime (min)</label>
                    <input
                      type="number"
                      value={beforeDt}
                      onChange={(e) => setBeforeDt(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded p-1 text-slate-700 focus:outline-none focus:border-slate-400"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block">Baseline Output</label>
                    <input
                      type="number"
                      value={beforeOut}
                      onChange={(e) => setBeforeOut(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded p-1 text-slate-700 focus:outline-none focus:border-slate-400"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-emerald-600 border-b border-slate-200 pb-1">
                    AFTER INTERVENTION
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block">Measured OEE (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={afterOee}
                      onChange={(e) => setAfterOee(Number(e.target.value))}
                      className="w-full bg-white border border-emerald-300 rounded p-1 text-emerald-700 font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block">Measured Downtime (min)</label>
                    <input
                      type="number"
                      value={afterDt}
                      onChange={(e) => setAfterDt(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded p-1 text-slate-700 focus:outline-none focus:border-slate-400"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block">Measured Output</label>
                    <input
                      type="number"
                      value={afterOut}
                      onChange={(e) => setAfterOut(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded p-1 text-blue-700 focus:outline-none focus:border-slate-400"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 font-sans">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg text-xs hover:bg-emerald-700 transition-all shadow-sm"
                >
                  Confirm & Save to Supabase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
