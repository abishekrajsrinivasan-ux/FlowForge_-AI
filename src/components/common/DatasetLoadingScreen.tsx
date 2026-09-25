import React, { useState, useEffect } from 'react';
import { Cpu, CheckCircle2, Loader2, Sparkles, Layers } from 'lucide-react';

interface DatasetLoadingScreenProps {
  datasetName?: string;
  rowCount?: number;
  onFinish?: () => void;
  autoProgress?: boolean;
}

export const DatasetLoadingScreen: React.FC<DatasetLoadingScreenProps> = ({
  datasetName = 'Production Telemetry',
  rowCount,
  onFinish,
  autoProgress = true,
}) => {
  const [progress, setProgress] = useState(15);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const steps = [
    { title: 'Normalizing Telemetry Records', desc: 'Validating machine timestamps, cycle durations, and shift assignments' },
    { title: 'Computing OEE Metrics', desc: 'Evaluating Availability, Operating Speed Velocity, and First-Pass Quality Yield' },
    { title: 'Identifying Production Bottlenecks', desc: 'Ranking constraint scores and Six Big Losses attribution across workstations' },
    { title: 'Calibrating Real-Time ML Engines', desc: 'Synthesizing target risk models, risk radar, and What-If scenario baselines' },
  ];

  useEffect(() => {
    if (!autoProgress) return;

    const timer1 = setTimeout(() => {
      setProgress(40);
      setCurrentStepIndex(1);
    }, 350);

    const timer2 = setTimeout(() => {
      setProgress(75);
      setCurrentStepIndex(2);
    }, 750);

    const timer3 = setTimeout(() => {
      setProgress(95);
      setCurrentStepIndex(3);
    }, 1150);

    const timer4 = setTimeout(() => {
      setProgress(100);
      if (onFinish) {
        setTimeout(onFinish, 200);
      }
    }, 1450);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [autoProgress, onFinish]);

  return (
    <div className="min-h-[520px] flex items-center justify-center p-6 w-full">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-slate-100 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-center gap-3.5 mb-6 relative z-10">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Cpu className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-widest text-blue-400 font-bold">
                FLOWFORGE AI Engine
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Loading &amp; Analyzing Telemetry Data
            </h2>
          </div>
        </div>

        {/* Active Dataset Name Tag */}
        <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/60 mb-6 flex items-center justify-between text-xs relative z-10">
          <div className="flex items-center gap-2 text-slate-300 truncate">
            <Layers className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="text-slate-400">Target Dataset:</span>
            <span className="font-semibold text-white truncate font-mono">{datasetName}</span>
          </div>
          {rowCount !== undefined && (
            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[11px] border border-blue-500/30 shrink-0">
              {rowCount.toLocaleString()} records
            </span>
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-2 mb-6 relative z-10">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-spin" />
              Real-time analytics computation
            </span>
            <span className="text-blue-400 font-bold">{progress}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700 p-0.5">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Multi-step execution stages */}
        <div className="space-y-3 relative z-10">
          {steps.map((s, idx) => {
            const isDone = idx < currentStepIndex || progress === 100;
            const isCurrent = idx === currentStepIndex && progress < 100;

            return (
              <div
                key={idx}
                className={`p-3 rounded-xl border transition-all text-xs flex items-start gap-3 ${
                  isDone
                    ? 'bg-slate-800/40 border-slate-700/60 text-slate-300'
                    : isCurrent
                    ? 'bg-blue-950/40 border-blue-500/40 text-blue-100 shadow-sm'
                    : 'bg-slate-900/40 border-slate-800/40 text-slate-500'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-600 flex items-center justify-center text-[9px] font-mono text-slate-500">
                      {idx + 1}
                    </div>
                  )}
                </div>
                <div>
                  <div
                    className={`font-semibold ${
                      isDone ? 'text-slate-200' : isCurrent ? 'text-white' : 'text-slate-500'
                    }`}
                  >
                    {s.title}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    {s.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info note */}
        <p className="text-[11px] text-slate-500 text-center mt-6 font-mono">
          Strict zero-dummy guarantee: All metrics strictly evaluate your uploaded telemetry rows.
        </p>
      </div>
    </div>
  );
};
