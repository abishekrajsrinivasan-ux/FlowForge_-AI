import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Radar,
  AlertTriangle,
  AlertOctagon,
  ShieldCheck,
  TrendingUp,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Search,
  Sliders,
  Info,
  Clock,
  CheckCircle2,
  X,
  Layers,
  Filter,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useProductionData } from '../context/ProductionDataContext';
import { EmptyState } from '../components/common/EmptyState';
import {
  RiskRadarItem,
  RiskSeverity,
  RiskCategory,
} from '../types/analytics';

// Color & badge helpers adhering to FLOWFORGE AI design system
const getSeverityColor = (severity: RiskSeverity) => {
  switch (severity) {
    case 'CRITICAL':
      return {
        bg: 'bg-rose-50',
        border: 'border-rose-200',
        text: 'text-rose-700',
        badge: 'bg-rose-100 text-rose-800 border-rose-200',
        dot: 'bg-rose-500',
        glow: 'shadow-rose-100',
      };
    case 'HIGH':
      return {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        text: 'text-amber-700',
        badge: 'bg-amber-100 text-amber-800 border-amber-200',
        dot: 'bg-amber-500',
        glow: 'shadow-amber-100',
      };
    case 'MEDIUM':
      return {
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        text: 'text-yellow-700',
        badge: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        dot: 'bg-yellow-500',
        glow: 'shadow-yellow-100',
      };
    case 'LOW':
    default:
      return {
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        text: 'text-emerald-700',
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        dot: 'bg-emerald-500',
        glow: 'shadow-emerald-100',
      };
  }
};

export const ProductionRiskRadar: React.FC = () => {
  const navigate = useNavigate();
  const {
    activeDataset,
    filteredRecords,
    riskRadar,
    filters,
    setFilters,
  } = useProductionData();

  // Component state
  const [selectedMachineFilter, setSelectedMachineFilter] = useState<string>('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [selectedEvidenceRisk, setSelectedEvidenceRisk] = useState<RiskRadarItem | null>(null);

  // If no dataset or 0 records, display clean empty state
  if (!activeDataset || filteredRecords.length === 0) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Radar className="w-5 h-5 text-blue-600" />
            Production Risk Radar
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Early-warning insights from production trends and operating conditions.
          </p>
        </div>
        <EmptyState />
      </div>
    );
  }

  const { summary, risks, heatmap, trend, hasSufficientHistoricalData, missingDataNotes } = riskRadar;

  // Filtered risks based on machine & category filters
  const displayRisks = useMemo(() => {
    return risks.filter((r) => {
      if (selectedMachineFilter !== 'ALL' && r.machineId !== selectedMachineFilter) {
        return false;
      }
      if (selectedCategoryFilter !== 'ALL' && r.category !== selectedCategoryFilter) {
        return false;
      }
      return true;
    });
  }, [risks, selectedMachineFilter, selectedCategoryFilter]);

  // Unique machines for filters
  const machineList = useMemo(() => {
    return heatmap.map((h) => h.machineId);
  }, [heatmap]);

  // Prepare trend data for chart
  const chartData = useMemo(() => {
    if (!trend || trend.length === 0) return [];
    return trend.map((point) => {
      const entry: Record<string, string | number> = {
        label: point.label,
        Overall: point.overallScore,
      };

      if (selectedMachineFilter !== 'ALL' && point.machineScores[selectedMachineFilter] !== undefined) {
        entry[selectedMachineFilter] = point.machineScores[selectedMachineFilter];
      }

      if (selectedCategoryFilter !== 'ALL') {
        const catKey = selectedCategoryFilter as RiskCategory;
        if (point.categoryScores[catKey] !== undefined) {
          entry[catKey] = point.categoryScores[catKey];
        }
      }

      return entry;
    });
  }, [trend, selectedMachineFilter, selectedCategoryFilter]);

  // Navigation handlers
  const handleInvestigate = (risk: RiskRadarItem) => {
    const params = new URLSearchParams();
    if (activeDataset?.id) params.set('dataset', activeDataset.id);
    params.set('machine', risk.machineId);
    params.set('riskType', risk.category);
    if (filters.dateRange.start) params.set('start', filters.dateRange.start);
    if (filters.dateRange.end) params.set('end', filters.dateRange.end);
    navigate(`/root-causes?${params.toString()}`);
  };

  const handleSimulate = (risk: RiskRadarItem, presetDt?: number) => {
    const params = new URLSearchParams();
    params.set('machine', risk.machineId);
    params.set('risk', risk.category);
    const dt = presetDt ?? risk.suggestedSimLever?.downtimeReductionPercent ?? 20;
    params.set('dt', dt.toString());
    navigate(`/simulator?${params.toString()}`);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 font-sans">
      {/* 1. TOP HEADER */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Radar className="w-5 h-5 text-blue-600" />
            Production Risk Radar
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Early-warning insights from production trends and operating conditions.
          </p>
        </div>

        {/* Global Dataset Status Badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Active: <strong className="text-slate-800">{activeDataset.name}</strong>
          </span>
          <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700">
            {summary.totalActiveMachines} Machines Monitored
          </span>
        </div>
      </div>

      {/* MISSING DATA NOTICES (Strict compliance with Section 12) */}
      {missingDataNotes.length > 0 && (
        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Dataset Schema & Capability Notices</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-amber-700">
            {missingDataNotes.map((note, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                <span>{note}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Critical Risks */}
        <div className="p-4 rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50/70 to-white shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider block">
              Critical Risks
            </span>
            <div className="text-2xl font-black text-rose-900 mt-1 font-mono">
              {summary.criticalCount}
            </div>
            <span className="text-[11px] text-rose-600">Immediate attention needed</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
            <AlertOctagon className="w-5 h-5" />
          </div>
        </div>

        {/* High Risks */}
        <div className="p-4 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50/70 to-white shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider block">
              High Risks
            </span>
            <div className="text-2xl font-black text-amber-900 mt-1 font-mono">
              {summary.highCount}
            </div>
            <span className="text-[11px] text-amber-600">Deteriorating constraint</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* Medium Risks */}
        <div className="p-4 rounded-xl border border-yellow-200 bg-gradient-to-br from-yellow-50/70 to-white shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-yellow-700 uppercase tracking-wider block">
              Medium Risks
            </span>
            <div className="text-2xl font-black text-yellow-900 mt-1 font-mono">
              {summary.mediumCount}
            </div>
            <span className="text-[11px] text-yellow-600">Moderate variance detected</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center text-yellow-600">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        {/* Stable */}
        <div className="p-4 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-white shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider block">
              Stable
            </span>
            <div className="text-2xl font-black text-emerald-900 mt-1 font-mono">
              {summary.stableCount}
            </div>
            <span className="text-[11px] text-emerald-600">Within acceptable limits</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 8. MACHINE RISK HEATMAP */}
      <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              Machine Risk Heatmap
            </h3>
            <p className="text-[11px] text-slate-500">
              Cross-category evaluation per equipment asset. Click any machine row to isolate its risk cards.
            </p>
          </div>
          {selectedMachineFilter !== 'ALL' && (
            <button
              onClick={() => setSelectedMachineFilter('ALL')}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 self-start sm:self-auto"
            >
              Reset machine focus ({selectedMachineFilter})
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50">
                <th className="py-2.5 px-3 font-semibold">Machine</th>
                <th className="py-2.5 px-3 font-semibold text-center">Bottleneck</th>
                <th className="py-2.5 px-3 font-semibold text-center">Downtime</th>
                <th className="py-2.5 px-3 font-semibold text-center">Cycle</th>
                <th className="py-2.5 px-3 font-semibold text-center">Quality</th>
                <th className="py-2.5 px-3 font-semibold text-center">Target</th>
                <th className="py-2.5 px-3 font-semibold text-right">Composite Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {heatmap.map((row) => {
                const isSelected = selectedMachineFilter === row.machineId;
                const compColors = getSeverityColor(row.compositeSeverity);

                const renderCell = (
                  cell: { severity: RiskSeverity; score: number; available: boolean; unavailableReason?: string }
                ) => {
                  if (!cell.available) {
                    return (
                      <span
                        title={cell.unavailableReason || 'Data not provided'}
                        className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-400 border border-slate-200 cursor-help"
                      >
                        N/A
                      </span>
                    );
                  }
                  const colors = getSeverityColor(cell.severity);
                  return (
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${colors.badge}`}
                    >
                      {cell.severity}
                    </span>
                  );
                };

                return (
                  <tr
                    key={row.machineId}
                    onClick={() =>
                      setSelectedMachineFilter(isSelected ? 'ALL' : row.machineId)
                    }
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50/80 font-bold border-l-4 border-l-blue-600'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${compColors.dot}`}
                        />
                        {row.machineId}
                        {row.lineId && (
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({row.lineId})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">{renderCell(row.bottleneck)}</td>
                    <td className="py-3 px-3 text-center">{renderCell(row.downtime)}</td>
                    <td className="py-3 px-3 text-center">{renderCell(row.cycle)}</td>
                    <td className="py-3 px-3 text-center">{renderCell(row.quality)}</td>
                    <td className="py-3 px-3 text-center">{renderCell(row.target)}</td>
                    <td className="py-3 px-3 text-right">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold font-mono border ${compColors.badge}`}>
                        {row.compositeScore} / 100
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. RISK TREND CHART */}
      <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Risk Trend Time-Series
            </h3>
            <p className="text-[11px] text-slate-500">
              Historical progression of calculated risk scores across operating intervals.
            </p>
          </div>

          {/* Interactive Chart Filters */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Machine Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <Filter className="w-3 h-3 text-slate-400" />
              <select
                value={selectedMachineFilter}
                onChange={(e) => setSelectedMachineFilter(e.target.value)}
                className="bg-transparent text-slate-700 font-medium focus:outline-none text-xs"
              >
                <option value="ALL">All Machines</option>
                {machineList.map((m) => (
                  <option key={m} value={m}>
                    Machine: {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Risk Category Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="bg-transparent text-slate-700 font-medium focus:outline-none text-xs"
              >
                <option value="ALL">All Risk Types</option>
                <option value="bottleneck">Bottleneck Risk</option>
                <option value="downtime">Downtime Risk</option>
                <option value="cycle_time">Cycle-Time Risk</option>
                <option value="quality">Quality Risk</option>
                <option value="target_achievement">Target Risk</option>
              </select>
            </div>
          </div>
        </div>

        {/* Chart Render or Insufficient Data State */}
        {!hasSufficientHistoricalData ? (
          <div className="p-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-300 text-slate-500 text-xs space-y-1.5">
            <Clock className="w-5 h-5 text-slate-400 mx-auto mb-1" />
            <p className="font-semibold text-slate-700">
              Insufficient historical data for trend-based risk detection.
            </p>
            <p className="text-[11px] text-slate-400">
              At least two chronological intervals or timestamped production runs are required for time-series projection.
            </p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-lg text-slate-400 text-xs">
            No trend points available for the selected filters.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Line
                  type="monotone"
                  dataKey="Overall"
                  name="Composite Risk"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#2563eb' }}
                  activeDot={{ r: 6 }}
                />
                {selectedMachineFilter !== 'ALL' && (
                  <Line
                    type="monotone"
                    dataKey={selectedMachineFilter}
                    name={`Machine ${selectedMachineFilter}`}
                    stroke="#dc2626"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 4, fill: '#dc2626' }}
                  />
                )}
                {selectedCategoryFilter !== 'ALL' && (
                  <Line
                    type="monotone"
                    dataKey={selectedCategoryFilter}
                    name={`Risk: ${selectedCategoryFilter}`}
                    stroke="#ea580c"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#ea580c' }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 5. RISK CARDS (Active detected risks) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-bold text-slate-800">
              Active Production Risk Radar Alerts ({displayRisks.length})
            </h2>
          </div>
          {(selectedMachineFilter !== 'ALL' || selectedCategoryFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSelectedMachineFilter('ALL');
                setSelectedCategoryFilter('ALL');
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear filters
            </button>
          )}
        </div>

        {displayRisks.length === 0 ? (
          <div className="p-8 rounded-xl bg-white border border-slate-200 text-center text-slate-500 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <h4 className="text-sm font-bold text-slate-700">No Elevated Risks Detected</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Operating conditions across the selected dataset filters are stable and within safe tolerances.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayRisks.map((risk) => {
              const colors = getSeverityColor(risk.severity);

              return (
                <div
                  key={risk.id}
                  className={`p-5 rounded-xl border bg-white shadow-sm flex flex-col justify-between transition-all hover:shadow-md ${colors.border}`}
                >
                  <div className="space-y-3">
                    {/* Top Tag & Machine */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${colors.badge}`}>
                          {risk.severity} RISK
                        </span>
                        <span className="text-xs font-bold text-slate-800 font-mono">
                          Machine {risk.machineId}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {risk.categoryLabel}
                      </span>
                    </div>

                    {/* Title & Score */}
                    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 leading-snug">
                          {risk.title}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                          {risk.details}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-400 uppercase font-mono block">
                          Risk Score
                        </span>
                        <span className={`text-lg font-black font-mono ${colors.text}`}>
                          {risk.riskScore} <span className="text-xs text-slate-400 font-normal">/ 100</span>
                        </span>
                      </div>
                    </div>

                    {/* Evidence Highlights */}
                    <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Evidence Highlights
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        {risk.evidenceHighlights.map((ev, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between bg-white p-1.5 rounded border border-slate-200"
                          >
                            <span className="text-slate-600 truncate">{ev.label}</span>
                            <span
                              className={`font-bold flex items-center gap-0.5 ${
                                ev.isDeteriorating ? 'text-rose-600' : 'text-emerald-600'
                              }`}
                            >
                              <span>{ev.prefix}</span>
                              <span>{ev.change}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recommendation */}
                    <div className="p-2.5 rounded bg-blue-50/60 border border-blue-100 text-xs text-blue-900 space-y-1">
                      <div className="text-[10px] uppercase font-bold text-blue-700 tracking-wider">
                        Recommended Action
                      </div>
                      <p className="text-slate-700 text-[11px] leading-relaxed">
                        {risk.recommendation}
                      </p>
                    </div>
                  </div>

                  {/* Actions: View Evidence, Investigate, Simulate Improvement */}
                  <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setSelectedEvidenceRisk(risk)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
                    >
                      View Evidence
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSimulate(risk)}
                        className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-all flex items-center gap-1"
                        title="Simulate improvement scenario in What-If Simulator"
                      >
                        <Sliders className="w-3.5 h-3.5 text-blue-600" />
                        Simulate
                      </button>

                      <button
                        onClick={() => handleInvestigate(risk)}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all flex items-center gap-1 shadow-sm"
                        title="Connect to Root-Cause Explorer"
                      >
                        <Search className="w-3.5 h-3.5" />
                        Investigate
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. EVIDENCE PANEL MODAL */}
      {selectedEvidenceRisk && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-5 p-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <Radar className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Why is this at risk?
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Diagnostic evidence panel for Machine {selectedEvidenceRisk.machineId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEvidenceRisk(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Diagnostic Summary */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 font-mono text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Machine</span>
                  <strong className="text-slate-800 text-sm">
                    {selectedEvidenceRisk.machineId}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Risk Type</span>
                  <strong className="text-slate-800 text-xs">
                    {selectedEvidenceRisk.categoryLabel}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Current Risk</span>
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border mt-0.5 ${
                      getSeverityColor(selectedEvidenceRisk.severity).badge
                    }`}
                  >
                    {selectedEvidenceRisk.severity}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Risk Score</span>
                  <strong className="text-blue-600 text-sm">
                    {selectedEvidenceRisk.riskScore} / 100
                  </strong>
                </div>
              </div>

              <p className="text-xs text-slate-600 font-sans border-t border-slate-200 pt-2 leading-relaxed">
                {selectedEvidenceRisk.details}
              </p>
            </div>

            {/* EVIDENCE COMPARISON TABLE */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
                Historical Period Comparison (Evidence)
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs font-mono">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Observed Indicator</th>
                      <th className="py-2.5 px-3 font-semibold">Previous Period</th>
                      <th className="py-2.5 px-3 font-semibold">Current Period</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Measured Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedEvidenceRisk.evidenceMetrics.map((m, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-bold text-slate-700">{m.name}</td>
                        <td className="py-2.5 px-3 text-slate-500">{m.previous}</td>
                        <td className="py-2.5 px-3 text-slate-800 font-semibold">{m.current}</td>
                        <td
                          className={`py-2.5 px-3 text-right font-bold ${
                            m.isDeteriorating ? 'text-rose-600' : 'text-emerald-600'
                          }`}
                        >
                          {m.change}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Evidence-Based Recommendation */}
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-2">
              <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Evidence-Based Recommendation
              </h4>
              <p className="text-xs text-slate-700 leading-relaxed font-sans">
                {selectedEvidenceRisk.recommendation}
              </p>
            </div>

            {/* Quick Actions inside modal */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
              <span className="text-[11px] text-slate-400 font-mono">
                All measurements dynamically computed from uploaded dataset.
              </span>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleSimulate(selectedEvidenceRisk)}
                  className="w-full sm:w-auto px-4 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-700 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  Simulate Improvement
                </button>
                <button
                  type="button"
                  onClick={() => handleInvestigate(selectedEvidenceRisk)}
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Search className="w-3.5 h-3.5" />
                  Investigate Contributing Factors
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ProductionRiskRadar;
