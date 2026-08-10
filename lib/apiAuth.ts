import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// =============================================================================
// Shared server-side auth gate for API route handlers that use the
// service-role client. Verifies the caller sent a valid Supabase session via
// `Authorization: Bearer <access_token>` (the pattern already used correctly
// by app/api/financial/generate and /intelligence) before any service-role
// (RLS-bypassing) work runs.
// =============================================================================

export function bearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  return m ? m[1] : null
}

export interface AuthedUser {
  id: string
  email?: string | null
}

type ServerClient = NonNullable<ReturnType<typeof createServerClient>>

export interface RequireUserOk {
  user: AuthedUser
  supabase: ServerClient
}

/** Verifies the request carries a valid Supabase session. Returns the authed
 * user + a service-role client on success, or null on any failure — check
 * with `if (!auth) return unauthorized()`. */
export async function requireUser(req: NextRequest): Promise<RequireUserOk | null> {
  const supabase = createServerClient()
  if (!supabase) return null
  const token = bearerToken(req)
  if (!token) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return null
  return { user: { id: data.user.id, email: data.user.email }, supabase }
}

/** Standard 401 response for requireUser() failures. */
export function unauthorized(message = 'Missing or invalid authorization.'): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status: 401 })
}
