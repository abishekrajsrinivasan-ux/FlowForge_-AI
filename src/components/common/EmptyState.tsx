import React from 'react';
import { Database, Upload, ArrowRight, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface EmptyStateProps {
  title?: string;
  description?: string;
  showUploadAction?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No Production Dataset Active',
  description = 'Upload a production dataset (CSV) to analyze OEE, pinpoint bottlenecks, diagnose losses, and simulate optimization scenarios.',
  showUploadAction = true,
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-slate-300 bg-white my-8 shadow-sm">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-5 shadow-sm">
        <Database className="w-8 h-8" />
      </div>

      <h3 className="text-xl font-semibold text-slate-800 mb-2">{title}</h3>
      <p className="text-slate-500 max-w-md text-sm mb-6 leading-relaxed">{description}</p>

      {showUploadAction && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => navigate('/data-management')}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-all shadow-sm shadow-blue-200"
          >
            <Upload className="w-4 h-4" />
            Upload Production Dataset
          </button>

          <button
            onClick={() => navigate('/data-management')}
            className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-all border border-slate-300"
          >
            Open Data Management
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-slate-200 max-w-lg text-left flex items-start gap-3 text-xs text-slate-500">
        <AlertCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <span>
          <strong className="text-slate-700">Strict Zero-Dummy Policy:</strong> FLOWFORGE AI calculates all metrics, loss trees, and bottleneck rankings exclusively from actual uploaded data. No synthetic values or placeholder machines are shown.
        </span>
      </div>
    </div>
  );
};
