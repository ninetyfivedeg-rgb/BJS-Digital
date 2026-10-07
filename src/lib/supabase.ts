import { createClient } from '@supabase/supabase-js';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabasePublishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();

/**
 * Normalisasi URL Supabase agar selalu menggunakan base project URL.
 * Menghapus suffix seperti /rest/v1/, /rest/v1, dan trailing slash.
 */
function normalizeSupabaseUrl(url: string): string {
  if (!url) return 'https://placeholder.supabase.co';
  let clean = url.trim();
  try {
    const parsed = new URL(clean);
    // Mengambil protocol + hostname (misal: https://xyz.supabase.co)
    clean = parsed.origin;
  } catch {
    clean = clean.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  }
  return clean || 'https://placeholder.supabase.co';
}

export const cleanSupabaseUrl = normalizeSupabaseUrl(rawUrl);

export const isSupabaseConfigured = Boolean(
  rawUrl && supabasePublishableKey
);

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY) are not set. Supabase client initialized with fallback placeholder.'
  );
}

export const supabase = createClient(
  cleanSupabaseUrl,
  supabasePublishableKey || 'placeholder-publishable-key'
);
