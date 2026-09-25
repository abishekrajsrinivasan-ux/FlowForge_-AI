import React, { useState } from 'react';
import { Settings as SettingsIcon, Server, Key, Sliders, Check, AlertCircle, Database } from 'lucide-react';
import { getSupabaseConfig, setSupabaseConfig, getSupabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_BOTTLENECK_WEIGHTS, BottleneckWeights } from '../engine/bottleneckEngine';

export const Settings: React.FC = () => {
  const { isSupabaseConfigured } = useAuth();
  const currentConfig = getSupabaseConfig();

  const [supabaseUrl, setSupabaseUrl] = useState(currentConfig.url);
  const [supabaseKey, setSupabaseKey] = useState(currentConfig.key);
  const [aiKey, setAiKey] = useState(() => localStorage.getItem('ff_ai_api_key') || '');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Bottleneck Weights
  const [weights, setWeights] = useState<BottleneckWeights>(() => {
    const saved = localStorage.getItem('ff_bottleneck_weights');
    return saved ? JSON.parse(saved) : DEFAULT_BOTTLENECK_WEIGHTS;
  });

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setSupabaseConfig(supabaseUrl, supabaseKey);
    localStorage.setItem('ff_ai_api_key', aiKey.trim());
    localStorage.setItem('ff_bottleneck_weights', JSON.stringify(weights));

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleTestConnection = async () => {
    setTestResult(null);
    const client = getSupabase();
    if (!client) {
      setTestResult({
        success: false,
        message: 'Supabase client is not configured. Enter a valid URL and Anon Key.',
      });
      return;
    }

    try {
      const { data, error } = await client.from('datasets').select('id').limit(1);
      if (error) {
        setTestResult({
          success: false,
          message: `Connected to Supabase, but query returned: ${error.message}. Please ensure migrations in supabase/schema.sql have been run.`,
        });
      } else {
        setTestResult({
          success: true,
          message: 'Successfully verified live connection to Supabase PostgreSQL!',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Connection failed: ${err.message || String(err)}`,
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-blue-500" />
          System Settings & Cloud Backend Configuration
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage Supabase PostgreSQL connectivity, storage buckets, bottleneck score weights, and AI keys.
        </p>
      </div>

      <form onSubmit={handleSaveConfig} className="space-y-6">
        {/* SUPABASE CONNECTION CARD */}
        <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-slate-700">Supabase Backend Layer</h3>
            </div>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                isSupabaseConfigured
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {isSupabaseConfigured ? 'Configured & Active' : 'Local / Offline Fallback'}
            </span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div>
              <label className="text-slate-500 block mb-1 font-sans text-xs">
                Supabase Project URL (VITE_SUPABASE_URL)
              </label>
              <input
                type="text"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                placeholder="https://xyzcompany.supabase.co"
                className="w-full bg-white border border-slate-300 text-slate-800 rounded-lg p-2.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
              />
            </div>

            <div>
              <label className="text-slate-500 block mb-1 font-sans text-xs">
                Supabase Anon / Public API Key (VITE_SUPABASE_ANON_KEY)
              </label>
              <input
                type="password"
                value={supabaseKey}
                onChange={(e) => setSupabaseKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full bg-white border border-slate-300 text-slate-800 rounded-lg p-2.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
              />
            </div>
          </div>

          {/* Test connection & schema notice */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <button
              type="button"
              onClick={handleTestConnection}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-blue-600 border border-slate-300 rounded-lg font-medium transition-all"
            >
              Test Supabase Live Connection
            </button>

            <span className="text-[11px] text-slate-400">
              Database schema DDL available in <code className="text-blue-600">supabase/schema.sql</code>
            </span>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-lg border text-xs font-mono leading-relaxed ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}
            >
              {testResult.message}
            </div>
          )}
        </div>

        {/* OPTIONAL AI API KEY */}
        <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <Key className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-slate-700">
              AI Synthesis Key (Optional)
            </h3>
          </div>

          <p className="text-xs text-slate-500">
            If provided, the AI Insights page will use this API key (e.g. OpenAI <code className="text-slate-700">sk-...</code>) to generate natural language executive operations summaries strictly conditioned on the calculated metrics. If empty, the built-in deterministic synthesizer is used with 0 hallucinations.
          </p>

          <input
            type="password"
            value={aiKey}
            onChange={(e) => setAiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full bg-white border border-slate-300 text-slate-800 rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* BOTTLENECK SCORE WEIGHTS */}
        <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-slate-700">
                FLOWFORGE AI Bottleneck Scoring Formula Weights
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setWeights(DEFAULT_BOTTLENECK_WEIGHTS)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Reset to Defaults
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-600 font-sans">OEE Loss Weight:</span>
                <span className="text-blue-600">{Math.round(weights.oeeLoss * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.5"
                step="0.05"
                value={weights.oeeLoss}
                onChange={(e) => setWeights({ ...weights, oeeLoss: Number(e.target.value) })}
                className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-600 font-sans">Availability Loss Weight:</span>
                <span className="text-blue-600">{Math.round(weights.availabilityLoss * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.5"
                step="0.05"
                value={weights.availabilityLoss}
                onChange={(e) =>
                  setWeights({ ...weights, availabilityLoss: Number(e.target.value) })
                }
                className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-600 font-sans">Throughput Deficit Weight:</span>
                <span className="text-blue-600">{Math.round(weights.throughputLoss * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.5"
                step="0.05"
                value={weights.throughputLoss}
                onChange={(e) => setWeights({ ...weights, throughputLoss: Number(e.target.value) })}
                className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-600 font-sans">Performance Loss Weight:</span>
                <span className="text-blue-600">{Math.round(weights.performanceLoss * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.5"
                step="0.05"
                value={weights.performanceLoss}
                onChange={(e) => setWeights({ ...weights, performanceLoss: Number(e.target.value) })}
                className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* SAVE BUTTON */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-all shadow-sm"
          >
            {saveSuccess ? (
              <>
                <Check className="w-4 h-4" />
                Settings Saved!
              </>
            ) : (
              'Save System Settings'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
