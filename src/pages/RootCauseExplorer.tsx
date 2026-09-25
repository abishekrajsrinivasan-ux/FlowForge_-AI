import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  ShieldAlert,
  Layers,
  Activity,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Wrench,
  BarChart3,
  TrendingDown,
  TrendingUp,
  Minus,
} from 'lucide-react';
import { useProductionData } from '../context/ProductionDataContext';
import { EmptyState } from '../components/common/EmptyState';
import { analyzeRootCauses, getAllMachineRootCauses, MachineRootCause, RootCauseFactor } from '../engine/rootCauseEngine';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FACTOR_COLORS: Record<string, string> = {
  Machine:           'bg-blue-100 text-blue-700 border-blue-200',
  Shift:             'bg-purple-100 text-purple-700 border-purple-200',
  Product:           'bg-amber-100 text-amber-700 border-amber-200',
  'Downtime Reason': 'bg-red-100 text-red-700 border-red-200',
  'Cycle Speed':     'bg-orange-100 text-orange-700 border-orange-200',
  Quality:           'bg-rose-100 text-rose-700 border-rose-200',
};

const FACTOR_ICONS: Record<string, React.ReactNode> = {
  Machine:           <Cpu className="w-3 h-3" />,
  Shift:             <Clock className="w-3 h-3" />,
  Product:           <BarChart3 className="w-3 h-3" />,
  'Downtime Reason': <Wrench className="w-3 h-3" />,
  'Cycle Speed':     <Activity className="w-3 h-3" />,
  Quality:           <ShieldAlert className="w-3 h-3" />,
};

const fmt = (v: number | null, digits = 1, unit = '') =>
  v !== null ? `${v.toFixed(digits)}${unit}` : '—';

const DeltaBadge: React.FC<{ value: number; inverse?: boolean }> = ({ value, inverse = false }) => {
  const bad = inverse ? value < 0 : value > 0;
  const Icon = bad ? TrendingDown : value === 0 ? Minus : TrendingUp;
  const color = bad ? 'text-red-600' : value === 0 ? 'text-slate-400' : 'text-emerald-600';
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-mono font-bold ${color}`}>
      <Icon className="w-2.5 h-2.5" />
      {value > 0 ? '+' : ''}{value.toFixed(1)}%
    </span>
  );
};

// ─── Confidence bar ───────────────────────────────────────────────────────────
const ConfidenceBar: React.FC<{ value: number }> = ({ value }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${value >= 80 ? 'bg-emerald-500' : value >= 60 ? 'bg-amber-500' : 'bg-red-400'}`}
        style={{ width: `${value}%` }}
      />
    </div>
    <span className="text-[10px] font-mono text-slate-500 w-8 text-right">{value}%</span>
  </div>
);

// ─── Factor card ──────────────────────────────────────────────────────────────
const FactorCard: React.FC<{ rc: RootCauseFactor; maxContrib: number }> = ({ rc, maxContrib }) => {
  const [open, setOpen] = useState(true);
  const cls = FACTOR_COLORS[rc.factor] || 'bg-slate-100 text-slate-600 border-slate-200';
  const icon = FACTOR_ICONS[rc.factor] || <Activity className="w-3 h-3" />;

  const unitLabel =
    rc.metricAnalyzed.toLowerCase().includes('rate') ||
    rc.metricAnalyzed.toLowerCase().includes('deviation')
      ? '%'
      : rc.metricAnalyzed.toLowerCase().includes('cycle')
      ? 's'
      : 'min';

  return (
    <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
      <div className="p-4 space-y-3">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border font-semibold uppercase shrink-0 ${cls}`}>
              {icon} {rc.factor}
            </span>
            <span className="text-sm font-bold text-slate-800 truncate">{rc.factorValue}</span>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <span className="text-base font-bold text-blue-600">{rc.contributionPercent.toFixed(1)}%</span>
            <span className="text-[9px] text-slate-400 font-mono">contribution</span>
          </div>
        </div>

        {/* Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono text-slate-400">
            <span>{rc.metricAnalyzed}</span>
            <span className="font-semibold text-slate-600">{rc.metricValue} {unitLabel}</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
              style={{ width: `${Math.min(100, (rc.contributionPercent / Math.max(1, maxContrib)) * 100)}%` }}
            />
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-[9px] text-slate-400 font-mono mb-0.5">Confidence</p>
            <ConfidenceBar value={rc.confidence} />
          </div>
          {rc.averageBaseline > 0 && (
            <div className="text-right ml-3">
              <p className="text-[9px] text-slate-400 font-mono">vs baseline ({rc.averageBaseline} {unitLabel})</p>
              <DeltaBadge value={rc.differencePercent} />
            </div>
          )}
        </div>
      </div>

      {/* Brief Description & Evidence toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-600 hover:bg-slate-100 transition-colors font-medium"
      >
        <span className="font-mono flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          {open ? 'Hide' : 'View'} Brief Description &amp; Data Evidence
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className="px-4 py-3 bg-blue-50/60 border-t border-blue-100">
          <p className="text-xs text-slate-700 leading-relaxed font-sans">{rc.evidence}</p>
        </div>
      )}
    </div>
  );
};

// ─── Machine sidebar card ─────────────────────────────────────────────────────
const MachineCard: React.FC<{
  mrc: MachineRootCause;
  selected: boolean;
  rank: number;
  onClick: () => void;
}> = ({ mrc, selected, rank, onClick }) => {
  const severity =
    (mrc.oeeEstimate !== null && mrc.oeeEstimate < 60) || mrc.downtimeShare >= 20
      ? 'high'
      : (mrc.oeeEstimate !== null && mrc.oeeEstimate < 75) || mrc.downtimeShare >= 12
      ? 'medium'
      : 'low';

  const dotColor =
    severity === 'high' ? 'bg-red-500' :
    severity === 'medium' ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl border transition-all ${
        selected
          ? 'border-blue-400 bg-blue-50 shadow-md ring-1 ring-blue-300'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[9px] font-mono text-slate-400 w-4">#{rank}</span>
        <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
        <span className="text-xs font-bold text-slate-800 truncate flex-1">{mrc.machineId}</span>
        {mrc.oeeEstimate !== null && (
          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
            mrc.oeeEstimate < 60 ? 'text-red-600 bg-red-50' :
            mrc.oeeEstimate < 75 ? 'text-amber-600 bg-amber-50' :
            'text-emerald-600 bg-emerald-50'
          }`}>
            OEE {mrc.oeeEstimate}%
          </span>
        )}
      </div>

      {/* Unique per-machine metrics */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] font-mono">
        <div className="text-slate-500"><span className="text-slate-400">DT: </span><span className="font-semibold text-slate-700">{mrc.totalDowntime}m</span></div>
        <div className="text-slate-500"><span className="text-slate-400">Avail: </span><span className="font-semibold text-slate-700">{fmt(mrc.availabilityRate, 1, '%')}</span></div>
        {mrc.cycleDeviation !== null && (
          <div className={mrc.cycleDeviation > 5 ? 'text-red-500 font-semibold' : mrc.cycleDeviation < -2 ? 'text-emerald-600' : 'text-slate-500'}>
            <span className="text-slate-400">Cycle: </span>{mrc.cycleDeviation > 0 ? '+' : ''}{mrc.cycleDeviation.toFixed(1)}%
          </div>
        )}
        {mrc.defectRate !== null && (
          <div className={mrc.defectRate > 2 ? 'text-red-500 font-semibold' : 'text-slate-500'}>
            <span className="text-slate-400">Scrap: </span>{mrc.defectRate.toFixed(2)}%
          </div>
        )}
      </div>

      {mrc.topDowntimeReason && (
        <div className="mt-2 text-[9px] text-red-700 bg-red-50 border border-red-100 rounded px-2 py-1 truncate" title={mrc.topDowntimeReason}>
          ⚠ {mrc.topDowntimeReason}
        </div>
      )}
    </button>
  );
};

// ─── KPI tile ─────────────────────────────────────────────────────────────────
const KpiTile: React.FC<{ label: string; value: string; sub: string; warn?: boolean; good?: boolean }> = ({ label, value, sub, warn, good }) => (
  <div className={`p-3 rounded-lg border ${warn ? 'bg-red-50 border-red-200' : good ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
    <p className="text-[9px] text-slate-400 font-mono uppercase tracking-wide">{label}</p>
    <p className={`text-xl font-bold ${warn ? 'text-red-700' : good ? 'text-emerald-700' : 'text-slate-800'}`}>{value}</p>
    <p className="text-[9px] text-slate-400 font-mono mt-0.5">{sub}</p>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
export const RootCauseExplorer: React.FC = () => {
  const { activeDataset, filteredRecords, losses } = useProductionData();
  const [searchParams] = useSearchParams();
  const machineParam = searchParams.get('machine');
  const riskTypeParam = searchParams.get('riskType');
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);

  const globalFindings  = useMemo(() => analyzeRootCauses(filteredRecords), [filteredRecords]);
  const machineBreakdowns = useMemo(() => getAllMachineRootCauses(filteredRecords), [filteredRecords]);

  useEffect(() => {
    if (machineParam && machineBreakdowns.length > 0) {
      const match = machineBreakdowns.find(
        (m) => m.machineId.toLowerCase() === machineParam.toLowerCase()
      );
      if (match) { setSelectedMachineId(match.machineId); return; }
    }
    if (!selectedMachineId && machineBreakdowns.length > 0) {
      setSelectedMachineId(machineBreakdowns[0].machineId);
    }
  }, [machineParam, machineBreakdowns]);

  const selectedMachine = useMemo(
    () => machineBreakdowns.find((m) => m.machineId === selectedMachineId) ?? null,
    [machineBreakdowns, selectedMachineId]
  );

  const maxContrib = useMemo(
    () => Math.max(...globalFindings.map((f) => f.contributionPercent), 1),
    [globalFindings]
  );
  const maxMachineContrib = useMemo(
    () => Math.max(...(selectedMachine?.factors.map((f) => f.contributionPercent) ?? [1])),
    [selectedMachine]
  );

  if (!activeDataset || filteredRecords.length === 0) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-xl font-bold tracking-tight text-slate-800">Root-Cause Explorer</h1>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
          <Search className="w-5 h-5 text-blue-500" />
          Evidence-Based Root-Cause Explorer
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Uses machine data and patterns to identify the actual cause of production losses.
          All findings are computed directly from your dataset records — showing only factors with statistically notable deviation.
        </p>
      </div>

      {/* URL context banner */}
      {machineParam && (
        <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between text-xs text-blue-800 font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span>
              Investigating: <strong>{machineParam}</strong>
              {riskTypeParam && <span> · Triggered by {riskTypeParam.replace(/_/g, ' ')} risk</span>}
            </span>
          </div>
          <span className="text-[11px] text-blue-600">Cross-Referenced from Risk Radar</span>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Causal Factors',    value: globalFindings.length, unit: 'found',    icon: <ShieldAlert className="w-4 h-4 text-blue-500" /> },
          { label: 'Machines Analysed', value: machineBreakdowns.length, unit: 'stations', icon: <Cpu className="w-4 h-4 text-violet-500" /> },
          { label: 'Total Downtime',    value: losses.totalLossMinutes, unit: 'min',    icon: <Clock className="w-4 h-4 text-red-500" /> },
          { label: 'Data Records',      value: filteredRecords.length, unit: 'rows',    icon: <BarChart3 className="w-4 h-4 text-emerald-500" /> },
        ].map((s) => (
          <div key={s.label} className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center gap-3">
            <div className="shrink-0">{s.icon}</div>
            <div>
              <p className="text-lg font-bold text-slate-800">{s.value}</p>
              <p className="text-[10px] text-slate-400 font-mono">{s.label} <span className="text-slate-300">· {s.unit}</span></p>
            </div>
          </div>
        ))}
      </div>

      {/* GLOBAL FINDINGS */}
      <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-slate-700">Dataset-Wide Causal Associations</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">{globalFindings.length} factors detected</span>
        </div>

        {globalFindings.length === 0 ? (
          <div className="p-6 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-600">No significant variance skews detected</p>
            <p className="text-xs text-slate-400 mt-1">All machines, shifts and products are within normal variation of each other. Check the machine drill-down below for individual station metrics.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {globalFindings.map((rc, i) => (
              <FactorCard key={i} rc={rc} maxContrib={maxContrib} />
            ))}
          </div>
        )}
      </div>

      {/* MACHINE-LEVEL DEEP DIVE */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 p-5 pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-violet-500" />
            <h3 className="text-sm font-semibold text-slate-700">Machine-Level Root Cause Breakdown</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">Each machine shows its own unique metrics from your data</span>
        </div>

        <div className="flex flex-col md:flex-row" style={{ minHeight: 480 }}>
          {/* Sidebar */}
          <div className="md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-slate-200 p-4 space-y-2 bg-slate-50 overflow-y-auto">
            <p className="text-[10px] font-mono text-slate-400 uppercase pb-1 border-b border-slate-200">
              Ranked by OEE Impact
            </p>
            {machineBreakdowns.map((mrc, i) => (
              <MachineCard
                key={mrc.machineId}
                mrc={mrc}
                rank={i + 1}
                selected={mrc.machineId === selectedMachineId}
                onClick={() => setSelectedMachineId(mrc.machineId)}
              />
            ))}
          </div>

          {/* Detail pane */}
          <div className="flex-1 p-5 space-y-5 overflow-y-auto">
            {!selectedMachine ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                Select a machine to view its root causes
              </div>
            ) : (
              <>
                {/* Machine header */}
                <div className="flex items-center gap-3 flex-wrap">
                  <Cpu className="w-5 h-5 text-violet-500" />
                  <h4 className="text-base font-bold text-slate-800">{selectedMachine.machineId}</h4>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-semibold ${
                    selectedMachine.oeeEstimate !== null && selectedMachine.oeeEstimate < 60
                      ? 'text-red-600 bg-red-50 border-red-200'
                      : selectedMachine.oeeEstimate !== null && selectedMachine.oeeEstimate < 75
                      ? 'text-amber-600 bg-amber-50 border-amber-200'
                      : 'text-emerald-600 bg-emerald-50 border-emerald-200'
                  }`}>
                    {selectedMachine.oeeEstimate !== null && selectedMachine.oeeEstimate < 60 ? 'HIGH RISK' :
                     selectedMachine.oeeEstimate !== null && selectedMachine.oeeEstimate < 75 ? 'MEDIUM RISK' : 'LOW RISK'}
                  </span>
                  <span className="text-xs text-slate-400 font-mono ml-auto">{selectedMachine.totalRecords} records</span>
                </div>

                {/* KPI grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <KpiTile
                    label="Downtime"
                    value={`${selectedMachine.totalDowntime} min`}
                    sub={`${selectedMachine.downtimeShare.toFixed(1)}% of total`}
                    warn={selectedMachine.downtimeShare >= 20}
                  />
                  <KpiTile
                    label="Availability"
                    value={fmt(selectedMachine.availabilityRate, 1, '%')}
                    sub={`${selectedMachine.totalActual.toFixed(0)} of ${selectedMachine.totalTarget.toFixed(0)} planned min`}
                    warn={selectedMachine.availabilityRate !== null && selectedMachine.availabilityRate < 75}
                    good={selectedMachine.availabilityRate !== null && selectedMachine.availabilityRate >= 90}
                  />
                  <KpiTile
                    label="Performance Rate"
                    value={fmt(selectedMachine.performanceRate, 1, '%')}
                    sub={`Cycle: ${selectedMachine.avgActualCycle ?? '—'}s vs ${selectedMachine.avgIdealCycle ?? '—'}s ideal`}
                    warn={selectedMachine.performanceRate !== null && selectedMachine.performanceRate < 80}
                  />
                  <KpiTile
                    label="Quality Rate"
                    value={fmt(selectedMachine.qualityRate, 1, '%')}
                    sub={`${selectedMachine.totalDefects} defects / ${selectedMachine.totalUnits} units`}
                    warn={selectedMachine.qualityRate !== null && selectedMachine.qualityRate < 95}
                    good={selectedMachine.qualityRate !== null && selectedMachine.qualityRate >= 99}
                  />
                  <KpiTile
                    label="OEE Estimate"
                    value={fmt(selectedMachine.oeeEstimate, 1, '%')}
                    sub="A × P × Q composite"
                    warn={selectedMachine.oeeEstimate !== null && selectedMachine.oeeEstimate < 60}
                    good={selectedMachine.oeeEstimate !== null && selectedMachine.oeeEstimate >= 80}
                  />
                  <KpiTile
                    label="Output Gap"
                    value={`${selectedMachine.throughputGapUnits.toFixed(0)} units`}
                    sub={`${selectedMachine.throughputGapPct.toFixed(1)}% below target`}
                    warn={selectedMachine.throughputGapPct > 10}
                  />
                </div>

                {/* Top stoppage reason */}
                {selectedMachine.topDowntimeReason && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-semibold text-red-600 uppercase font-mono tracking-wide">Primary Stoppage Cause</p>
                      <p className="text-sm font-bold text-red-800 mt-0.5">{selectedMachine.topDowntimeReason}</p>
                      <p className="text-[10px] text-red-600 mt-0.5 font-mono">
                        {selectedMachine.topDowntimeReasonMinutes} min across {selectedMachine.downtimeReasonCount} event(s)
                      </p>
                    </div>
                  </div>
                )}

                {/* Brief Data-Driven Description */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Data-Driven Root Cause Brief — {selectedMachine.machineId}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed font-sans">
                    According to the <strong>{selectedMachine.totalRecords} evaluated records</strong> in your uploaded dataset,
                    <strong> {selectedMachine.machineId}</strong> incurred <strong>{selectedMachine.totalDowntime} minutes of total downtime</strong>
                    (accounting for <strong>{selectedMachine.downtimeShare.toFixed(1)}%</strong> of all plant downtime).
                    {selectedMachine.topDowntimeReason && (
                      <> The single largest contributing failure mode was <strong>"{selectedMachine.topDowntimeReason}"</strong>, consuming <strong>{selectedMachine.topDowntimeReasonMinutes} minutes</strong> across {selectedMachine.downtimeReasonCount} stoppage event(s).</>
                    )}
                    {selectedMachine.throughputGapUnits > 0 && (
                      <> The station delivered <strong>{selectedMachine.totalActual.toFixed(0)} units</strong> vs a scheduled quota of {selectedMachine.totalTarget.toFixed(0)} units (a shortfall of <strong>{selectedMachine.throughputGapUnits.toFixed(0)} units</strong> or {selectedMachine.throughputGapPct.toFixed(1)}%).</>
                    )}
                    {selectedMachine.defectRate !== null && selectedMachine.defectRate > 0 && (
                      <> Defect rate logged at <strong>{selectedMachine.defectRate.toFixed(2)}%</strong> ({selectedMachine.totalDefects} scrap units).</>
                    )}
                  </p>
                </div>

                {/* Factor cards */}
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase font-mono tracking-wider mb-3 border-b border-slate-100 pb-2">
                    Contributing Factors — {selectedMachine.machineId}
                  </p>
                  {selectedMachine.factors.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-sm bg-slate-50 rounded-lg">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                      No significant issues detected for this machine
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {selectedMachine.factors.map((rc, i) => (
                        <FactorCard key={i} rc={rc} maxContrib={maxMachineContrib} />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* LOSS DECOMPOSITION TREE */}
      <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-slate-700">Interactive Loss Decomposition Tree</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">Total: {losses.totalLossMinutes} min</span>
        </div>

        <div className="space-y-4 font-mono text-xs">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
              <strong className="text-slate-700">Total Evaluated Production Loss</strong>
            </div>
            <span className="text-blue-600 font-bold">{losses.totalLossMinutes} minutes (100%)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-4 border-l-2 border-slate-300">
            {losses.tree.children?.map((cat) => (
              <div key={cat.name} className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">{cat.name}</span>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded font-bold ${
                    cat.category === 'Availability Loss' ? 'text-blue-600 bg-blue-50' :
                    cat.category === 'Performance Loss' ? 'text-amber-600 bg-amber-50' :
                    'text-rose-600 bg-rose-50'
                  }`}>
                    {cat.percentage}%
                  </span>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  {cat.children?.map((sub) => (
                    <div key={sub.name} className="p-2 rounded bg-white border border-slate-200 flex items-center justify-between text-slate-600">
                      <span>{sub.name}</span>
                      <span className="font-bold text-slate-500">{sub.value}m</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
