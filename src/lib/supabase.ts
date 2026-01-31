import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
  );
}

// Client for browser/frontend usage (uses anon key with RLS)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Server client factory for API routes (uses service key, bypasses RLS)
export function createServerClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!serviceKey) {
    throw new Error('Missing SUPABASE_SERVICE_KEY environment variable');
  }

  return createClient<Database>(supabaseUrl!, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Re-export types for convenience
export type { Database } from '@/types/database';
