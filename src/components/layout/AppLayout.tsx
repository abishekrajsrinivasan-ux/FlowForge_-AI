import React, { useMemo, useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Gauge,
  Flame,
  Search,
  PieChart,
  AlertTriangle,
  Sliders,
  Sparkles,
  CheckSquare,
  TrendingUp,
  Database,
  Settings,
  Upload,
  Server,
  FilterX,
  LogOut,
  Bot,
  Radar,
  Cpu,
  ChevronDown,
  UserCheck,
} from 'lucide-react';
import { useProductionData } from '../../context/ProductionDataContext';
import { useAuth } from '../../context/AuthContext';
import { AiChatbot } from '../chat/AiChatbot';

// Full Admin Navigation
const ADMIN_NAV_ITEMS = [
  { label: 'Overview', path: '/', icon: LayoutDashboard },
  { label: 'OEE & Production', path: '/oee', icon: Gauge },
  { label: 'Bottleneck Intelligence', path: '/bottlenecks', icon: Flame },
  { label: 'Root-Cause Explorer', path: '/root-causes', icon: Search },
  { label: 'Loss Analysis', path: '/losses', icon: PieChart },
  { label: 'Target Risk', path: '/target-risk', icon: AlertTriangle },
  { label: 'What-If Simulator', path: '/simulator', icon: Sliders },
  { label: 'Production Risk Radar', path: '/risk-radar', icon: Radar },
  { label: 'Action Center', path: '/actions', icon: CheckSquare },
  { label: 'Improvement Tracking', path: '/improvements', icon: TrendingUp },
  { label: 'Data Management', path: '/data-management', icon: Database },
  { label: 'Settings', path: '/settings', icon: Settings },
];

// Production Monitoring Navigation for Operators (Restricted to monitoring features only)
const OPERATOR_NAV_ITEMS = [
  { label: 'Overview', path: '/', icon: LayoutDashboard },
  { label: 'OEE & Production', path: '/oee', icon: Gauge },
  { label: 'Production Risk Radar', path: '/risk-radar', icon: Radar },
];

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, isSupabaseConfigured } = useAuth();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const isOperator = user?.role === 'Operator';
  const roleName = isOperator ? 'Operator' : 'Admin';
  const userInitials = isOperator ? 'OP' : 'AD';
  const navItems = isOperator ? OPERATOR_NAV_ITEMS : ADMIN_NAV_ITEMS;

  const {
    datasets,
    activeDataset,
    activeDatasetId,
    setActiveDatasetId,
    productionRecords,
    filters,
    setFilters,
    resetFilters,
    setIsAnalyzing,
    setLoadingDatasetName,
  } = useProductionData();

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileMenuOpen]);

  // Extract unique machines, lines, shifts, products from active dataset records
  const uniqueMachines = useMemo(() => {
    const set = new Set<string>();
    productionRecords.forEach((r) => r.machine_id && set.add(r.machine_id));
    return Array.from(set).sort();
  }, [productionRecords]);

  const uniqueLines = useMemo(() => {
    const set = new Set<string>();
    productionRecords.forEach((r) => r.line_id && set.add(r.line_id));
    return Array.from(set).sort();
  }, [productionRecords]);

  const uniqueShifts = useMemo(() => {
    const set = new Set<string>();
    productionRecords.forEach((r) => r.shift && set.add(r.shift));
    return Array.from(set).sort();
  }, [productionRecords]);

  const uniqueProducts = useMemo(() => {
    const set = new Set<string>();
    productionRecords.forEach((r) => r.product_id && set.add(r.product_id));
    return Array.from(set).sort();
  }, [productionRecords]);

  const isFiltered =
    (!isOperator && filters.machineId !== 'ALL') ||
    (!isOperator && filters.lineId !== 'ALL') ||
    filters.shift !== 'ALL' ||
    filters.productId !== 'ALL';

  const handleSignOut = async () => {
    setIsProfileMenuOpen(false);
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 overflow-hidden font-sans relative">
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 select-none shadow-sm z-20">
        <div>
          {/* Logo & Platform Title */}
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center font-bold text-white text-lg shadow-md shadow-blue-200">
                F
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-slate-800 flex items-center gap-1.5">
                  FLOWFORGE <span className="text-blue-600 font-extrabold text-xs px-1 py-0.5 rounded bg-blue-50 border border-blue-200">AI</span>
                </h1>
                <p className="text-[10px] text-slate-500 truncate">Production Intelligence & OEE</p>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-2 space-y-0.5 overflow-y-auto max-h-[calc(100vh-210px)]">
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>{isOperator ? 'Production Monitoring' : 'Operations & Analytics'}</span>
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                  isOperator
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}
              >
                {roleName}
              </span>
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Footer / User Profile & Engine Status */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 text-xs space-y-2.5">
          {/* User Profile Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-7 h-7 rounded-full text-white font-bold text-[11px] flex items-center justify-center shrink-0 shadow-sm ${
                  isOperator ? 'bg-emerald-600' : 'bg-blue-600'
                }`}
              >
                {userInitials}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-xs text-slate-800 truncate">
                  {roleName}
                </div>
                <div className="text-[10px] text-slate-500 truncate flex items-center gap-1 font-mono">
                  <span className={`font-semibold ${isOperator ? 'text-emerald-700' : 'text-blue-700'}`}>
                    {roleName}
                  </span>
                  {isOperator && user?.assignedMachine && (
                    <span className="truncate">• {user.assignedMachine}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Link
                to="/login"
                className="px-1.5 py-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors text-[10px] font-semibold"
                title="Switch User / Sign In"
              >
                Switch
              </Link>
              <button
                onClick={handleSignOut}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-slate-500">
            <span className="flex items-center gap-1.5 text-[10px]">
              <Server className="w-3 h-3 text-slate-400" />
              Engine Layer
            </span>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-medium ${
                isSupabaseConfigured
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {isSupabaseConfigured ? 'Live Backend' : 'Local Sandbox'}
            </span>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* TOP HEADER & GLOBAL FILTER BAR */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-30 gap-4 shadow-sm">
          {/* Active Dataset Selector */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Dataset:</span>
              <select
                aria-label="Active Dataset"
                value={activeDatasetId || ''}
                disabled={isOperator}
                onChange={(e) => {
                  const newId = e.target.value || null;
                  const targetDs = datasets.find((d) => d.id === newId);
                  if (newId && newId !== activeDatasetId) {
                    setIsAnalyzing(true);
                    setLoadingDatasetName(targetDs?.name || null);
                  }
                  setActiveDatasetId(newId);
                }}
                className="bg-white border border-slate-300 text-slate-700 text-xs rounded-md px-2.5 py-1 font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 max-w-[200px] truncate disabled:bg-slate-100 disabled:text-slate-500"
              >
                {datasets.length === 0 ? (
                  <option value="">No dataset uploaded</option>
                ) : (
                  datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.row_count} rows)
                    </option>
                  ))
                )}
              </select>
            </div>

            {activeDataset && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                Quality: {activeDataset.data_quality_score}%
              </span>
            )}
          </div>

          {/* Dynamic Global Filters / Operator Equipment Scoping */}
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            {isOperator ? (
              // Operator Machine/Line Lock Badge
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-xs font-mono font-medium shadow-sm">
                  <Cpu className="w-3.5 h-3.5 text-emerald-600" />
                  Assigned Machine: <strong className="text-emerald-950 font-bold">{user?.assignedMachine || 'Press-101'}</strong>
                </span>
                {user?.assignedLine && (
                  <span className="inline-flex items-center px-2 py-1 bg-slate-100 border border-slate-200 text-slate-700 rounded-md text-xs font-mono">
                    Line: <strong>{user.assignedLine}</strong>
                  </span>
                )}
              </div>
            ) : (
              // Admin Machine Filter
              uniqueMachines.length > 0 && (
                <select
                  aria-label="Filter by Machine"
                  value={filters.machineId}
                  onChange={(e) => setFilters({ machineId: e.target.value })}
                  className="bg-white border border-slate-300 text-slate-600 text-xs rounded px-2 py-1 focus:outline-none focus:border-blue-500"
                >
                  <option value="ALL">All Machines ({uniqueMachines.length})</option>
                  {uniqueMachines.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              )
            )}

            {/* Shift Filter */}
            {uniqueShifts.length > 0 && (
              <select
                aria-label="Filter by Shift"
                value={filters.shift}
                onChange={(e) => setFilters({ shift: e.target.value })}
                className="bg-white border border-slate-300 text-slate-600 text-xs rounded px-2 py-1 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Shifts</option>
                {uniqueShifts.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}

            {/* Product Filter */}
            {uniqueProducts.length > 0 && (
              <select
                aria-label="Filter by Product"
                value={filters.productId}
                onChange={(e) => setFilters({ productId: e.target.value })}
                className="bg-white border border-slate-300 text-slate-600 text-xs rounded px-2 py-1 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Products</option>
                {uniqueProducts.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            )}

            {/* Line Filter (for Admin) */}
            {!isOperator && uniqueLines.length > 0 && (
              <select
                aria-label="Filter by Line"
                value={filters.lineId}
                onChange={(e) => setFilters({ lineId: e.target.value })}
                className="bg-white border border-slate-300 text-slate-600 text-xs rounded px-2 py-1 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Lines</option>
                {uniqueLines.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            )}

            {isFiltered && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 text-[11px] text-amber-700 hover:text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 transition-all"
                title="Reset all active filters"
              >
                <FilterX className="w-3 h-3" />
                Reset
              </button>
            )}
          </div>

          {/* Quick Action & AI Assistant Button */}
          <div className="flex items-center gap-2.5">
            {/* Interactive AI Chatbot Launch Button */}
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-lg transition-all shadow-sm shadow-blue-200"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Ask AI Copilot</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </button>

            {/* Upload Data button is strictly Admin-only */}
            {!isOperator && (
              <button
                onClick={() => navigate('/data-management')}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-all border border-slate-200"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                Upload Data
              </button>
            )}

            {/* USER PROFILE DROPDOWN (Image 2 Right Corner Trigger) */}
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                id="top-profile-menu-button"
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all shadow-sm ${
                  isProfileMenuOpen
                    ? 'bg-blue-50 border-blue-300 text-blue-800 ring-2 ring-blue-100'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
                title="View Profile Details & Logout"
              >
                <div
                  className={`w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-sm ${
                    isOperator ? 'bg-emerald-600' : 'bg-blue-600'
                  }`}
                >
                  {userInitials}
                </div>
                <span className="hidden md:inline font-bold text-slate-800 text-xs">
                  {roleName}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                    isProfileMenuOpen ? 'rotate-180 text-blue-600' : ''
                  }`}
                />
              </button>

              {/* PROFILE DETAILS & LOGOUT DROPDOWN POPOVER */}
              {isProfileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl bg-white border border-slate-200 shadow-2xl py-3 px-4 z-50 animate-fadeIn text-slate-800 text-xs">
                  {/* Header Summary */}
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                    <div
                      className={`w-10 h-10 rounded-full text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-md ${
                        isOperator ? 'bg-emerald-600' : 'bg-blue-600'
                      }`}
                    >
                      {userInitials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="font-bold text-sm text-slate-900 truncate">
                          {roleName}
                        </h4>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isOperator
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {roleName}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
                        {user?.email || (isOperator ? 'operator@flowforge.ai' : 'admin@flowforge.ai')}
                      </p>
                    </div>
                  </div>

                  {/* Profile Details */}
                  <div className="py-2.5 space-y-2 border-b border-slate-100 text-[11px]">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400">Terminal Role:</span>
                      <span className="font-semibold text-slate-800">{roleName}</span>
                    </div>

                    {isOperator ? (
                      <>
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="text-slate-400">Assigned Machine:</span>
                          <span className="font-mono font-bold text-emerald-700">
                            {user?.assignedMachine || 'Press-101'}
                          </span>
                        </div>
                        {user?.assignedLine && (
                          <div className="flex items-center justify-between text-slate-600">
                            <span className="text-slate-400">Assigned Line:</span>
                            <span className="font-mono font-bold text-slate-700">
                              {user.assignedLine}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="text-slate-400">System Scope:</span>
                          <span className="font-medium text-emerald-800">
                            Production Monitoring Only
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400">System Scope:</span>
                        <span className="font-medium text-blue-800">
                          Full Plant Admin & Config
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-slate-600 pt-1">
                      <span className="text-slate-400">Backend Engine:</span>
                      <span
                        className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          isSupabaseConfigured
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {isSupabaseConfigured ? 'Live Supabase' : 'Local Sandbox'}
                      </span>
                    </div>
                  </div>

                  {/* Actions: Switch & Logout */}
                  <div className="pt-2.5 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        navigate('/login');
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors border border-slate-200 font-medium text-xs"
                    >
                      <span className="flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                        Switch Role / Terminal
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {isOperator ? '→ Admin' : '→ Operator'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg transition-colors font-bold text-xs shadow-sm cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-600" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* PAGE CONTENT ROUTER OUTLET */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-50 relative">
          <Outlet />
        </main>
      </div>

      {/* FLOATING ACTION BUTTON (TRIGGER RIGHT-SIDE CHATBOT) */}
      {!isChatOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 z-40 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full shadow-xl shadow-blue-500/25 flex items-center gap-2.5 hover:scale-105 active:scale-95 transition-all group"
          title="Open AI Operations Copilot"
        >
          <div className="relative">
            <Bot className="w-5 h-5 text-white" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400" />
          </div>
          <span className="text-xs font-bold tracking-tight">AI Copilot</span>
        </button>
      )}

      {/* DOCKED RIGHT-SIDE INTERACTIVE AI CHATBOT */}
      <AiChatbot isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  );
};
