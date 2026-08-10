import { supabase } from '@/lib/supabase/client'

// =============================================================================
// Client-side fetch wrapper that attaches the current Supabase session's
// access token as `Authorization: Bearer <token>`, for calling API routes
// gated by lib/apiAuth.ts's requireUser(). Falls back to a plain fetch with
// no auth header if there's no active session — the route will 401 as usual.
// =============================================================================
export async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const headers = new Headers(init.headers || {})
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(input, { ...init, headers })
}
