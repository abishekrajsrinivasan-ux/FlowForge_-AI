import React, { useState } from 'react';
import { PieChart as PieIcon, BarChart3, Filter, Table, Layers } from 'lucide-react';
import { useProductionData } from '../context/ProductionDataContext';
import { EmptyState } from '../components/common/EmptyState';
import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
} from 'recharts';

export const LossAnalysis: React.FC = () => {
  const { activeDataset, filteredRecords, losses } = useProductionData();
  const [selectedReasonFilter, setSelectedReasonFilter] = useState<string | null>(null);

  if (!activeDataset || filteredRecords.length === 0) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-xl font-bold tracking-tight text-slate-800">
          Loss Analysis & Pareto Diagnostics
        </h1>
        <EmptyState />
      </div>
    );
  }

  // Filter records based on selected reason if clicked
  const inspectedRecords = selectedReasonFilter
    ? filteredRecords.filter((r) => r.downtime_reason === selectedReasonFilter)
    : filteredRecords.filter((r) => (r.downtime ?? 0) > 0);

  const tooltipStyle = {
    contentStyle: { backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
    labelStyle: { color: '#1e293b', fontWeight: 'bold' },
    itemStyle: { color: '#475569' },
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
          <PieIcon className="w-5 h-5 text-blue-500" />
          Production Loss Analysis & Six Big Losses
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Quantitative loss attribution across Availability, Operating Speed, and Scrap defects.
        </p>
      </div>

      {/* SUMMARY LOSS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
            Total Production Loss
          </span>
          <span className="text-2xl font-bold font-mono text-slate-800">
            {losses.totalLossMinutes} <span className="text-xs font-normal text-slate-400">mins</span>
          </span>
          <span className="text-[11px] text-slate-400 block mt-1">100% evaluated deficit</span>
        </div>

        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 shadow-sm">
          <span className="text-xs font-medium text-blue-700 uppercase tracking-wider block mb-1">
            Availability Loss
          </span>
          <span className="text-2xl font-bold font-mono text-blue-700">
            {losses.availabilityLossMinutes} <span className="text-xs font-normal text-slate-400">mins</span>
          </span>
          <span className="text-[11px] text-blue-600 block mt-1">
            {losses.availabilityLossPercent}% of total loss
          </span>
        </div>

        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 shadow-sm">
          <span className="text-xs font-medium text-amber-700 uppercase tracking-wider block mb-1">
            Performance Loss
          </span>
          <span className="text-2xl font-bold font-mono text-amber-700">
            {losses.performanceLossMinutes} <span className="text-xs font-normal text-slate-400">mins</span>
          </span>
          <span className="text-[11px] text-amber-600 block mt-1">
            {losses.performanceLossPercent}% of total loss
          </span>
        </div>

        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 shadow-sm">
          <span className="text-xs font-medium text-rose-700 uppercase tracking-wider block mb-1">
            Quality Loss
          </span>
          <span className="text-2xl font-bold font-mono text-rose-700">
            {losses.qualityLossMinutes} <span className="text-xs font-normal text-slate-400">mins</span>
          </span>
          <span className="text-[11px] text-rose-600 block mt-1">
            {losses.qualityLossPercent}% of total loss
          </span>
        </div>
      </div>

      {/* PARETO LOSS CHART */}
      <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">
              Pareto Distribution of Stoppages (80 / 20 Rule)
            </h3>
            <p className="text-[11px] text-slate-500">
              Columns represent lost minutes; the red line shows cumulative percentage. Click a bar or table row to inspect underlying records.
            </p>
          </div>
          {selectedReasonFilter && (
            <button
              onClick={() => setSelectedReasonFilter(null)}
              className="text-xs text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded border border-blue-200 font-mono"
            >
              Clear Filter: {selectedReasonFilter} ✕
            </button>
          )}
        </div>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={losses.paretoReasons}
              margin={{ top: 20, right: 20, bottom: 20, left: -10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="reason" stroke="#94a3b8" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} angle={-15} textAnchor="end" />
              <YAxis yAxisId="left" stroke="#94a3b8" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} stroke="#f43f5e" tick={{ fontSize: 11, fill: '#64748b' }} unit="%" />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '15px', color: '#64748b' }} />
              <Bar yAxisId="left" dataKey="value" name="Lost Minutes" fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="cumulativePercentage" name="Cumulative %" stroke="#f43f5e" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* INSPECTOR TABLE: UNDERLYING RECORDS */}
      <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Table className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-slate-700">
              Underlying Stoppage Records {selectedReasonFilter && `(${selectedReasonFilter})`}
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {inspectedRecords.length} Records Shown
          </span>
        </div>

        <div className="overflow-x-auto max-h-72">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Date / Time</th>
                <th className="py-2.5 px-3">Machine</th>
                <th className="py-2.5 px-3">Shift</th>
                <th className="py-2.5 px-3">Downtime Reason</th>
                <th className="py-2.5 px-3">Lost Min</th>
                <th className="py-2.5 px-3">Produced Units</th>
                <th className="py-2.5 px-3">Defects</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inspectedRecords.slice(0, 50).map((r, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2 px-3 text-slate-600">{r.timestamp || r.date || '—'}</td>
                  <td className="py-2 px-3 font-semibold text-slate-700">{r.machine_id}</td>
                  <td className="py-2 px-3 text-slate-500">{r.shift || '—'}</td>
                  <td className="py-2 px-3 text-blue-600 font-medium">
                    {r.downtime_reason || 'Unspecified Stoppage'}
                  </td>
                  <td className="py-2 px-3 text-rose-600 font-bold">{r.downtime ?? 0}m</td>
                  <td className="py-2 px-3 text-slate-600">
                    {(r.actual_quantity ?? r.total_units ?? 0).toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-amber-600">{r.defective_units ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
