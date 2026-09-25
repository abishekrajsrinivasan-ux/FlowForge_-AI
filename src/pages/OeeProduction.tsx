import React, { useState } from 'react';
import {
  Gauge,
  Clock,
  Activity,
  CheckCircle,
  Layers,
  TrendingDown,
  BarChart2,
  Table,
} from 'lucide-react';
import { useProductionData } from '../context/ProductionDataContext';
import { MetricCard } from '../components/common/MetricCard';
import { EmptyState } from '../components/common/EmptyState';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from 'recharts';

export const OeeProduction: React.FC = () => {
  const { activeDataset, filteredRecords, oee } = useProductionData();
  const [activeTab, setActiveTab] = useState<'machines' | 'shifts' | 'products'>('machines');

  if (!activeDataset || filteredRecords.length === 0) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-xl font-bold tracking-tight text-slate-800">
          OEE & Production Analytics
        </h1>
        <EmptyState />
      </div>
    );
  }

  // 1. Machine Breakdown Aggregation
  const machineData = Array.from(
    filteredRecords.reduce((map, r) => {
      const mId = r.machine_id;
      if (!map.has(mId)) {
        map.set(mId, {
          machine: mId,
          target: 0,
          actual: 0,
          downtime: 0,
          operatingTime: 0,
          plannedTime: 0,
          good: 0,
          defective: 0,
          recordsCount: 0,
        });
      }
      const item = map.get(mId)!;
      item.target += r.target_quantity ?? 0;
      item.actual += r.actual_quantity ?? r.total_units ?? 0;
      item.downtime += r.downtime ?? 0;
      item.operatingTime += r.operating_time ?? 0;
      item.plannedTime += r.planned_time ?? 0;
      item.good += r.good_units ?? (r.actual_quantity ?? 0) - (r.defective_units ?? 0);
      item.defective += r.defective_units ?? 0;
      item.recordsCount++;
      return map;
    }, new Map<string, any>()).values()
  ).map((m) => {
    const planned = m.plannedTime > 0 ? m.plannedTime : m.operatingTime + m.downtime;
    const avail = planned > 0 ? Math.min(100, Math.round((m.operatingTime / planned) * 1000) / 10) : null;
    const perf = m.target > 0 ? Math.min(120, Math.round((m.actual / m.target) * 1000) / 10) : null;
    const qual = m.actual > 0 ? Math.min(100, Math.round((m.good / m.actual) * 1000) / 10) : null;
    const calcOee =
      avail !== null && perf !== null && qual !== null
        ? Math.round(((avail / 100) * (perf / 100) * (qual / 100)) * 10000) / 100
        : null;

    return {
      ...m,
      availability: avail,
      performance: perf,
      quality: qual,
      oee: calcOee,
    };
  });

  // 2. Shift Breakdown Aggregation
  const shiftData = Array.from(
    filteredRecords.reduce((map, r) => {
      const s = r.shift || 'Unassigned Shift';
      if (!map.has(s)) {
        map.set(s, { shift: s, target: 0, actual: 0, downtime: 0, defective: 0 });
      }
      const item = map.get(s)!;
      item.target += r.target_quantity ?? 0;
      item.actual += r.actual_quantity ?? r.total_units ?? 0;
      item.downtime += r.downtime ?? 0;
      item.defective += r.defective_units ?? 0;
      return map;
    }, new Map<string, any>()).values()
  );

  // 3. Product Breakdown Aggregation
  const productData = Array.from(
    filteredRecords.reduce((map, r) => {
      const p = r.product_id || 'Standard Batch';
      if (!map.has(p)) {
        map.set(p, { product: p, target: 0, actual: 0, defective: 0 });
      }
      const item = map.get(p)!;
      item.target += r.target_quantity ?? 0;
      item.actual += r.actual_quantity ?? r.total_units ?? 0;
      item.defective += r.defective_units ?? 0;
      return map;
    }, new Map<string, any>()).values()
  );

  const tooltipStyle = {
    contentStyle: { backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
    labelStyle: { color: '#1e293b', fontWeight: 'bold' },
    itemStyle: { color: '#475569' },
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
          <Gauge className="w-5 h-5 text-blue-500" />
          OEE & Production Performance
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Detailed decomposition of Availability, Operating Speed, Yield Quality, and Machine Output.
        </p>
      </div>

      {/* METRIC CARDS ROW */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <MetricCard
          label="Plant OEE"
          value={oee.oee !== null ? oee.oee : null}
          unit="%"
          icon={Gauge}
          status={oee.oee && oee.oee >= 75 ? 'success' : 'warning'}
          formula="A × P × Q"
          unavailableReason={oee.unavailabilityReasons[0]}
        />
        <MetricCard
          label="Availability"
          value={oee.availability !== null ? oee.availability : null}
          unit="%"
          icon={Clock}
          status={oee.availability && oee.availability >= 85 ? 'success' : 'warning'}
          formula="Operating Time / Planned Time"
        />
        <MetricCard
          label="Performance"
          value={oee.performance !== null ? oee.performance : null}
          unit="%"
          icon={Activity}
          status={oee.performance && oee.performance >= 90 ? 'success' : 'warning'}
          formula="(Ideal Cycle × Units) / Run Time"
        />
        <MetricCard
          label="Quality"
          value={oee.quality !== null ? oee.quality : null}
          unit="%"
          icon={CheckCircle}
          status={oee.quality && oee.quality >= 98 ? 'success' : 'warning'}
          formula="Good Units / Total Units"
        />
        <MetricCard
          label="Good Units"
          value={oee.totalGoodUnits.toLocaleString()}
          unit="units"
          icon={Layers}
          status="success"
        />
        <MetricCard
          label="Defect Scrap"
          value={oee.totalDefectiveUnits.toLocaleString()}
          unit="units"
          icon={TrendingDown}
          status={oee.totalDefectiveUnits > 0 ? 'warning' : 'success'}
          subtext={oee.defectRate ? `${oee.defectRate}% rate` : undefined}
        />
      </div>

      {/* CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Machine OEE & Components Comparison */}
        <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">OEE Component Breakdown by Machine</h3>
            <span className="text-xs text-slate-400 font-mono">% Ratio</span>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={machineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="machine" stroke="#94a3b8" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11, fill: '#64748b' }} domain={[0, 100]} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px', color: '#64748b' }} />
                <Bar dataKey="availability" name="Availability %" fill="#2563eb" radius={[2, 2, 0, 0]} />
                <Bar dataKey="performance" name="Performance %" fill="#0891b2" radius={[2, 2, 0, 0]} />
                <Bar dataKey="quality" name="Quality %" fill="#059669" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Machine Downtime & Production Gap */}
        <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Downtime Minutes by Machine</h3>
            <span className="text-xs text-slate-400 font-mono">Lost Minutes</span>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={machineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="machine" stroke="#94a3b8" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="downtime" name="Downtime (min)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* DRILL-DOWN TABLES: MACHINES / SHIFTS / PRODUCTS */}
      <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Table className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-slate-700">Operational Breakdown Tables</h3>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setActiveTab('machines')}
              className={`px-3 py-1 rounded font-medium transition-all ${
                activeTab === 'machines' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Machines ({machineData.length})
            </button>
            <button
              onClick={() => setActiveTab('shifts')}
              className={`px-3 py-1 rounded font-medium transition-all ${
                activeTab === 'shifts' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Shifts ({shiftData.length})
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`px-3 py-1 rounded font-medium transition-all ${
                activeTab === 'products' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Products ({productData.length})
            </button>
          </div>
        </div>

        {/* Tab 1: Machine Table */}
        {activeTab === 'machines' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Machine ID</th>
                  <th className="py-2.5 px-3">Actual Output</th>
                  <th className="py-2.5 px-3">Target</th>
                  <th className="py-2.5 px-3">Downtime (m)</th>
                  <th className="py-2.5 px-3">Availability</th>
                  <th className="py-2.5 px-3">Performance</th>
                  <th className="py-2.5 px-3">Quality</th>
                  <th className="py-2.5 px-3">OEE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {machineData.map((m) => (
                  <tr key={m.machine} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-700">{m.machine}</td>
                    <td className="py-2.5 px-3 text-blue-600 font-bold">{m.actual.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-slate-500">{m.target.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-rose-600 font-medium">{m.downtime}</td>
                    <td className="py-2.5 px-3 text-slate-600">{m.availability !== null ? `${m.availability}%` : '—'}</td>
                    <td className="py-2.5 px-3 text-slate-600">{m.performance !== null ? `${m.performance}%` : '—'}</td>
                    <td className="py-2.5 px-3 text-slate-600">{m.quality !== null ? `${m.quality}%` : '—'}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded font-bold ${
                          m.oee && m.oee >= 75
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {m.oee !== null ? `${m.oee}%` : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Shift Table */}
        {activeTab === 'shifts' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Shift Name</th>
                  <th className="py-2.5 px-3">Actual Produced</th>
                  <th className="py-2.5 px-3">Target</th>
                  <th className="py-2.5 px-3">Downtime (min)</th>
                  <th className="py-2.5 px-3">Defective Scrap</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shiftData.map((s) => (
                  <tr key={s.shift} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-700">{s.shift}</td>
                    <td className="py-2.5 px-3 text-blue-600 font-bold">{s.actual.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-slate-500">{s.target.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-rose-600">{s.downtime}</td>
                    <td className="py-2.5 px-3 text-amber-600">{s.defective}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Product Table */}
        {activeTab === 'products' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Product / SKU</th>
                  <th className="py-2.5 px-3">Actual Units</th>
                  <th className="py-2.5 px-3">Target Planned</th>
                  <th className="py-2.5 px-3">Defects</th>
                  <th className="py-2.5 px-3">Defect %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productData.map((p) => {
                  const dRate = p.actual > 0 ? Math.round((p.defective / p.actual) * 10000) / 100 : 0;
                  return (
                    <tr key={p.product} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-700">{p.product}</td>
                      <td className="py-2.5 px-3 text-blue-600 font-bold">{p.actual.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-slate-500">{p.target.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-rose-600">{p.defective}</td>
                      <td className="py-2.5 px-3 text-slate-600">{dRate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
