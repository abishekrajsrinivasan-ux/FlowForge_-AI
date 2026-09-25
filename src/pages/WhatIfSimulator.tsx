import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Sliders,
  Save,
  RotateCcw,
  TrendingUp,
  Check,
  ArrowRight,
  Info,
  AlertTriangle,
  AlertCircle,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Zap,
  Clock,
  Target,
  Flame,
  Download,
} from 'lucide-react';
import { useProductionData } from '../context/ProductionDataContext';
import { simulateScenario } from '../engine/simulatorEngine';
import { generateSimulationReport } from '../utils/simulationReportGenerator';
import confetti from 'canvas-confetti';

export const WhatIfSimulator: React.FC = () => {
  const { activeDataset, filteredRecords, scenarios, saveScenario, currentBottleneck } = useProductionData();
  const [searchParams] = useSearchParams();
  const dtParam = searchParams.get('dt');
  const machineParam = searchParams.get('machine');
  const riskParam = searchParams.get('risk');

  // Levers state (defaults start at realistic Kaizen level)
  const [downtimeReduction, setDowntimeReduction] = useState<number>(15); // %
  const [cycleImprovement, setCycleImprovement] = useState<number>(10); // %
  const [defectReduction, setDefectReduction] = useState<number>(25); // %
  const [scenarioName, setScenarioName] = useState('Predictive Maintenance & SMED Overhaul');
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);

  useEffect(() => {
    if (dtParam) {
      const val = parseInt(dtParam, 10);
      if (!isNaN(val) && val >= 0 && val <= 100) {
        setDowntimeReduction(val);
        setScenarioName(
          `Risk Mitigation for Machine ${machineParam || 'Line'} (-${val}% Downtime)`
        );
      }
    }
  }, [dtParam, machineParam]);

  // Compute live simulation comparison with risk prediction
  const simulationResult = useMemo(() => {
    return simulateScenario(filteredRecords, {
      downtimeReductionPercent: downtimeReduction,
      cycleTimeImprovementPercent: cycleImprovement,
      defectReductionPercent: defectReduction,
    });
  }, [filteredRecords, downtimeReduction, cycleImprovement, defectReduction]);

  const { baseline, simulated, delta, riskAssessment } = simulationResult;

  // Preset Handlers
  const handleApplyPreset = (dt: number, cy: number, df: number, name: string) => {
    setDowntimeReduction(dt);
    setCycleImprovement(cy);
    setDefectReduction(df);
    setScenarioName(name);
  };

  const handleReset = () => {
    setDowntimeReduction(0);
    setCycleImprovement(0);
    setDefectReduction(0);
    setScenarioName('Baseline Unmitigated Run');
  };

  const handleSaveScenario = async () => {
    await saveScenario({
      dataset_id: activeDataset?.id || 'ds_default',
      name: scenarioName || `Scenario ${Date.now()}`,
      downtime_reduction: downtimeReduction,
      cycle_improvement: cycleImprovement,
      quality_improvement: defectReduction,
      baseline_oee: baseline.oee ?? 0,
      simulated_oee: simulated.oee ?? 0,
      baseline_output: baseline.output,
      simulated_output: simulated.output,
      potential_gain: delta.outputGain,
    });

    setIsSavedSuccess(true);
    confetti({ particleCount: 60, spread: 60, origin: { y: 0.8 } });
    setTimeout(() => setIsSavedSuccess(false), 3000);
  };

  const handleDownloadReport = () => {
    generateSimulationReport({
      datasetName: activeDataset?.name || 'Production Dataset',
      totalRecordsEvaluated: filteredRecords.length,
      dataQualityScore: activeDataset?.data_quality_score ?? 100,
      scenarioName: scenarioName || 'What-If Simulation',
      downtimeReduction,
      cycleImprovement,
      defectReduction,
      simulationResult: simulationResult,
      currentBottleneck: currentBottleneck ?? null,
      timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
    });
  };

  // Quota fulfillment percentage
  const baselineQuotaPct =
    baseline.targetTotal > 0
      ? Math.min(120, Math.round((baseline.output / baseline.targetTotal) * 100))
      : 85;
  const simulatedQuotaPct =
    baseline.targetTotal > 0
      ? Math.min(140, Math.round((simulated.output / baseline.targetTotal) * 100))
      : 95;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-600" />
            What-If Production Optimization &amp; Risk Simulator
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Dynamic engineering sandbox adjusting operational intervention levers with real-time target risk forecasting.
          </p>
        </div>

        {/* Quick Simulation Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium text-slate-500 mr-1">Presets:</span>

          <button
            onClick={() => handleApplyPreset(2, 1, 2, 'Low Intervention (High Risk Baseline)')}
            className="px-2.5 py-1 text-xs font-semibold rounded bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors flex items-center gap-1 shadow-sm"
            title="Set levers to minimum to trigger high risk warning"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            Low Levers (Trigger Risk Warning)
          </button>
          <button
            onClick={() => handleApplyPreset(15, 10, 25, 'Standard Continuous Improvement')}
            className="px-2.5 py-1 text-xs font-medium rounded bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
          >
            Moderate Kaizen
          </button>
          <button
            onClick={() => handleApplyPreset(35, 25, 55, 'Aggressive SMED & Line Overhaul')}
            className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center gap-1 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            Aggressive (Zero Risk)
          </button>
          <button
            onClick={handleReset}
            className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 rounded border border-slate-200 hover:bg-slate-100 transition-colors flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        </div>
      </div>

      {/* RISK RADAR CONTEXT BANNER – shown when opened from Production Risk Radar */}
      {machineParam && riskParam && (
        <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-between text-xs text-indigo-800 font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
            <span>
              Simulating Risk Mitigation for Machine: <strong>{machineParam}</strong>
              <span> · Risk Type: {riskParam.replace('_', ' ')}</span>
            </span>
          </div>
          <span className="text-[11px] text-indigo-600">Pre-loaded from Production Risk Radar</span>
        </div>
      )}

      {/* DYNAMIC RISK PREDICTION WARNING BANNER */}
      <div
        className={`p-5 rounded-xl border transition-all duration-300 shadow-sm ${
          riskAssessment.riskSeverity === 'CRITICAL'
            ? 'bg-rose-50 border-rose-300 text-rose-900 ring-2 ring-rose-200'
            : riskAssessment.riskSeverity === 'WARNING'
            ? 'bg-amber-50 border-amber-300 text-amber-900 ring-1 ring-amber-200'
            : 'bg-emerald-50 border-emerald-300 text-emerald-900'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`p-2.5 rounded-lg shrink-0 ${
                riskAssessment.riskSeverity === 'CRITICAL'
                  ? 'bg-rose-200 text-rose-800 animate-pulse'
                  : riskAssessment.riskSeverity === 'WARNING'
                  ? 'bg-amber-200 text-amber-800'
                  : 'bg-emerald-200 text-emerald-800'
              }`}
            >
              {riskAssessment.riskSeverity === 'CRITICAL' ? (
                <AlertTriangle className="w-6 h-6 text-rose-700" />
              ) : riskAssessment.riskSeverity === 'WARNING' ? (
                <AlertCircle className="w-6 h-6 text-amber-700" />
              ) : (
                <ShieldCheck className="w-6 h-6 text-emerald-700" />
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-extrabold uppercase tracking-wider px-2 py-0.5 rounded ${
                    riskAssessment.riskSeverity === 'CRITICAL'
                      ? 'bg-rose-200 text-rose-800'
                      : riskAssessment.riskSeverity === 'WARNING'
                      ? 'bg-amber-200 text-amber-800'
                      : 'bg-emerald-200 text-emerald-800'
                  }`}
                >
                  Risk Status: {simulated.riskLevel}
                </span>
                <span className="text-xs font-bold text-slate-800">
                  {riskAssessment.warningTitle}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-slate-700 max-w-3xl">
                {riskAssessment.warningDescription}
              </p>
            </div>
          </div>

          {/* Right Risk Badge & Shortfall */}
          <div className="shrink-0 md:text-right border-t md:border-t-0 md:border-l border-slate-200 md:pl-5 pt-3 md:pt-0">
            <span className="text-[10px] uppercase font-mono tracking-wider block text-slate-500">
              Projected Quota Deficit
            </span>
            <div className="flex items-baseline gap-1 md:justify-end">
              <span
                className={`text-2xl font-black font-mono ${
                  simulated.targetGap > 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                {simulated.targetGap > 0
                  ? `-${simulated.targetGap.toLocaleString()}`
                  : '+0 (Quota Met!)'}
              </span>
              <span className="text-xs text-slate-500 font-mono">units</span>
            </div>
            <span className="text-[11px] font-mono text-slate-500 block mt-0.5">
              Risk Score: <strong className="text-slate-700">{simulated.riskScore}/100</strong>
            </span>
          </div>
        </div>
      </div>

      {/* INTERACTIVE LEVERS PANEL */}
      <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800">
              Continuous Improvement Intervention Levers
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-mono font-bold border border-blue-200">
              Live Interactivity Enabled
            </span>
          </div>
          <span className="text-xs text-slate-400">
            Drag any slider to instantly simulate OEE, yield, and target risk
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Lever 1: Downtime Reduction */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              riskAssessment.leverWarnings.downtime
                ? 'bg-rose-50/60 border-rose-300'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex justify-between items-center text-xs font-mono mb-2">
              <span className="text-slate-700 font-bold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                Downtime Reduction
              </span>
              <span className="text-blue-600 font-extrabold text-sm px-2 py-0.5 rounded bg-blue-50 border border-blue-200">
                {downtimeReduction}%
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="60"
              step="1"
              value={downtimeReduction}
              onChange={(e) => setDowntimeReduction(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
            />

            <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
              <span>0% (None)</span>
              <span>30%</span>
              <span>60% (Max)</span>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-200/80 space-y-1">
              <p className="text-[11px] text-slate-600 font-mono">
                Recovered Runtime: <strong className="text-blue-600">+{delta.downtimeSaved} mins</strong>
              </p>
              {riskAssessment.leverWarnings.downtime && (
                <div className="text-[11px] font-semibold text-rose-700 bg-rose-100/80 border border-rose-200 rounded px-2 py-1 flex items-start gap-1.5 mt-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600 mt-0.5" />
                  <span>{riskAssessment.leverWarnings.downtime}</span>
                </div>
              )}
            </div>
          </div>

          {/* Lever 2: Cycle Time Improvement */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              riskAssessment.leverWarnings.cycle
                ? 'bg-amber-50/60 border-amber-300'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex justify-between items-center text-xs font-mono mb-2">
              <span className="text-slate-700 font-bold flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                Cycle-Time Speed Gain
              </span>
              <span className="text-amber-600 font-extrabold text-sm px-2 py-0.5 rounded bg-amber-50 border border-amber-200">
                {cycleImprovement}%
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="50"
              step="1"
              value={cycleImprovement}
              onChange={(e) => setCycleImprovement(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-200 rounded-lg"
            />

            <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
              <span>0% (Standard)</span>
              <span>25%</span>
              <span>50% (Max)</span>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-200/80 space-y-1">
              <p className="text-[11px] text-slate-600 font-mono">
                Eliminates micro-stoppages & takt lag
              </p>
              {riskAssessment.leverWarnings.cycle && (
                <div className="text-[11px] font-semibold text-amber-800 bg-amber-100/80 border border-amber-200 rounded px-2 py-1 flex items-start gap-1.5 mt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600 mt-0.5" />
                  <span>{riskAssessment.leverWarnings.cycle}</span>
                </div>
              )}
            </div>
          </div>

          {/* Lever 3: Defect Scrap Reduction */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              riskAssessment.leverWarnings.defect
                ? 'bg-rose-50/60 border-rose-300'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex justify-between items-center text-xs font-mono mb-2">
              <span className="text-slate-700 font-bold flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-emerald-600" />
                Defect Scrap Reduction
              </span>
              <span className="text-emerald-600 font-extrabold text-sm px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">
                {defectReduction}%
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="80"
              step="1"
              value={defectReduction}
              onChange={(e) => setDefectReduction(Number(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
            />

            <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
              <span>0% (Unmitigated)</span>
              <span>40%</span>
              <span>80% (Near Zero)</span>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-200/80 space-y-1">
              <p className="text-[11px] text-slate-600 font-mono">
                Rescued Good Parts: <strong className="text-emerald-600">+{delta.defectReductionUnits} units</strong>
              </p>
              {riskAssessment.leverWarnings.defect && (
                <div className="text-[11px] font-semibold text-rose-700 bg-rose-100/80 border border-rose-200 rounded px-2 py-1 flex items-start gap-1.5 mt-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600 mt-0.5" />
                  <span>{riskAssessment.leverWarnings.defect}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BEFORE VS DELTA VS AFTER IMPACT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Baseline Actual State */}
        <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
              Current Baseline (Actual Data)
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                baseline.riskLevel === 'HIGH'
                  ? 'bg-rose-100 text-rose-700'
                  : baseline.riskLevel === 'MEDIUM'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              Risk: {baseline.riskLevel}
            </span>
          </div>

          <div className="space-y-2 font-mono text-xs">
            <div className="flex justify-between p-2 rounded bg-slate-50 border border-slate-200">
              <span className="text-slate-500">Plant OEE:</span>
              <span className="text-slate-800 font-bold">
                {baseline.oee !== null ? `${baseline.oee}%` : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between p-2 rounded bg-slate-50 border border-slate-200">
              <span className="text-slate-500">Actual Output:</span>
              <span className="text-slate-800 font-bold">{baseline.output.toLocaleString()}</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-slate-50 border border-slate-200">
              <span className="text-slate-500">Downtime Minutes:</span>
              <span className="text-rose-600 font-bold">{baseline.downtime}m</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-slate-50 border border-slate-200">
              <span className="text-slate-500">Target Deficit Gap:</span>
              <span className="text-amber-600 font-bold">
                {baseline.targetGap > 0 ? baseline.targetGap.toLocaleString() : '0'} units
              </span>
            </div>
            <div className="flex justify-between p-2 rounded bg-slate-50 border border-slate-200">
              <span className="text-slate-500">Current Run Rate:</span>
              <span className="text-slate-700 font-bold">
                {riskAssessment.runRateImprovement.baselineRate} units/hr
              </span>
            </div>
          </div>
        </div>

        {/* Projected Net Gain (Delta) */}
        <div className="p-5 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-sm flex flex-col justify-between">
          <div>
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-blue-700 border-b border-blue-200 pb-2 flex items-center justify-between">
              <span>Projected Net Gain</span>
              <TrendingUp className="w-4 h-4 text-blue-600" />
            </div>

            <div className="space-y-3 pt-3">
              <div>
                <span className="text-xs text-slate-500 block font-mono">Incremental Volume Gain</span>
                <span className="text-3xl font-black font-mono text-blue-700">
                  +{delta.outputGain.toLocaleString()} <span className="text-sm font-normal">units</span>
                </span>
              </div>

              <div>
                <span className="text-xs text-slate-500 block font-mono">OEE Delta</span>
                <span className="text-2xl font-black font-mono text-emerald-600">
                  +{delta.oeeChange}%
                </span>
              </div>

              <div className="text-xs font-mono text-slate-600 space-y-1 pt-1 bg-white/70 p-2.5 rounded-lg border border-blue-100">
                <div className="flex justify-between">
                  <span>Downtime Recovered:</span>
                  <span className="font-bold text-blue-700">+{delta.downtimeSaved}m</span>
                </div>
                <div className="flex justify-between">
                  <span>Deficit Shrink:</span>
                  <span className="font-bold text-emerald-700">
                    -{delta.targetGapReduction.toLocaleString()} units
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Scrap Prevented:</span>
                  <span className="font-bold text-emerald-700">
                    +{delta.defectReductionUnits} units
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Simulated Future State */}
        <div
          className={`p-5 rounded-xl border shadow-sm space-y-3 ${
            simulated.riskLevel === 'HIGH'
              ? 'bg-rose-50/50 border-rose-200'
              : simulated.riskLevel === 'MEDIUM'
              ? 'bg-amber-50/50 border-amber-200'
              : 'bg-emerald-50/50 border-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700">
              Simulated Future State
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                simulated.riskLevel === 'HIGH'
                  ? 'bg-rose-200 text-rose-800'
                  : simulated.riskLevel === 'MEDIUM'
                  ? 'bg-amber-200 text-amber-800'
                  : 'bg-emerald-200 text-emerald-800'
              }`}
            >
              Sim Risk: {simulated.riskLevel}
            </span>
          </div>

          <div className="space-y-2 font-mono text-xs">
            <div className="flex justify-between p-2 rounded bg-white border border-slate-200">
              <span className="text-slate-500">Simulated OEE:</span>
              <span className="text-emerald-600 font-bold">{simulated.oee}%</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-white border border-slate-200">
              <span className="text-slate-500">Simulated Output:</span>
              <span className="text-slate-800 font-bold">{simulated.output.toLocaleString()}</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-white border border-slate-200">
              <span className="text-slate-500">Simulated Downtime:</span>
              <span className="text-slate-800 font-bold">{simulated.downtime}m</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-white border border-slate-200">
              <span className="text-slate-500">Remaining Deficit:</span>
              <span
                className={`font-bold ${
                  simulated.targetGap > 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                {simulated.targetGap > 0
                  ? `${simulated.targetGap.toLocaleString()} units`
                  : '0 (Met Quota)'}
              </span>
            </div>
            <div className="flex justify-between p-2 rounded bg-white border border-slate-200">
              <span className="text-slate-500">Simulated Run Rate:</span>
              <span className="text-blue-700 font-bold">
                {riskAssessment.runRateImprovement.simulatedRate} units/hr
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* QUOTA RECOVERY & VELOCITY PACING PROGRESS */}
      <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-600" />
            Quota Fulfillment Velocity & Pacing Trajectory
          </h3>
          <span className="text-xs font-mono text-slate-500">
            Target Quota: {baseline.targetTotal.toLocaleString()} units
          </span>
        </div>

        <div className="space-y-3">
          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-1.5">
              <span className="text-slate-600">Quota Delivery Progress:</span>
              <span className="font-bold text-slate-800">
                Baseline {baselineQuotaPct}% →{' '}
                <strong className={simulatedQuotaPct >= 100 ? 'text-emerald-600' : 'text-amber-600'}>
                  Simulated {simulatedQuotaPct}%
                </strong>
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden flex border border-slate-200">
              {/* Baseline portion */}
              <div
                style={{ width: `${Math.min(100, baselineQuotaPct)}%` }}
                className="bg-slate-400 h-full transition-all duration-300"
                title={`Baseline Output: ${baseline.output.toLocaleString()} units`}
              />
              {/* Simulated gain portion */}
              <div
                style={{
                  width: `${Math.max(
                    0,
                    Math.min(100 - baselineQuotaPct, simulatedQuotaPct - baselineQuotaPct)
                  )}%`,
                }}
                className={`h-full transition-all duration-300 ${
                  simulatedQuotaPct >= 100 ? 'bg-emerald-500' : 'bg-blue-500'
                }`}
                title={`Projected Gain: +${delta.outputGain.toLocaleString()} units`}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono text-slate-400 mt-1">
              <span>0 units</span>
              <span className="text-slate-600 font-bold">100% Quota Target</span>
              <span>120%+ Surplus</span>
            </div>
          </div>

          {/* Velocity comparison tags */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono flex items-center justify-between">
              <span className="text-slate-500">Actual Line Velocity:</span>
              <span className="font-bold text-slate-800">
                {riskAssessment.runRateImprovement.baselineRate} u/hr
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs font-mono flex items-center justify-between">
              <span className="text-blue-700 font-semibold">Simulated Velocity:</span>
              <span className="font-bold text-blue-700">
                {riskAssessment.runRateImprovement.simulatedRate} u/hr
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs font-mono flex items-center justify-between">
              <span className="text-amber-800 font-semibold">Quota Target Velocity:</span>
              <span className="font-bold text-amber-800">
                {riskAssessment.runRateImprovement.requiredRate} u/hr
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SAVE SCENARIO SECTION */}
      <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex-1 w-full sm:w-auto">
          <label className="text-xs font-medium text-slate-600 block mb-1">Scenario Label</label>
          <input
            type="text"
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            className="w-full bg-white border border-slate-300 text-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 font-mono"
            placeholder="e.g. Die Changeover SMED Kaizen"
          />
        </div>

        <div className="flex items-center gap-2 mt-4 sm:mt-5">
          {/* Download Report Button */}
          {(activeDataset || filteredRecords.length > 0) && (
            <button
              onClick={handleDownloadReport}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-all shadow-sm"
              title="Download Problem & Solution simulation report"
            >
              <Download className="w-4 h-4" />
              Download Report
            </button>
          )}

          {/* Save Scenario Button */}
          <button
            onClick={handleSaveScenario}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-all shadow-sm"
          >
            {isSavedSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                Scenario Saved!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Simulation Scenario
              </>
            )}
          </button>
        </div>
      </div>

      {/* SAVED SCENARIOS LIST */}
      {scenarios.length > 0 && (
        <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Saved Simulation Scenarios</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {scenarios.map((s, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs font-mono"
              >
                <div className="font-bold text-slate-800 truncate">{s.name}</div>
                <div className="text-slate-500 text-[11px]">
                  Downtime: -{s.downtime_reduction}% | Cycle: +{s.cycle_improvement}% | Scrap: -
                  {s.quality_improvement}%
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 text-[11px]">
                  <span className="text-blue-600 font-bold">Gain: +{s.potential_gain} units</span>
                  <span className="text-emerald-600 font-bold">
                    OEE: {s.baseline_oee}% → {s.simulated_oee}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
