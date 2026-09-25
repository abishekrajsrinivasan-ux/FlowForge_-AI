import React, { useState, useEffect } from 'react';
import { Sparkles, Bot, ShieldCheck, RefreshCw, Key, ArrowRight } from 'lucide-react';
import { useProductionData } from '../context/ProductionDataContext';
import { EmptyState } from '../components/common/EmptyState';
import { generateGroundedInsights, GroundedInsightsResult } from '../engine/aiInsightsEngine';

export const AiInsights: React.FC = () => {
  const {
    activeDataset,
    filteredRecords,
    oee,
    bottlenecks,
    losses,
    rootCauses,
    targetRisk,
  } = useProductionData();

  const [insights, setInsights] = useState<GroundedInsightsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('ff_ai_api_key') || '');

  const runSynthesis = async () => {
    if (!activeDataset) return;
    setLoading(true);
    try {
      const res = await generateGroundedInsights(
        activeDataset.name,
        oee,
        bottlenecks,
        losses,
        rootCauses,
        targetRisk,
        apiKey
      );
      setInsights(res);
    } catch (e) {
      console.error('Synthesis error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeDataset && filteredRecords.length > 0) {
      runSynthesis();
    }
  }, [activeDataset, filteredRecords]);

  if (!activeDataset || filteredRecords.length === 0) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-xl font-bold tracking-tight text-slate-800">
          AI Operational Insights
        </h1>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-500" />
            AI Operational Intelligence & Synthesis
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Executive operational narrative grounded 100% in mathematically verified data. Zero hallucinated values.
          </p>
        </div>

        <button
          onClick={runSynthesis}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-all shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Synthesizing...' : 'Regenerate Briefing'}
        </button>
      </div>

      {/* VERIFIABILITY GUARANTEE BADGE */}
      <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 text-xs text-slate-700 flex items-start gap-3 leading-relaxed">
        <ShieldCheck className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div>
          <strong className="text-blue-700 block mb-0.5">Empirical Grounding Protocol:</strong>
          FLOWFORGE AI combines deterministic mathematical modeling with an interactive right-side AI Copilot. All numerical claims, constraint rankings, and what-if predictions are verified against active line physics.
          {insights?.generatedVia && (
            <span className="block mt-1 font-mono text-[11px] text-slate-500">
              Generated via:{' '}
              <strong className="text-blue-600">
                {insights.generatedVia === 'llm_api' ? 'Grounded LLM' : 'FLOWFORGE AI Deterministic Synthesizer'}
              </strong>
            </span>
          )}
        </div>
      </div>

      {/* EXECUTIVE SYNTHESIS REPORT */}
      {insights && (
        <div className="space-y-6">
          {/* Executive Summary */}
          <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-sm space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-blue-600 flex items-center gap-2">
              <Bot className="w-4 h-4" />
              Executive Operations Briefing
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed font-sans">
              {insights.executiveSummary}
            </p>
          </div>

          {/* Deep Dives Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Constraint Deep Dive */}
            <div className="p-5 rounded-xl border border-rose-200 bg-rose-50 shadow-sm space-y-2">
              <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider">
                Constraint Diagnosis
              </h4>
              <p className="text-xs text-slate-700 leading-relaxed">
                {insights.bottleneckBriefing}
              </p>
            </div>

            {/* Loss Hierarchy Deep Dive */}
            <div className="p-5 rounded-xl border border-amber-200 bg-amber-50 shadow-sm space-y-2">
              <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                Loss Tree Narrative
              </h4>
              <p className="text-xs text-slate-700 leading-relaxed">
                {insights.lossAnalysisNarrative}
              </p>
            </div>
          </div>

          {/* Strategic Recommendations */}
          <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-3">
            <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
              Priority Corrective Actions
            </h4>
            <div className="space-y-2">
              {insights.strategicRecommendations.map((rec, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-2.5 leading-relaxed"
                >
                  <span className="w-5 h-5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200 font-mono flex items-center justify-center shrink-0 text-[10px] font-bold">
                    {i + 1}
                  </span>
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
