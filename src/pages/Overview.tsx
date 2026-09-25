import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Gauge,
  Flame,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  Layers,
  Clock,
  CheckCircle,
  Activity,
} from 'lucide-react';
import { useProductionData } from '../context/ProductionDataContext';
import { useAuth } from '../context/AuthContext';
import { MetricCard } from '../components/common/MetricCard';
import { EmptyState } from '../components/common/EmptyState';
import { DatasetLoadingScreen } from '../components/common/DatasetLoadingScreen';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export const Overview: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    activeDataset,
    filteredRecords,
    oee,
    losses,
    currentBottleneck,
    predictiveBottlenecks,
    targetRisk,
    isAnalyzing,
    setIsAnalyzing,
    loadingDatasetName,
  } = useProductionData();

  // Show dedicated analytics loading screen when a new dataset is being processed
  if (isAnalyzing) {
    return (
      <DatasetLoadingScreen
        datasetName={loadingDatasetName || activeDataset?.name || 'Production Telemetry'}
        rowCount={activeDataset?.row_count}
        autoProgress={true}
        onFinish={() => setIsAnalyzing(false)}
      />
    );
  }

  if (!activeDataset || filteredRecords.length === 0) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="border-b border-slate-200 pb-4">
          <h1 className="text-xl font-bold tracking-tight text-slate-800">
            FLOWFORGE AI — Production Intelligence Platform
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time constraint discovery, loss attribution, and yield optimization.
          </p>
        </div>
        <EmptyState />
      </div>
    );
  }

  // Emerging bottleneck from time-series slope
  const emergingBottleneck = predictiveBottlenecks.length > 0 ? predictiveBottlenecks[0] : null;

  // Prepare chart data for Machine Comparison
  const machineChartData = Array.from(
    filteredRecords.reduce((map, r) => {
      const mId = r.machine_id;
      if (!map.has(mId)) {
        map.set(mId, { machine: mId, actual: 0, target: 0, downtime: 0 });
      }
      const item = map.get(mId)!;
      item.actual += r.actual_quantity ?? r.total_units ?? 0;
      item.target += r.target_quantity ?? 0;
      item.downtime += r.downtime ?? 0;
      return map;
    }, new Map<string, { machine: string; actual: number; target: number; downtime: number }>()).values()
  );

  // Dynamic alerts derived strictly from calculations
  const alerts: { title: string; desc: string; type: 'warning' | 'danger' | 'info' }[] = [];
  if (targetRisk.riskLevel === 'HIGH') {
    alerts.push({
      title: 'Target Shortfall Alert',
      desc: `Projected completion is ${targetRisk.projectedOutput} vs ${targetRisk.target} target (${targetRisk.projectedDeficit} unit deficit). Required rate: ${targetRisk.requiredRunRate} units/hr.`,
      type: 'danger',
    });
  }
  if (currentBottleneck && currentBottleneck.bottleneckScore >= 40) {
    alerts.push({
      title: `Critical Constraint on ${currentBottleneck.machineId}`,
      desc: `Machine ${currentBottleneck.machineId} generated ${currentBottleneck.totalDowntime}m downtime. Primary loss: ${currentBottleneck.primaryObservedLoss}.`,
      type: 'warning',
    });
  }
  if (oee.defectRate && oee.defectRate > 2.0) {
    alerts.push({
      title: 'Elevated Defect Rate Detected',
      desc: `Defect rate is currently ${oee.defectRate.toFixed(1)}% across evaluated production batches.`,
      type: 'warning',
    });
  }
  if (alerts.length === 0) {
    alerts.push({
      title: 'Production Balanced',
      desc: 'All machines are operating within balanced tolerance limits with no acute shortfalls flagged.',
      type: 'info',
    });
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            FLOWFORGE AI — Executive Intelligence Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Dataset: <span className="text-blue-600 font-semibold">{activeDataset.name}</span> |{' '}
            {filteredRecords.length} records evaluated | Data Quality:{' '}
            <span className="text-emerald-600 font-semibold">{activeDataset.data_quality_score}%</span>
          </p>
        </div>

        {user?.role === 'Operator' ? (
          <button
            onClick={() => navigate('/oee')}
            className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg transition-all shadow-sm"
          >
            View Live OEE & Production
            <ArrowRight className="w-3.5 h-3.5 text-emerald-500" />
          </button>
        ) : (
          <button
            onClick={() => navigate('/bottlenecks')}
            className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg transition-all shadow-sm"
          >
            View Bottleneck Rankings
            <ArrowRight className="w-3.5 h-3.5 text-blue-500" />
          </button>
        )}
      </div>

      {/* 6 KEY METRIC CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard
          label="Overall OEE"
          value={oee.oee !== null ? oee.oee : null}
          unit="%"
          icon={Gauge}
          status={oee.oee && oee.oee >= 75 ? 'success' : oee.oee && oee.oee >= 60 ? 'warning' : 'danger'}
          formula="Availability × Performance × Quality"
          subtext={oee.oee ? 'World-Class Target: 85%' : undefined}
          unavailableReason={oee.unavailabilityReasons[0]}
        />
        <MetricCard
          label="Availability"
          value={oee.availability !== null ? oee.availability : null}
          unit="%"
          icon={Clock}
          status={oee.availability && oee.availability >= 85 ? 'success' : 'warning'}
          formula="Operating Time / Planned Production Time"
          subtext={`${oee.totalDowntime}m total downtime`}
        />
        <MetricCard
          label="Performance"
          value={oee.performance !== null ? oee.performance : null}
          unit="%"
          icon={Activity}
          status={oee.performance && oee.performance >= 90 ? 'success' : 'warning'}
          formula="(Ideal Cycle Time × Output) / Operating Time"
          subtext={oee.cycleTimeDeviation ? `Cycle dev: +${oee.cycleTimeDeviation}s` : 'Speed velocity'}
        />
        <MetricCard
          label="Quality Yield"
          value={oee.quality !== null ? oee.quality : null}
          unit="%"
          icon={CheckCircle}
          status={oee.quality && oee.quality >= 98 ? 'success' : 'warning'}
          formula="Good Units / Total Units"
          subtext={oee.defectRate ? `${oee.defectRate}% defect rate` : undefined}
        />
        <MetricCard
          label="Total Output"
          value={oee.totalActualQuantity.toLocaleString()}
          unit="units"
          icon={Layers}
          status="normal"
          subtext={`Target: ${oee.totalTargetQuantity.toLocaleString()}`}
        />
        <MetricCard
          label="Target Achieved"
          value={oee.targetAchievementRate !== null ? oee.targetAchievementRate : null}
          unit="%"
          icon={TrendingDown}
          status={
            oee.targetAchievementRate && oee.targetAchievementRate >= 95
              ? 'success'
              : oee.targetAchievementRate && oee.targetAchievementRate >= 85
              ? 'warning'
              : 'danger'
          }
          subtext={oee.productionGap > 0 ? `Gap: ${oee.productionGap.toLocaleString()} units` : 'On target'}
        />
      </div>

      {/* HIGHLIGHT SECTION: BOTTLENECKS & TARGET RISK */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CURRENT BOTTLENECK CARD */}
        <div className="p-5 rounded-xl border border-rose-200 bg-rose-50 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-2 text-xs font-semibold text-rose-700 uppercase tracking-wider">
                <Flame className="w-4 h-4 text-rose-500" />
                Current Constraint (Rank #1)
              </span>
              {currentBottleneck && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">
                  Score: {currentBottleneck.bottleneckScore}/100
                </span>
              )}
            </div>

            {currentBottleneck ? (
              <div className="space-y-3">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">{currentBottleneck.machineId}</h3>
                  <p className="text-xs text-slate-600">
                    Primary Loss Mode:{' '}
                    <span className="text-amber-600 font-medium">{currentBottleneck.primaryObservedLoss}</span>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-rose-200">
                  <div className="bg-white p-2 rounded border border-rose-100">
                    <span className="text-slate-500 text-[10px] block">Machine OEE</span>
                    <span className="text-slate-800 font-bold">
                      {currentBottleneck.oee !== null ? `${currentBottleneck.oee}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded border border-rose-100">
                    <span className="text-slate-500 text-[10px] block">Downtime</span>
                    <span className="text-rose-600 font-bold">{currentBottleneck.totalDowntime} mins</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-rose-100">
                    <span className="text-slate-500 text-[10px] block">Cycle Deviation</span>
                    <span className="text-slate-800 font-bold">+{currentBottleneck.cycleDeviation}s</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-rose-100">
                    <span className="text-slate-500 text-[10px] block">Actual Output</span>
                    <span className="text-slate-800 font-bold">{currentBottleneck.output.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No machine bottlenecks identified.</p>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-rose-200">
            <button
              onClick={() => navigate('/root-causes')}
              className="w-full flex items-center justify-center gap-2 py-2 bg-white hover:bg-rose-50 text-rose-700 text-xs font-medium rounded-lg border border-rose-200 transition-all"
            >
              Explore Root Cause
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* EMERGING BOTTLENECK / PREDICTIVE RISK */}
        <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-2 text-xs font-semibold text-amber-700 uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Emerging Bottleneck Risk
              </span>
              {emergingBottleneck?.sufficientData && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                  Risk: {emergingBottleneck.riskProbability}%
                </span>
              )}
            </div>

            {emergingBottleneck && emergingBottleneck.sufficientData ? (
              <div className="space-y-3">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">{emergingBottleneck.machineId}</h3>
                  <p className="text-xs text-slate-500">
                    Downtime Drift Slope:{' '}
                    <span className="font-mono text-blue-600 font-medium">
                      {emergingBottleneck.trendSlope >= 0 ? '+' : ''}
                      {emergingBottleneck.trendSlope}m / interval
                    </span>
                  </p>
                </div>
                <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded border border-slate-200 leading-relaxed">
                  {emergingBottleneck.evidence}
                </p>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded border border-dashed border-slate-300 text-slate-500 text-xs leading-relaxed">
                Insufficient historical time-series intervals for predictive bottleneck trend analysis.
                Requires at least 3 timestamped sequence points.
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200">
            <button
              onClick={() => navigate('/bottlenecks')}
              className="w-full flex items-center justify-center gap-2 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 transition-all"
            >
              Analyze Machine Trends
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* TARGET RISK & FORECAST */}
        <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
                Target Risk & Projection
              </span>
              <span
                className={`text-[11px] font-mono px-2 py-0.5 rounded font-bold ${
                  targetRisk.riskLevel === 'HIGH'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : targetRisk.riskLevel === 'MEDIUM'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {targetRisk.riskLevel} RISK
              </span>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                  <span className="text-slate-500 text-[10px] block">Target Units</span>
                  <span className="text-slate-800 font-bold">{targetRisk.target.toLocaleString()}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                  <span className="text-slate-500 text-[10px] block">Projected Total</span>
                  <span className="text-blue-600 font-bold">{targetRisk.projectedOutput.toLocaleString()}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                  <span className="text-slate-500 text-[10px] block">Current Velocity</span>
                  <span className="text-slate-800 font-bold">{targetRisk.currentRunRate} u/hr</span>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                  <span className="text-slate-500 text-[10px] block">Required Velocity</span>
                  <span className="text-amber-600 font-bold">{targetRisk.requiredRunRate} u/hr</span>
                </div>
              </div>

              <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">{targetRisk.reasoning}</p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200">
            <button
              onClick={() => navigate('/target-risk')}
              className="w-full flex items-center justify-center gap-2 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 transition-all"
            >
              Open Target Forecaster
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* CHARTS & LOSS DISTRIBUTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Machine Target vs Actual Chart */}
        <div className="lg:col-span-2 p-5 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Machine Output vs Planned Target</h3>
            <span className="text-xs text-slate-400 font-mono">Actual Units</span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={machineChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="machine" stroke="#94a3b8" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  labelStyle={{ color: '#1e293b', fontWeight: 'bold' }}
                  itemStyle={{ color: '#475569' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px', color: '#64748b' }} />
                <Bar dataKey="actual" name="Actual Produced" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="target" name="Target Plan" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Six Big Losses Contribution */}
        <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-700">Loss Distribution (Six Big Losses)</h3>
              <span className="text-xs text-slate-400 font-mono">{losses.totalLossMinutes}m total</span>
            </div>

            <div className="space-y-4">
              {/* Availability Loss */}
              <div
                onClick={() => navigate('/losses')}
                className="p-3 rounded-lg bg-slate-50 border border-slate-200 hover:border-blue-400 cursor-pointer transition-all"
              >
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700">Availability Loss</span>
                  <span className="font-mono text-blue-600">{losses.availabilityLossPercent}%</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full"
                    style={{ width: `${losses.availabilityLossPercent}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {losses.availabilityLossMinutes} mins (Breakdown, Changeover)
                </span>
              </div>

              {/* Performance Loss */}
              <div
                onClick={() => navigate('/losses')}
                className="p-3 rounded-lg bg-slate-50 border border-slate-200 hover:border-amber-400 cursor-pointer transition-all"
              >
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700">Performance Loss</span>
                  <span className="font-mono text-amber-600">{losses.performanceLossPercent}%</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full"
                    style={{ width: `${losses.performanceLossPercent}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {losses.performanceLossMinutes} mins (Speed loss, Minor stops)
                </span>
              </div>

              {/* Quality Loss */}
              <div
                onClick={() => navigate('/losses')}
                className="p-3 rounded-lg bg-slate-50 border border-slate-200 hover:border-rose-400 cursor-pointer transition-all"
              >
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700">Quality Loss</span>
                  <span className="font-mono text-rose-600">{losses.qualityLossPercent}%</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-500 h-full rounded-full"
                    style={{ width: `${losses.qualityLossPercent}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {losses.qualityLossMinutes} mins (Scrap, Rework)
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/losses')}
            className="w-full mt-4 flex items-center justify-center gap-1.5 py-2 text-xs text-blue-600 hover:text-blue-700 font-medium transition-all"
          >
            Inspect Interactive Loss Tree
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* DYNAMIC SYSTEM ALERTS */}
      <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Active Production Alerts (Grounded in Verified Data)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {alerts.map((alt, i) => (
            <div
              key={i}
              className={`p-3 rounded-lg border text-xs leading-relaxed ${
                alt.type === 'danger'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : alt.type === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}
            >
              <div className="font-bold mb-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-current" />
                {alt.title}
              </div>
              <p className="text-slate-600">{alt.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
