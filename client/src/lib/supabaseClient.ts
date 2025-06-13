import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
if (!supabaseUrl) {
  throw new Error('Missing environment variable: VITE_SUPABASE_URL');
}
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
if (!supabaseAnonKey) {
  throw new Error('Missing environment variable: VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey); 