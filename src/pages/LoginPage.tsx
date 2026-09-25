import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Sliders,
  Flame,
  AlertCircle,
  Cpu,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types/database';
import { GoogleAccountModal } from '../components/common/GoogleAccountModal';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    signIn,
    signInDemo,
    signInWithGoogle,
    signInWithGoogleDirect,
    signOut,
    signUp,
    isSupabaseConfigured,
  } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [selectedRole, setSelectedRole] = useState<UserRole>('Admin');
  const [assignedMachine, setAssignedMachine] = useState('Press-101');
  const [assignedLine, setAssignedLine] = useState('Line-A');
  const [email, setEmail] = useState('admin@flowforge.ai');
  const [password, setPassword] = useState('industrial2026!');
  const [name, setName] = useState('Admin');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [showGmailDirect, setShowGmailDirect] = useState(false);
  const [gmailInput, setGmailInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || '/';

  // Demo 1-click accounts: Admin and Operator ONLY
  const DEMO_ACCOUNTS = [
    {
      name: 'Admin',
      role: 'Admin' as UserRole,
      email: 'admin@flowforge.ai',
      badge: 'Full Plant Admin & Config',
      color: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
    },
    {
      name: 'Operator',
      role: 'Operator' as UserRole,
      email: 'operator@flowforge.ai',
      badge: 'Assigned: Press-101 (Line-A)',
      assignedMachine: 'Press-101',
      assignedLine: 'Line-A',
      color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    },
  ];

  const handleDemoLogin = (account: typeof DEMO_ACCOUNTS[0]) => {
    signInDemo({
      name: account.name,
      email: account.email,
      role: account.role,
      assignedMachine: account.assignedMachine,
      assignedLine: account.assignedLine,
    });
    navigate(from, { replace: true });
  };

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
    if (role === 'Admin') {
      setEmail('admin@flowforge.ai');
      setName('Admin');
    } else {
      setEmail('operator@flowforge.ai');
      setName('Operator');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        const { error } = await signIn(
          email,
          password,
          selectedRole,
          selectedRole === 'Operator' ? assignedMachine : undefined,
          selectedRole === 'Operator' ? assignedLine : undefined
        );
        if (error) {
          setErrorMessage(error.message);
          setLoading(false);
          return;
        }
      } else {
        const { error } = await signUp(
          email,
          password,
          name,
          selectedRole,
          selectedRole === 'Operator' ? assignedMachine : undefined,
          selectedRole === 'Operator' ? assignedLine : undefined
        );
        if (error) {
          setErrorMessage(error.message);
          setLoading(false);
          return;
        }
      }
      navigate(from, { replace: true });
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGmailDirectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gmailInput.trim()) return;
    signInWithGoogleDirect(
      gmailInput.trim(),
      undefined,
      selectedRole,
      selectedRole === 'Operator' ? assignedMachine : undefined,
      selectedRole === 'Operator' ? assignedLine : undefined
    );
    navigate(from, { replace: true });
  };

  // When user clicks Continue with Google, open the Google Account login modal
  const handleGoogleSignIn = () => {
    setErrorMessage(null);
    setIsGoogleModalOpen(true);
  };

  // Called when user selects or authenticates an account in the Google modal
  const handleGoogleAccountSelected = (selectedEmail: string, accountName: string) => {
    setIsGoogleModalOpen(false);
    signInWithGoogleDirect(
      selectedEmail,
      accountName,
      selectedRole,
      selectedRole === 'Operator' ? assignedMachine : undefined,
      selectedRole === 'Operator' ? assignedLine : undefined
    );
    navigate(from, { replace: true });
  };

  // Optional: direct redirect to Supabase OAuth provider
  const handleLiveOAuthRedirect = async () => {
    setErrorMessage(null);
    setGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setErrorMessage(
          `${error.message}. Please select your Google account directly from the list.`
        );
      }
    } catch (err: any) {
      setErrorMessage(
        `${err.message || 'Google Sign-In failed'}. Please select your Google account directly.`
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-blue-600 selection:text-white font-sans relative overflow-hidden">
      {/* Background industrial grid & glow accents */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-blue-600/15 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[300px] bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none" />

      {/* HEADER LOGO */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10">
        <div className="inline-flex items-center gap-3 p-2 px-3.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-black text-white text-xl shadow-lg shadow-blue-500/25">
            F
          </div>
          <div className="text-left">
            <h2 className="text-base font-black tracking-tight text-white flex items-center gap-1.5">
              FLOWFORGE <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">AI</span>
            </h2>
            <p className="text-[11px] text-slate-400 font-mono">Production Intelligence & OEE</p>
          </div>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-white">
          {mode === 'signin' ? 'Sign In to Operations Console' : 'Create FLOWFORGE AI Account'}
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          Role-governed terminal access for Admins and Station Operators.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-xl relative z-10 px-4 sm:px-0">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6">
          {/* CURRENTLY SIGNED IN USER BANNER */}
          {user && (
            <div className="p-4 rounded-xl bg-blue-950/60 border border-blue-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-md">
                  {user.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-white truncate">Currently Signed In: {user.name}</p>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                        user.role === 'Admin'
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      {user.role}
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-300 font-mono truncate">
                    {user.email}
                    {user.role === 'Operator' && user.assignedMachine && (
                      <span className="text-slate-400"> • Machine: {user.assignedMachine}</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => navigate(user.role === 'Operator' ? '/oee' : '/')}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors shadow-sm"
                >
                  Go to Console →
                </button>
                <button
                  type="button"
                  onClick={async () => await signOut()}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 text-xs rounded-lg transition-colors border border-slate-700"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}

          {/* QUICK DEMO LOGIN BUTTONS */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Quick 1-Click Role Login
              </span>
              <span className="text-[11px] font-mono text-slate-500">Admin & Operator Roles</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DEMO_ACCOUNTS.map((account, idx) => (
                <button
                  key={idx}
                  onClick={() => handleDemoLogin(account)}
                  className={`p-3.5 rounded-xl border text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${account.color} hover:bg-slate-800/80 group flex flex-col justify-between`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-xs text-white group-hover:text-blue-300 transition-colors">
                        {account.name}
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-900/80 border border-slate-700">
                        {account.role}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{account.email}</div>
                  </div>
                  <div className="mt-3 text-[10px] font-mono opacity-90 flex items-center justify-between">
                    <span>{account.badge}</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ROLE SELECTOR */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-blue-400" />
              Select Terminal Role
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleRoleChange('Admin')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all text-left flex flex-col gap-0.5 ${
                  selectedRole === 'Admin'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300 ring-1 ring-blue-500'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">Admin</span>
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-blue-500/20 text-blue-300">
                    Full Access
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">All analytics, data & config</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleChange('Operator')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all text-left flex flex-col gap-0.5 ${
                  selectedRole === 'Operator'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">Operator</span>
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300">
                    Monitoring Only
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">Assigned machine/line view</span>
              </button>
            </div>

            {/* Operator Machine / Line Assignment */}
            {selectedRole === 'Operator' && (
              <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2.5 animate-fadeIn">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-emerald-400" />
                    Assigned Machine
                  </label>
                  <input
                    type="text"
                    required
                    value={assignedMachine}
                    onChange={(e) => setAssignedMachine(e.target.value)}
                    placeholder="e.g. Press-101"
                    className="w-full bg-slate-900 border border-slate-700 text-emerald-300 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Assigned Line
                  </label>
                  <input
                    type="text"
                    value={assignedLine}
                    onChange={(e) => setAssignedLine(e.target.value)}
                    placeholder="e.g. Line-A"
                    className="w-full bg-slate-900 border border-slate-700 text-emerald-300 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* DIVIDER */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-slate-900 px-3 text-slate-500 font-mono uppercase text-[10px]">
                sign in with
              </span>
            </div>
          </div>

          {/* GOOGLE SIGN-IN BUTTON */}
          <div className="space-y-2">
            <button
              type="button"
              id="google-signin-btn"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              title="Sign in with your Google account (opens Google Account selector)"
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm shadow-sm hover:shadow-md active:scale-[0.98] transition-all cursor-pointer"
            >
              {/* Google SVG Logo */}
              <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              {googleLoading ? (
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  Connecting to Google...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  Continue with Google <span className="text-slate-400 font-normal">({selectedRole})</span>
                </span>
              )}
            </button>

            {/* Direct Gmail Login Trigger */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setShowGmailDirect(!showGmailDirect)}
                className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors font-medium cursor-pointer"
              >
                {showGmailDirect
                  ? 'Hide Direct Gmail Login'
                  : 'Or sign in directly with your Gmail ID'}
              </button>
            </div>

            {/* Direct Gmail Address Input Form */}
            {showGmailDirect && (
              <form
                onSubmit={handleGmailDirectSubmit}
                className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5 mt-2 animate-fadeIn"
              >
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <label className="text-[11px] text-slate-300 font-semibold block">
                    Enter your Gmail / Google account address:
                  </label>
                </div>
                <div className="flex gap-2">
                  <input
                    type="email"
                    required
                    placeholder="user@gmail.com"
                    value={gmailInput}
                    onChange={(e) => setGmailInput(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors shrink-0 shadow-sm"
                  >
                    Sign In
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  Logs into FLOWFORGE AI with role <strong className="text-slate-300">{selectedRole}</strong> without requiring remote OAuth redirection.
                </p>
              </form>
            )}
          </div>

          {/* Secondary divider before manual credentials */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-slate-900 px-3 text-slate-500 font-mono uppercase text-[10px]">
                or continue with credentials
              </span>
            </div>
          </div>

          {/* ERROR ALERT */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* FORM */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Corporate Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@flowforge.ai"
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-300">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0"
                />
                <span>Remember this terminal</span>
              </label>

              <button
                type="button"
                onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                className="text-blue-400 hover:text-blue-300 font-medium"
              >
                {mode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 hover:shadow-blue-600/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Authenticating terminal...</span>
              ) : (
                <>
                  <span>
                    {mode === 'signin'
                      ? `Sign In as ${selectedRole}`
                      : `Register as ${selectedRole}`}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* BACKEND STATUS NOTICE */}
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              Role-Based Access Control (RBAC) Active
            </span>
            <span className="font-mono text-slate-400">
              {isSupabaseConfigured ? 'Supabase Live Auth' : 'Local Auth Mode'}
            </span>
          </div>
        </div>

        {/* FEATURE PILLS FOOTER */}
        <div className="mt-6 grid grid-cols-3 gap-3 text-center text-slate-400 text-xs font-medium">
          <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/60 flex items-center justify-center gap-2">
            <Flame className="w-4 h-4 text-rose-500" />
            <span>Bottleneck AI</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/60 flex items-center justify-center gap-2">
            <Sliders className="w-4 h-4 text-blue-500" />
            <span>Risk Simulator</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/60 flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>AI Copilot</span>
          </div>
        </div>
      </div>

      {/* GOOGLE ACCOUNT CHOOSER / AUTHENTIC LOGIN MODAL */}
      <GoogleAccountModal
        isOpen={isGoogleModalOpen}
        onClose={() => setIsGoogleModalOpen(false)}
        onSelectAccount={handleGoogleAccountSelected}
        onLiveOAuthRedirect={handleLiveOAuthRedirect}
        isSupabaseConfigured={isSupabaseConfigured}
        selectedRole={selectedRole}
      />
    </div>
  );
};
