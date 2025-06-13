import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Logger utility
const DEBUG = process.env.NODE_ENV === 'development';

const logger = {
  error: (message: string, error?: unknown) => {
    console.error(`[Middleware] ${message}`, error);
  }
};

function getEnv() {
  const requiredVars = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };

  const missingVars = Object.entries(requiredVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  return requiredVars as { [K in keyof typeof requiredVars]: string };
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  try {
    const env = getEnv();
    const supabase = createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            response.cookies.set({
              name,
              value,
              ...options,
            })
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.set({
              name,
              value: '',
              ...options,
            })
          },
        },
        global: {
          headers: {
            Authorization: request.headers.get('Authorization') || '',
          },
        },
      }
    )

    const { error } = await supabase.auth.getSession();
    if (error) {
      // Log the error for debugging
      logger.error('Failed to get session:', error);
      
      // Clear any potentially corrupted auth cookies
      response.cookies.set({
        name: 'sb:token',
        value: '',
        path: '/',
        expires: new Date(0),
      });
      
      // Continue with the request, but without a valid session
      // This allows the application to handle unauthenticated requests gracefully
    }
  } catch (error) {
    // Handle environment variable validation errors
    logger.error('Environment validation failed:', error);
    
    // Return a 500 response for server configuration errors
    return new NextResponse(
      JSON.stringify({ error: 'Server configuration error' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
} 