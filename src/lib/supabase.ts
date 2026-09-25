import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_CONFIG_CHANGED_EVENT = 'ff-supabase-config-changed';

const getStoredConfig = (key: string): string => {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(key) || '';
};

// Retrieve credentials from localStorage first (for in-app configuration) or Vite env
export const getSupabaseConfig = () => {
  const localUrl = getStoredConfig('ff_supabase_url');
  const localKey = getStoredConfig('ff_supabase_anon_key');

  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const url = localUrl || envUrl || '';
  const key = localKey || envKey || '';

  const isConfigured = Boolean(url && key && url.startsWith('http') && !url.includes('your-project'));

  return { url, key, isConfigured };
};

export const setSupabaseConfig = (url: string, key: string) => {
  localStorage.setItem('ff_supabase_url', url.trim());
  localStorage.setItem('ff_supabase_anon_key', key.trim());
  reinitializeSupabase();
  window.dispatchEvent(new Event(SUPABASE_CONFIG_CHANGED_EVENT));
};

export const onSupabaseConfigChanged = (listener: () => void) => {
  window.addEventListener(SUPABASE_CONFIG_CHANGED_EVENT, listener);
  return () => window.removeEventListener(SUPABASE_CONFIG_CHANGED_EVENT, listener);
};

let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient | null => {
  if (supabaseInstance) return supabaseInstance;

  const { url, key, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return null;

  try {
    supabaseInstance = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    return supabaseInstance;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
};

export const reinitializeSupabase = (): SupabaseClient | null => {
  supabaseInstance = null;
  return getSupabase();
};

/**
 * Uploads a raw CSV/XLSX file to the private Supabase Storage bucket 'production-datasets'
 */
export const uploadDatasetFile = async (
  file: File,
  datasetId: string,
  userId?: string | null
): Promise<{ path: string | null; error: Error | null }> => {
  const supabase = getSupabase();
  if (!supabase) {
    return { path: null, error: new Error('Supabase client is not configured') };
  }

  const fileExt = file.name.split('.').pop();
  const filePath = `${userId || 'unassigned'}/${datasetId}_${Date.now()}.${fileExt}`;

  const { error } = await supabase.storage
    .from('production-datasets')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.warn('Storage upload error (fallback allowed if bucket not created):', error);
    return { path: null, error };
  }

  return { path: filePath, error: null };
};

/**
 * Downloads a dataset file from Supabase Storage
 */
export const downloadDatasetFile = async (filePath: string): Promise<Blob | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.storage
    .from('production-datasets')
    .download(filePath);

  if (error) {
    console.error('Error downloading dataset file:', error);
    return null;
  }

  return data;
};
