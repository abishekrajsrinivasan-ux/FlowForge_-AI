import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Flame,
  Info,
  ArrowRight,
  TrendingUp,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Cpu,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useProductionData } from '../context/ProductionDataContext';
import { EmptyState } from '../components/common/EmptyState';
import { MachineBottleneckScore } from '../types/analytics';

// Score severity helpers
const scoreSeverity = (score: number) =>
  score >= 35 ? 'critical' : score >= 20 ? 'high' : score >= 10 ? 'medium' : 'low';

const scoreColors = {
  critical: { bg: 'bg-rose-600',    text: 'text-rose-700',    light: 'bg-rose-50 border-rose-200',   badge: 'bg-rose-600 text-white' },
  high:     { bg: 'bg-amber-500',   text: 'text-amber-700',   light: 'bg-amber-50 border-amber-200', badge: 'bg-amber-500 text-white' },
  medium:   { bg: 'bg-blue-500',    text: 'text-blue-700',    light: 'bg-blue-50 border-blue-200',   badge: 'bg-blue-500 text-white' },
  low:      { bg: 'bg-emerald-500', text: 'text-emerald-700', light: 'bg-emerald-50 border-emerald-200', badge: 'bg-emerald-500 text-white' },
};

const ScoreBar: React.FC<{ value: number; max?: number }> = ({ value, max = 100 }) => {
  const sev = scoreSeverity(value);
  const fill = Math.min(100, (value / max) * 100);
  return (
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden w-full">
      <div
        className={`h-full rounded-full ${scoreColors[sev].bg}`}
        style={{ width: `${fill}%` }}
      />
    </div>
  );
};

const oeeColor = (v: number | null, threshold: number) => {
  if (v === null) return 'text-slate-400';
  return v < threshold ? 'text-red-600 font-semibold' : v >= threshold + 15 ? 'text-emerald-600' : 'text-amber-600';
};

export const BottleneckIntelligence: React.FC = () => {
  const navigate = useNavigate();
  const { activeDataset, filteredRecords, bottlenecks, currentBottleneck, predictiveBottlenecks } =
    useProductionData();
  const [showFormulaModal, setShowFormulaModal] = useState(false);

  if (!activeDataset || filteredRecords.length === 0) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-xl font-bold tracking-tight text-slate-800">Bottleneck Intelligence System</h1>
        <EmptyState />
      </div>
    );
  }

  const topSev = currentBottleneck ? scoreSeverity(currentBottleneck.bottleneckScore) : 'low';
  const topColors = scoreColors[topSev];

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Flame className="w-5 h-5 text-rose-500" />
            Bottleneck Intelligence & Constraint Discovery
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Absolute OEE-component scoring — each machine scored on its own availability, performance, quality and throughput gap. No synthetic values.
          </p>
        </div>
        <button
          onClick={() => setShowFormulaModal(!showFormulaModal)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-blue-600 text-xs font-medium rounded-lg transition-all shadow-sm"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          How is score calculated?
          {showFormulaModal ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Formula drawer */}
      {showFormulaModal && (
        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 text-xs text-slate-700 space-y-2">
          <div className="flex items-center gap-2 font-bold text-blue-700">
            <Info className="w-4 h-4" />
            Composite Bottleneck Score — Absolute OEE Component Method
          </div>
          <p className="text-slate-600">Each machine is scored using its own real metrics, not relative to other machines:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 font-mono text-[11px] pt-1">
            {[
              { label: 'OEE Loss (30%)',        value: '100 − Machine OEE %' },
              { label: 'Avail. Loss (20%)',     value: '100 − Availability %' },
              { label: 'Perf. Loss (20%)',      value: '100 − Performance %' },
              { label: 'Quality Loss (15%)',    value: 'Defect Rate %' },
              { label: 'Throughput Gap (10%)',  value: 'Output Gap / Target %' },
              { label: 'Trend Slope (5%)',      value: 'Downtime Drift Rate' },
            ].map((item) => (
              <div key={item.label} className="bg-white p-2 rounded border border-blue-100">
                <span className="text-slate-500 block">{item.label}</span>
                <span className="text-slate-700">{item.value}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 italic">
            Score 0-10 = Healthy · 10-20 = Monitor · 20-35 = High Risk · 35+ = Critical Constraint
          </p>
        </div>
      )}

      {/* CURRENT BOTTLENECK SPOTLIGHT */}
      {currentBottleneck && (
        <div className={`p-5 rounded-xl border flex flex-col md:flex-row md:items-start justify-between gap-6 shadow-sm ${topColors.light}`}>
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs uppercase tracking-wider ${topColors.badge}`}>
                Rank #1 Constraint
              </span>
              <span className="text-slate-500 text-xs">
                Score: <strong className={`font-mono text-sm ${topColors.text}`}>{currentBottleneck.bottleneckScore}/100</strong>
              </span>
              <span className={`text-xs font-mono px-2 py-0.5 rounded border font-bold uppercase ${topColors.light} ${topColors.text}`}>
                {topSev}
              </span>
            </div>

            <h2 className="text-2xl font-bold text-slate-800">{currentBottleneck.machineId}</h2>

            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              <strong>{currentBottleneck.machineId}</strong> holds the highest cumulative drag on system throughput.
              OEE: <strong className={oeeColor(currentBottleneck.oee, 75)}>{currentBottleneck.oee != null ? currentBottleneck.oee + '%' : '—'}</strong> ·
              Availability: <strong className={oeeColor(currentBottleneck.availability, 85)}>{currentBottleneck.availability != null ? currentBottleneck.availability + '%' : '—'}</strong> ·
              Performance: <strong className={oeeColor(currentBottleneck.performance, 85)}>{currentBottleneck.performance != null ? currentBottleneck.performance + '%' : '—'}</strong> ·
              Quality: <strong className={oeeColor(currentBottleneck.quality, 99)}>{currentBottleneck.quality != null ? currentBottleneck.quality + '%' : '—'}</strong>.{' '}
              Downtime: <strong className="text-rose-600 font-mono">{currentBottleneck.totalDowntime} min</strong> ·
              Primary loss mode: <span className="text-blue-600 underline">{currentBottleneck.primaryObservedLoss}</span>.
            </p>

            {/* Mini OEE component bars */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-1">
              {[
                { label: 'OEE',           val: currentBottleneck.oee,          threshold: 75 },
                { label: 'Availability',  val: currentBottleneck.availability,  threshold: 85 },
                { label: 'Performance',   val: currentBottleneck.performance,   threshold: 85 },
                { label: 'Quality',       val: currentBottleneck.quality,       threshold: 99 },
              ].map((c) => (
                <div key={c.label} className="bg-white rounded-lg border border-slate-200 p-2.5">
                  <p className="text-[9px] font-mono text-slate-400 uppercase">{c.label}</p>
                  <p className={`text-xl font-bold ${c.val !== null && c.val < c.threshold ? 'text-red-600' : c.val !== null && c.val >= c.threshold + 5 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {c.val != null ? c.val + '%' : '—'}
                  </p>
                  <div className="h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${c.val !== null && c.val < c.threshold ? 'bg-red-500' : c.val !== null && c.val >= c.threshold + 5 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      style={{ width: `${c.val ?? 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => navigate(`/root-causes?machine=${encodeURIComponent(currentBottleneck.machineId)}`)}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg transition-all shadow-sm"
            >
              Explore Root Causes
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/simulator')}
              className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs rounded-lg border border-slate-300 transition-all"
            >
              Simulate Alleviation
            </button>
          </div>
        </div>
      )}

      {/* RANKED MACHINE TABLE */}
      <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Ranked Constraints — Real OEE Components per Machine</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">Rank</th>
                <th className="py-3 px-3">Machine</th>
                <th className="py-3 px-3">Score /100</th>
                <th className="py-3 px-3">OEE %</th>
                <th className="py-3 px-3">Avail. %</th>
                <th className="py-3 px-3">Perf. %</th>
                <th className="py-3 px-3">Quality %</th>
                <th className="py-3 px-3">Downtime min</th>
                <th className="py-3 px-3">Output Gap</th>
                <th className="py-3 px-3">Primary Loss</th>
                <th className="py-3 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bottlenecks.map((m) => {
                const sev = scoreSeverity(m.bottleneckScore);
                const c = scoreColors[sev];
                return (
                  <tr
                    key={m.machineId}
                    className={`hover:bg-slate-50 transition-colors cursor-pointer ${m.isCurrentBottleneck ? 'bg-rose-50' : ''}`}
                    onClick={() => navigate(`/root-causes?machine=${encodeURIComponent(m.machineId)}`)}
                    title="Click to explore root causes"
                  >
                    <td className="py-3 px-3 font-bold text-slate-500">#{m.rank}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-800">{m.machineId}</span>
                        {m.isCurrentBottleneck && (
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Active Bottleneck" />
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-col gap-1">
                        <span className={`px-2 py-0.5 rounded font-bold text-center text-[11px] border ${c.light} ${c.text}`}>
                          {m.bottleneckScore}
                        </span>
                        <ScoreBar value={m.bottleneckScore} max={50} />
                      </div>
                    </td>
                    <td className={`py-3 px-3 ${oeeColor(m.oee, 75)}`}>{m.oee != null ? m.oee + '%' : '—'}</td>
                    <td className={`py-3 px-3 ${oeeColor(m.availability, 85)}`}>{m.availability != null ? m.availability + '%' : '—'}</td>
                    <td className={`py-3 px-3 ${oeeColor(m.performance, 85)}`}>{m.performance != null ? m.performance + '%' : '—'}</td>
                    <td className={`py-3 px-3 ${oeeColor(m.quality, 99)}`}>{m.quality != null ? m.quality + '%' : '—'}</td>
                    <td className="py-3 px-3 text-rose-600 font-medium">{m.totalDowntime}m</td>
                    <td className="py-3 px-3 text-slate-600">{m.throughputGapUnits.toFixed(0)} units</td>
                    <td className="py-3 px-3 text-blue-600">{m.primaryObservedLoss}</td>
                    <td className="py-3 px-3">
                      {m.isCurrentBottleneck ? (
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${c.badge}`}>
                          {sev.toUpperCase()} · #1
                        </span>
                      ) : sev === 'low' ? (
                        <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Healthy
                        </span>
                      ) : (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${c.light} ${c.text}`}>
                          {sev.charAt(0).toUpperCase() + sev.slice(1)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-slate-400 mt-3 font-mono">
          Click any row to explore root causes for that machine. Score ≥35 = Critical · 20-35 = High · 10-20 = Medium · &lt;10 = Healthy
        </p>
      </div>

      {/* PREDICTIVE TREND */}
      <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-3 gap-1">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-slate-700">Predictive Bottleneck Detection</h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">Identifies emerging bottlenecks before they become major production constraints</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {predictiveBottlenecks.map((pb) => (
            <div key={pb.machineId} className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-700 text-sm">{pb.machineId}</span>
                {pb.sufficientData ? (
                  <span className={`text-[11px] font-mono px-2 py-0.5 rounded font-bold border ${
                    pb.riskProbability >= 70
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : pb.riskProbability >= 40
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {pb.riskProbability}% Risk
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 font-mono">Insufficient data</span>
                )}
              </div>

              <p className="text-xs text-slate-500 leading-relaxed mb-2">{pb.evidence}</p>

              {pb.sufficientData && (
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Drift: {pb.trendSlope >= 0 ? '+' : ''}{pb.trendSlope}m/step</span>
                  <span>{pb.historicalPointsCount} data pts</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
