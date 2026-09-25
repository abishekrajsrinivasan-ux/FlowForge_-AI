import React from 'react';
import { LucideIcon, HelpCircle } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number | null;
  unit?: string;
  icon?: LucideIcon;
  subtext?: string;
  formula?: string;
  status?: 'normal' | 'success' | 'warning' | 'danger';
  trend?: {
    value: string;
    direction: 'up' | 'down' | 'neutral';
    isPositive: boolean;
  };
  unavailableReason?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  icon: Icon,
  subtext,
  formula,
  status = 'normal',
  trend,
  unavailableReason,
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'text-emerald-700 border-emerald-200 bg-emerald-50';
      case 'warning':
        return 'text-amber-700 border-amber-200 bg-amber-50';
      case 'danger':
        return 'text-rose-700 border-rose-200 bg-rose-50';
      default:
        return 'text-slate-800 border-slate-200 bg-white';
    }
  };

  return (
    <div className={`p-4 rounded-xl border transition-all shadow-sm ${getStatusColor()} flex flex-col justify-between relative group`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
          {formula && (
            <div className="relative group/tooltip">
              <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 cursor-help" />
              <div className="absolute left-0 bottom-full mb-1 hidden group-hover/tooltip:block bg-white border border-slate-200 text-slate-700 text-[11px] rounded p-2 z-50 whitespace-nowrap shadow-lg">
                Formula: {formula}
              </div>
            </div>
          )}
        </div>
        {Icon && <Icon className="w-4 h-4 text-slate-400" />}
      </div>

      <div className="flex items-baseline gap-1.5 my-1">
        {value !== null && value !== undefined ? (
          <>
            <span className="text-2xl font-bold font-mono tracking-tight">{value}</span>
            {unit && <span className="text-xs font-medium text-slate-500">{unit}</span>}
          </>
        ) : (
          <span className="text-sm italic text-slate-400 font-mono">Not computable</span>
        )}
      </div>

      {unavailableReason ? (
        <p className="text-[11px] text-amber-600 mt-1 line-clamp-1" title={unavailableReason}>
          {unavailableReason}
        </p>
      ) : (
        <div className="flex items-center justify-between text-xs mt-1">
          {subtext && <span className="text-slate-500 text-[11px] truncate">{subtext}</span>}
          {trend && (
            <span
              className={`text-[11px] font-mono px-1.5 py-0.5 rounded font-medium ${
                trend.isPositive ? 'text-emerald-700 bg-emerald-100' : 'text-rose-700 bg-rose-100'
              }`}
            >
              {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'} {trend.value}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
