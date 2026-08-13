import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { requireUser, unauthorized } from '@/lib/apiAuth'

// ---------------------------------------------------------------------------
// Admin-only team invites. POST creates a new invite (email + role decided
// by the admin, never editable by the person accepting it — see
// sql/team_invites.sql for why). GET lists all invites for the Team page.
// team_invites has zero RLS policies — this route (service-role, with its
// own admin check) is the only way to read or write it.
// ---------------------------------------------------------------------------

export const runtime = 'nodejs'

const VALID_ROLES = ['agent', 'broker', 'admin'] as const

async function requireAdmin(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth) return { error: unauthorized() } as const
  const { data: profile, error } = await auth.supabase.from('profiles').select('role').eq('id', auth.user.id).maybeSingle()
  if (error || profile?.role !== 'admin') {
    return { error: NextResponse.json({ ok: false, error: 'Admin access required.' }, { status: 403 }) } as const
  }
  return { auth } as const
}

export async function POST(req: NextRequest) {
  const check = await requireAdmin(req)
  if (check.error) return check.error
  const { supabase, user } = check.auth

  let body: { email?: string; role?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 })
  }

  const email = (body.email || '').trim().toLowerCase()
  const role = (body.role || '') as (typeof VALID_ROLES)[number]
  if (!email || !VALID_ROLES.includes(role)) {
    return NextResponse.json({ ok: false, error: 'A valid email and role are required.' }, { status: 400 })
  }

  const { data: existingProfile } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle()
  if (existingProfile) {
    return NextResponse.json({ ok: false, error: 'A team member with this email already exists.' }, { status: 409 })
  }

  const token = crypto.randomBytes(32).toString('hex')
  const { data: invite, error } = await supabase
    .from('team_invites')
    .insert({ email, role, token, invited_by: user.id })
    .select('id, email, role, token, status, created_at, expires_at')
    .single()
  if (error || !invite) {
    return NextResponse.json({ ok: false, error: error?.message || 'Failed to create invite' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, invite })
}

export async function GET(req: NextRequest) {
  const check = await requireAdmin(req)
  if (check.error) return check.error
  const { supabase } = check.auth

  const { data, error } = await supabase
    .from('team_invites')
    .select('id, email, role, status, created_at, expires_at, accepted_at')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, invites: data || [] })
}

// Revoke by id (the list endpoint above deliberately never re-exposes the
// token, so revocation is keyed by id rather than app/api/team/invite/[token]).
export async function PATCH(req: NextRequest) {
  const check = await requireAdmin(req)
  if (check.error) return check.error
  const { supabase } = check.auth

  let body: { id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 })
  }
  if (!body.id) return NextResponse.json({ ok: false, error: 'id is required' }, { status: 400 })

  const { error } = await supabase.from('team_invites').update({ status: 'revoked' }).eq('id', body.id).eq('status', 'pending')
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
