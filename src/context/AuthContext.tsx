import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { getSupabase, onSupabaseConfigChanged } from '../lib/supabase';
import { UserRole } from '../types/database';

export interface AppUser {
  id: string;
  email: string;
  name: string; // Strictly "Admin" or "Operator"
  role: UserRole;
  assignedMachine?: string;
  assignedLine?: string;
  avatar?: string;
}

interface AuthContextType {
  user: AppUser | null;
  supabaseUser: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (
    email: string,
    pass: string,
    role?: UserRole,
    assignedMachine?: string,
    assignedLine?: string
  ) => Promise<{ error: Error | null }>;
  signInDemo: (account: {
    email: string;
    name?: string;
    role: UserRole;
    assignedMachine?: string;
    assignedLine?: string;
  }) => void;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithGoogleDirect: (
    email: string,
    name?: string,
    role?: UserRole,
    assignedMachine?: string,
    assignedLine?: string
  ) => void;
  signUp: (
    email: string,
    pass: string,
    name?: string,
    role?: UserRole,
    assignedMachine?: string,
    assignedLine?: string
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isSupabaseConfigured: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_USER_STORAGE_KEY = 'ff_auth_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [supabase, setSupabase] = useState(() => getSupabase());
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // App User: strictly Admin or Operator
  const [user, setUser] = useState<AppUser | null>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_USER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Normalize role & name to Admin or Operator only
        const role: UserRole = parsed.role === 'Operator' ? 'Operator' : 'Admin';
        const name: string = role;
        return {
          ...parsed,
          name,
          role,
        };
      }
    } catch (e) {
      console.error('Failed to parse local auth user:', e);
    }
    return null;
  });

  const isSupabaseConfigured = Boolean(supabase);

  useEffect(() => onSupabaseConfigChanged(() => setSupabase(getSupabase())), []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setSupabaseUser(session?.user ?? null);
      if (session?.user) {
        const email = session.user.email || 'admin@flowforge.ai';
        const rawRole = session.user.user_metadata?.role;
        const role: UserRole =
          rawRole === 'Operator' || email.toLowerCase().includes('operator') ? 'Operator' : 'Admin';
        const name: string = role;
        const assignedMachine =
          session.user.user_metadata?.assigned_machine ||
          session.user.user_metadata?.assignedMachine ||
          (role === 'Operator' ? 'Press-101' : undefined);
        const assignedLine =
          session.user.user_metadata?.assigned_line ||
          session.user.user_metadata?.assignedLine ||
          (role === 'Operator' ? 'Line-A' : undefined);

        const appUser: AppUser = {
          id: session.user.id,
          email,
          name,
          role,
          assignedMachine,
          assignedLine,
        };
        setUser(appUser);
        localStorage.setItem(LOCAL_USER_STORAGE_KEY, JSON.stringify(appUser));
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setSupabaseUser(session?.user ?? null);
      if (session?.user) {
        const email = session.user.email || 'admin@flowforge.ai';
        const rawRole = session.user.user_metadata?.role;
        const role: UserRole =
          rawRole === 'Operator' || email.toLowerCase().includes('operator') ? 'Operator' : 'Admin';
        const name: string = role;
        const assignedMachine =
          session.user.user_metadata?.assigned_machine ||
          session.user.user_metadata?.assignedMachine ||
          (role === 'Operator' ? 'Press-101' : undefined);
        const assignedLine =
          session.user.user_metadata?.assigned_line ||
          session.user.user_metadata?.assignedLine ||
          (role === 'Operator' ? 'Line-A' : undefined);

        const appUser: AppUser = {
          id: session.user.id,
          email,
          name,
          role,
          assignedMachine,
          assignedLine,
        };
        setUser(appUser);
        localStorage.setItem(LOCAL_USER_STORAGE_KEY, JSON.stringify(appUser));
      } else if (!localStorage.getItem(LOCAL_USER_STORAGE_KEY)) {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Demo 1-click login
  const signInDemo = (account: {
    email: string;
    name?: string;
    role: UserRole;
    assignedMachine?: string;
    assignedLine?: string;
  }) => {
    const demoUser: AppUser = {
      id: `demo_${Date.now()}`,
      email: account.email,
      name: account.role, // Strictly "Admin" or "Operator"
      role: account.role,
      assignedMachine: account.assignedMachine,
      assignedLine: account.assignedLine,
    };
    setUser(demoUser);
    localStorage.setItem(LOCAL_USER_STORAGE_KEY, JSON.stringify(demoUser));
  };

  // Sign in with Email / Password
  const signIn = async (
    email: string,
    pass: string,
    explicitRole?: UserRole,
    assignedMachine?: string,
    assignedLine?: string
  ) => {
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: pass,
        });
        if (error) return { error: new Error(error.message) };
        if (data.user) {
          const userMetaRole = data.user.user_metadata?.role as UserRole | undefined;
          const detectedRole: UserRole =
            explicitRole ||
            (userMetaRole === 'Operator' || email.toLowerCase().includes('operator')
              ? 'Operator'
              : 'Admin');

          const userAssignedMachine =
            assignedMachine ||
            data.user.user_metadata?.assigned_machine ||
            data.user.user_metadata?.assignedMachine ||
            (detectedRole === 'Operator' ? 'Press-101' : undefined);

          const userAssignedLine =
            assignedLine ||
            data.user.user_metadata?.assigned_line ||
            data.user.user_metadata?.assignedLine ||
            (detectedRole === 'Operator' ? 'Line-A' : undefined);

          const appUser: AppUser = {
            id: data.user.id,
            email: data.user.email || email,
            name: detectedRole, // Strictly "Admin" or "Operator"
            role: detectedRole,
            assignedMachine: userAssignedMachine,
            assignedLine: userAssignedLine,
          };
          setUser(appUser);
          localStorage.setItem(LOCAL_USER_STORAGE_KEY, JSON.stringify(appUser));
        }
        return { error: null };
      } catch (err: any) {
        return { error: new Error(err.message || 'Authentication failed') };
      }
    }

    // Local / Offline authentication fallback
    if (!email || !pass) {
      return { error: new Error('Please enter both email and password.') };
    }

    const detectedRole: UserRole =
      explicitRole || (email.toLowerCase().includes('operator') ? 'Operator' : 'Admin');
    const userAssignedMachine =
      assignedMachine || (detectedRole === 'Operator' ? 'Press-101' : undefined);
    const userAssignedLine =
      assignedLine || (detectedRole === 'Operator' ? 'Line-A' : undefined);

    const appUser: AppUser = {
      id: `usr_${Date.now()}`,
      email,
      name: detectedRole, // Strictly "Admin" or "Operator"
      role: detectedRole,
      assignedMachine: userAssignedMachine,
      assignedLine: userAssignedLine,
    };
    setUser(appUser);
    localStorage.setItem(LOCAL_USER_STORAGE_KEY, JSON.stringify(appUser));
    return { error: null };
  };

  // Sign in with Google via Supabase OAuth
  const signInWithGoogle = async (): Promise<{ error: Error | null }> => {
    if (!supabase) {
      return {
        error: new Error(
          'Google Sign-In requires Supabase to be configured. Please set up Supabase in Settings.'
        ),
      };
    }
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      if (error) return { error: new Error(error.message) };
      return { error: null };
    } catch (err: any) {
      return {
        error: new Error(err.message || 'Google Sign-In failed. Verify Supabase OAuth configuration.'),
      };
    }
  };

  // Sign up
  const signUp = async (
    email: string,
    pass: string,
    _name?: string,
    role: UserRole = 'Admin',
    assignedMachine?: string,
    assignedLine?: string
  ) => {
    const finalAssignedMachine =
      assignedMachine || (role === 'Operator' ? 'Press-101' : undefined);
    const finalAssignedLine =
      assignedLine || (role === 'Operator' ? 'Line-A' : undefined);

    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: pass,
          options: {
            data: {
              full_name: role,
              role,
              assigned_machine: finalAssignedMachine,
              assigned_line: finalAssignedLine,
            },
          },
        });
        if (error) return { error: new Error(error.message) };
        if (data.user) {
          const appUser: AppUser = {
            id: data.user.id,
            email: data.user.email || email,
            name: role, // Strictly "Admin" or "Operator"
            role,
            assignedMachine: finalAssignedMachine,
            assignedLine: finalAssignedLine,
          };
          setUser(appUser);
          localStorage.setItem(LOCAL_USER_STORAGE_KEY, JSON.stringify(appUser));

          // Also attempt to sync to user_profiles table if available
          try {
            await supabase.from('user_profiles').upsert({
              id: data.user.id,
              email: appUser.email,
              name: role,
              role,
              assigned_machine: finalAssignedMachine,
              assigned_line: finalAssignedLine,
            });
          } catch (profileErr) {
            console.warn('Optional user_profiles sync notice:', profileErr);
          }
        }
        return { error: null };
      } catch (err: any) {
        return { error: new Error(err.message || 'Registration failed') };
      }
    }

    // Local fallback signup
    const appUser: AppUser = {
      id: `usr_${Date.now()}`,
      email,
      name: role, // Strictly "Admin" or "Operator"
      role,
      assignedMachine: finalAssignedMachine,
      assignedLine: finalAssignedLine,
    };
    setUser(appUser);
    localStorage.setItem(LOCAL_USER_STORAGE_KEY, JSON.stringify(appUser));
    return { error: null };
  };

  // Direct Google/Gmail sign in
  const signInWithGoogleDirect = (
    email: string,
    _name?: string,
    role: UserRole = 'Admin',
    assignedMachine?: string,
    assignedLine?: string
  ) => {
    const finalRole: UserRole = email.toLowerCase().includes('operator') ? 'Operator' : role;
    const googleUser: AppUser = {
      id: `google_${Date.now()}`,
      email,
      name: finalRole, // Strictly "Admin" or "Operator"
      role: finalRole,
      assignedMachine: assignedMachine || (finalRole === 'Operator' ? 'Press-101' : undefined),
      assignedLine: assignedLine || (finalRole === 'Operator' ? 'Line-A' : undefined),
      avatar: undefined,
    };
    setUser(googleUser);
    localStorage.setItem(LOCAL_USER_STORAGE_KEY, JSON.stringify(googleUser));
  };

  // Sign out
  const signOut = async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Supabase signOut error:', e);
      }
    }
    setUser(null);
    setSupabaseUser(null);
    setSession(null);
    localStorage.removeItem(LOCAL_USER_STORAGE_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        supabaseUser,
        session,
        loading,
        signIn,
        signInDemo,
        signInWithGoogle,
        signInWithGoogleDirect,
        signUp,
        signOut,
        isSupabaseConfigured,
        isAuthenticated: Boolean(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
