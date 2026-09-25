import React, { useState } from 'react';
import { User, ArrowRight, Check, X, Shield, Lock, ExternalLink, ChevronRight } from 'lucide-react';

interface GoogleAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAccount: (email: string, name: string) => void;
  onLiveOAuthRedirect?: () => void;
  isSupabaseConfigured?: boolean;
  selectedRole?: 'Admin' | 'Operator';
}

export const GoogleAccountModal: React.FC<GoogleAccountModalProps> = ({
  isOpen,
  onClose,
  onSelectAccount,
  onLiveOAuthRedirect,
  isSupabaseConfigured = false,
  selectedRole = 'Operator',
}) => {
  const [view, setView] = useState<'chooser' | 'enter_email' | 'enter_password' | 'authenticating'>('chooser');
  const [customEmail, setCustomEmail] = useState('');
  const [customPassword, setCustomPassword] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [selectedEmail, setSelectedEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const defaultAccounts = [
    {
      name: 'Abishek Raj',
      email: 'abishekrajsrinivasan@gmail.com',
      avatarColor: 'bg-emerald-600',
      initials: 'AR',
      badge: selectedRole === 'Operator' ? 'Recommended for Operator' : 'Personal Google Account',
    },
    {
      name: 'FlowForge Production Lead',
      email: 'operations@flowforge.ai',
      avatarColor: 'bg-blue-600',
      initials: 'FF',
      badge: 'FlowForge Workspace Account',
    },
  ];

  const handlePickAccount = (name: string, email: string) => {
    setSelectedName(name);
    setSelectedEmail(email);
    setView('authenticating');
    setTimeout(() => {
      onSelectAccount(email, name);
    }, 900);
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const email = customEmail.trim();
    if (!email) {
      setErrorMsg('Enter an email address');
      return;
    }
    if (!email.includes('@')) {
      setErrorMsg('Enter a valid email address');
      return;
    }
    const namePart = email.split('@')[0];
    const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    setSelectedName(formattedName);
    setSelectedEmail(email);
    setView('enter_password');
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setView('authenticating');
    setTimeout(() => {
      onSelectAccount(selectedEmail, selectedName);
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-[440px] bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 text-slate-800 transition-all font-sans">
        
        {/* Animated Google Progress Bar when authenticating */}
        {view === 'authenticating' && (
          <div className="h-1 w-full bg-slate-100 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-red-500 via-amber-400 to-emerald-500 animate-pulse" />
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-10"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 sm:p-10 space-y-6">
          {/* Google Official Logo */}
          <div className="flex flex-col items-center text-center">
            <svg viewBox="0 0 24 24" className="w-9 h-9 mb-3" aria-hidden="true">
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

            {view === 'chooser' && (
              <>
                <h2 className="text-2xl font-normal text-slate-800 tracking-tight">Choose an account</h2>
                <p className="text-sm text-slate-600 mt-1">
                  to continue to <strong className="text-slate-900 font-semibold">FlowForge AI</strong>
                </p>
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium">
                  Signing in as: <strong>{selectedRole}</strong>
                </div>
              </>
            )}

            {view === 'enter_email' && (
              <>
                <h2 className="text-2xl font-normal text-slate-800 tracking-tight">Sign in with Google</h2>
                <p className="text-sm text-slate-600 mt-1">to continue to FlowForge AI</p>
              </>
            )}

            {view === 'enter_password' && (
              <>
                <h2 className="text-2xl font-normal text-slate-800 tracking-tight">Welcome</h2>
                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-200 bg-slate-50 text-xs text-slate-700">
                  <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                    {selectedName.slice(0, 1).toUpperCase()}
                  </div>
                  <span>{selectedEmail}</span>
                </div>
              </>
            )}

            {view === 'authenticating' && (
              <>
                <h2 className="text-2xl font-normal text-slate-800 tracking-tight">Signing in...</h2>
                <p className="text-sm text-slate-600 mt-1">Connecting to FlowForge AI as {selectedRole}</p>
              </>
            )}
          </div>

          {/* VIEW: CHOOSER */}
          {view === 'chooser' && (
            <div className="space-y-2">
              <div className="divide-y divide-slate-100 border-y border-slate-100 -mx-8 sm:-mx-10">
                {defaultAccounts.map((acc, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handlePickAccount(acc.name, acc.email)}
                    className="w-full px-8 sm:px-10 py-3.5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-9 h-9 rounded-full ${acc.avatarColor} text-white flex items-center justify-center font-semibold text-sm shrink-0 shadow-sm`}>
                        {acc.initials}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 text-sm group-hover:text-blue-600 transition-colors truncate">
                          {acc.name}
                        </div>
                        <div className="text-xs text-slate-500 truncate">{acc.email}</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                ))}

                {/* Option: Use another account */}
                <button
                  type="button"
                  onClick={() => setView('enter_email')}
                  className="w-full px-8 sm:px-10 py-3.5 flex items-center gap-3.5 text-left hover:bg-slate-50 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 group-hover:border-blue-500 group-hover:text-blue-600 shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="font-medium text-slate-800 text-sm group-hover:text-blue-600 transition-colors">
                    Use another account
                  </div>
                </button>
              </div>

              {/* Live Supabase OAuth Redirect Option (if available) */}
              {isSupabaseConfigured && onLiveOAuthRedirect && (
                <div className="pt-3 text-center">
                  <button
                    type="button"
                    onClick={onLiveOAuthRedirect}
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 hover:underline font-medium"
                  >
                    <span>Use direct Google OAuth redirect URL</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* VIEW: ENTER EMAIL */}
          {view === 'enter_email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Email or phone
                </label>
                <input
                  type="email"
                  autoFocus
                  required
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  placeholder="yourname@gmail.com"
                  className="w-full px-3.5 py-3 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 text-sm transition-all"
                />
                {errorMsg && <p className="text-xs text-rose-600 mt-1.5">{errorMsg}</p>}
                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomEmail('guest.operator@gmail.com');
                    }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Use sample email
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-500 leading-relaxed">
                To continue, Google will share your name, email address, language preference, and profile picture with FlowForge AI.
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setView('chooser')}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  Back to accounts
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium text-sm transition-all shadow-sm shadow-blue-200"
                >
                  Next
                </button>
              </div>
            </form>
          )}

          {/* VIEW: ENTER PASSWORD */}
          {view === 'enter_password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Enter your password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoFocus
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full px-3.5 py-3 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 text-sm transition-all"
                  />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="showPass"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="showPass" className="text-xs text-slate-600 cursor-pointer">
                    Show password
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setView('enter_email')}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium text-sm transition-all shadow-sm shadow-blue-200"
                >
                  Next
                </button>
              </div>
            </form>
          )}

          {/* VIEW: AUTHENTICATING SPINNER */}
          {view === 'authenticating' && (
            <div className="py-8 flex flex-col items-center justify-center space-y-4">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500 font-mono">
                Authenticating {selectedEmail}...
              </p>
            </div>
          )}

          {/* Bottom Security / Privacy Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-slate-400" />
              Google Verified Identity
            </span>
            <div className="flex items-center gap-3">
              <span className="hover:underline cursor-pointer">Help</span>
              <span className="hover:underline cursor-pointer">Privacy</span>
              <span className="hover:underline cursor-pointer">Terms</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
