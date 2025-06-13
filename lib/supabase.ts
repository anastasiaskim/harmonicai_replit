import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL')
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

const SUPABASE_URL: string = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY: string = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create a single supabase client for interacting with your database
export const supabase = createSupabaseClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
)

export async function createClient() {
  try {
    const cookieStore = await cookies();
    return createServerClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        cookies: cookieStore,
      }
    );
  } catch (error) {
    console.error('Error retrieving cookies:', error);
    // Return a fallback client or handle the error as needed
    return createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} 