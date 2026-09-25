import React, { useState } from 'react';
import { AlertTriangle, TrendingUp, CheckCircle, Clock, Sliders } from 'lucide-react';
import { useProductionData } from '../context/ProductionDataContext';
import { EmptyState } from '../components/common/EmptyState';
import { MetricCard } from '../components/common/MetricCard';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
} from 'recharts';

export const TargetRisk: React.FC = () => {
  const { activeDataset, filteredRecords, targetRisk } = useProductionData();
  const [threshold, setThreshold] = useState<number>(10); // % deficit threshold for HIGH risk

  if (!activeDataset || filteredRecords.length === 0) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-xl font-bold tracking-tight text-slate-800">
          Target Achievement Risk & Run-Rate Forecasting
        </h1>
        <EmptyState />
      </div>
    );
  }

  // Trajectory projection chart simulation points (Current pacing vs Planned target pace)
  const trajectoryData = [
    { phase: 'Shift Start', actual: 0, target: 0, requiredPace: 0 },
    { phase: 'Elapsed (Current)', actual: targetRisk.currentOutput, target: Math.round(targetRisk.target * 0.7), requiredPace: Math.round(targetRisk.target * 0.7) },
    { phase: 'Mid Window', actual: Math.round(targetRisk.currentOutput + targetRisk.currentRunRate * 1), target: Math.round(targetRisk.target * 0.85), requiredPace: Math.round(targetRisk.currentOutput + targetRisk.requiredRunRate * 1) },
    { phase: 'Completion End', actual: targetRisk.projectedOutput, target: targetRisk.target, requiredPace: targetRisk.target },
  ];

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
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Production Target Risk & Trajectory Forecaster
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Predictive velocity monitoring comparing current output velocity against the required pacing to satisfy scheduled quotas.
        </p>
      </div>

      {/* RISK STATUS BANNER */}
      <div
        className={`p-5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm ${
          targetRisk.riskLevel === 'HIGH'
            ? 'bg-rose-50 border-rose-200 text-rose-800'
            : targetRisk.riskLevel === 'MEDIUM'
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-current" />
            Projected Target Risk Level: {targetRisk.riskLevel}
          </div>
          <p className="text-xs leading-relaxed max-w-3xl text-slate-700">
            {targetRisk.reasoning}
          </p>
        </div>

        <div className="text-right shrink-0">
          <span className="text-[10px] uppercase font-mono block opacity-75">Projected Shortfall</span>
          <span className="text-2xl font-bold font-mono">
            {targetRisk.projectedDeficit.toLocaleString()} <span className="text-xs">units</span>
          </span>
        </div>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Planned Target"
          value={targetRisk.target.toLocaleString()}
          unit="units"
          status="normal"
          subtext="Total scheduled batch quota"
        />
        <MetricCard
          label="Current Output"
          value={targetRisk.currentOutput.toLocaleString()}
          unit="units"
          status="normal"
          subtext={`Remaining: ${targetRisk.remainingTarget.toLocaleString()} units`}
        />
        <MetricCard
          label="Current Run Rate"
          value={targetRisk.currentRunRate}
          unit="units/hr"
          icon={TrendingUp}
          status={targetRisk.currentRunRate >= targetRisk.requiredRunRate ? 'success' : 'warning'}
          subtext="Actual operating pace"
        />
        <MetricCard
          label="Required Run Rate"
          value={targetRisk.requiredRunRate}
          unit="units/hr"
          icon={Clock}
          status="normal"
          subtext="Pace needed to close gap"
        />
      </div>

      {/* TRAJECTORY CHART */}
      <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-sm font-semibold text-slate-700">
            Production Velocity Trajectory vs Target Plan
          </h3>
          <span className="text-xs text-slate-400 font-mono">Forecast Projection</span>
        </div>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trajectoryData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="phase" stroke="#94a3b8" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px', color: '#64748b' }} />
              <Area type="monotone" dataKey="actual" name="Current Projected Output" stroke="#2563eb" fill="#2563eb" fillOpacity={0.08} strokeWidth={2} />
              <Area type="monotone" dataKey="target" name="Scheduled Target" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.05} strokeDasharray="4 4" strokeWidth={2} />
              <Line type="monotone" dataKey="requiredPace" name="Required Velocity Pace" stroke="#f59e0b" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
