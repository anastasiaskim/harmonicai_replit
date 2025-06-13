/**
 * Infrastructure Layer: Supabase Client
 * Handles Supabase client initialization and configuration
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@shared/schema';
import { config } from 'dotenv-flow';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
config({ path: resolve(__dirname, '../../..') });

// Debug log to print environment variables
if (process.env.NODE_ENV === 'development') {
  console.log('Environment variables status:');
  console.log('SUPABASE_URL:', !!process.env.SUPABASE_URL);
  console.log('SUPABASE_ANON_KEY:', !!process.env.SUPABASE_ANON_KEY);
  console.log('SUPABASE_SERVICE_ROLE_KEY:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Check if environment variables are set
if (!process.env.SUPABASE_URL) {
  throw new Error('Missing SUPABASE_URL environment variable');
}

if (!process.env.SUPABASE_ANON_KEY) {
  throw new Error('Missing SUPABASE_ANON_KEY environment variable');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}

const {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env as Record<string, string>; // assertion is safe after the guards above

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
export const supabaseAdmin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);