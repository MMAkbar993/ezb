import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Server-only Supabase client using the service-role key (bypasses RLS).
// IMPORTANT: Only import this from Server Components / Route Handlers. Never
// import it into a module that also reaches the browser bundle. The service
// key must never be exposed to the client.
//
// Returns null (not throws) when env isn't configured so callers can degrade
// gracefully (e.g. sitemap emitting static routes only).
// ---------------------------------------------------------------------------

export const runtime = 'nodejs'

export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
