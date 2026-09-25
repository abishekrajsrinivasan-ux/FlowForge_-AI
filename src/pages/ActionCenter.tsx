import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, Plus, CheckCircle, Clock, XCircle, AlertCircle, ArrowRight, TrendingUp } from 'lucide-react';
import { useProductionData } from '../context/ProductionDataContext';
import { EmptyState } from '../components/common/EmptyState';
import { ActionRecord } from '../types/database';

export const ActionCenter: React.FC = () => {
  const {
    activeDataset,
    filteredRecords,
    recommendations,
    actions,
    updateActionStatus,
    addAction,
  } = useProductionData();

  const [activeFilter, setActiveFilter] = useState<'ALL' | 'OPEN' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');
  const [newActionText, setNewActionText] = useState('');
  const [newActionMachine, setNewActionMachine] = useState('');
  const [newActionPriority, setNewActionPriority] = useState<ActionRecord['priority']>('HIGH');
  const [showAddModal, setShowAddModal] = useState(false);

  if (!activeDataset || filteredRecords.length === 0) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-xl font-bold tracking-tight text-slate-800">
          Continuous Improvement Action Center
        </h1>
        <EmptyState />
      </div>
    );
  }

  const handleConvertRecommendationToAction = async (rec: any) => {
    await addAction({
      dataset_id: activeDataset.id,
      recommendation_id: rec.id ?? null,
      machine_id: rec.machine_id,
      action: rec.recommendation,
      priority: rec.priority,
      owner: 'Operations Engineering',
      status: 'OPEN',
    });
  };

  const handleCreateCustomAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActionText.trim()) return;

    await addAction({
      dataset_id: activeDataset.id,
      machine_id: newActionMachine.trim() || null,
      action: newActionText.trim(),
      priority: newActionPriority,
      owner: 'Line Supervisor',
      status: 'OPEN',
    });

    setNewActionText('');
    setNewActionMachine('');
    setShowAddModal(false);
  };

  const filteredActions = actions.filter((a) => {
    if (activeFilter === 'ALL') return a.status !== 'DISMISSED';
    return a.status === activeFilter;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-blue-500" />
            Continuous Improvement Action Center
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track corrective tasks, assign engineering owners, and monitor remediation status with Supabase persistence.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/improvements"
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-lg transition-all border border-emerald-200 shadow-sm"
          >
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            View in Improvement Tracker
          </Link>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Corrective Action
          </button>
        </div>
      </div>

      {/* FILTER BUTTONS */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {(['ALL', 'OPEN', 'IN_PROGRESS', 'COMPLETED'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveFilter(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeFilter === tab
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.replace('_', ' ')} (
            {tab === 'ALL'
              ? actions.length
              : actions.filter((a) => a.status === tab).length}
            )
          </button>
        ))}
      </div>

      {/* ADOPTABLE SYSTEM RECOMMENDATIONS */}
      {recommendations.length > 0 && (
        <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="text-sm font-semibold text-slate-700">
              System-Generated Corrective Recommendations ({recommendations.length})
            </h3>
            <span className="text-xs text-blue-600 font-mono">Ready to Adopt</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendations.map((rec, i) => (
              <div
                key={i}
                className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                        rec.priority === 'CRITICAL'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : rec.priority === 'HIGH'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {rec.priority}
                    </span>
                    {rec.machine_id && (
                      <span className="text-xs font-mono text-blue-600 font-semibold">
                        Machine: {rec.machine_id}
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-bold text-slate-800 mb-1">{rec.problem}</h4>
                  <p className="text-xs text-slate-600 bg-white p-2.5 rounded border border-slate-200 mb-2 leading-relaxed">
                    <strong>Evidence:</strong> {rec.evidence}
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    <strong>Proposed Fix:</strong> {rec.recommendation}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-[11px] text-emerald-600 font-mono">
                    Impact: {rec.expected_impact}
                  </span>
                  {actions.some((a) => a.action === rec.recommendation) ? (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded border border-emerald-200">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      Adopted · In Improvement Tracker
                    </span>
                  ) : (
                    <button
                      onClick={() => handleConvertRecommendationToAction(rec)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-blue-600 text-xs font-medium rounded transition-all border border-slate-300"
                    >
                      Adopt to Action List
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ACTIVE ACTION ITEMS LIST */}
      <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">Active Task Board</h3>

        {filteredActions.length === 0 ? (
          <p className="text-xs text-slate-500 italic p-4">
            No actions in this category. Adopt a system recommendation above or click "Create Corrective Action".
          </p>
        ) : (
          <div className="space-y-3">
            {filteredActions.map((action) => (
              <div
                key={action.id}
                className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                        action.priority === 'CRITICAL'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : action.priority === 'HIGH'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {action.priority}
                    </span>
                    {action.machine_id && (
                      <span className="text-xs font-mono text-blue-600 font-semibold">
                        [{action.machine_id}]
                      </span>
                    )}
                    <span className="text-xs text-slate-400 font-mono">
                      Owner: {action.owner || 'Unassigned'}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-700">{action.action}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    aria-label="Action Status"
                    value={action.status}
                    onChange={(e) => updateActionStatus(action.id, e.target.value as any)}
                    className="bg-white border border-slate-300 text-slate-700 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 font-mono"
                  >
                    <option value="OPEN">OPEN</option>
                    <option value="IN_PROGRESS">IN PROGRESS</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="DISMISSED">DISMISSED</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CREATE ACTION MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-800/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-800">Log New Action Item</h3>
            <form onSubmit={handleCreateCustomAction} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Action Description</label>
                <textarea
                  required
                  rows={3}
                  value={newActionText}
                  onChange={(e) => setNewActionText(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                  placeholder="e.g. Recalibrate conveyor feed rate and inspect optical sensors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Target Machine</label>
                  <input
                    type="text"
                    value={newActionMachine}
                    onChange={(e) => setNewActionMachine(e.target.value)}
                    className="w-full bg-white border border-slate-300 text-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="e.g. Press-101"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Priority</label>
                  <select
                    value={newActionPriority}
                    onChange={(e) => setNewActionPriority(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 text-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg text-xs hover:bg-blue-700 transition-all shadow-sm"
                >
                  Save Action
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
