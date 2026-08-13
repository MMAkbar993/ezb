import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// POST /api/team/invite/accept — public, token-based. The person accepting
// has no account yet, so this can't go through requireUser. Creates the
// Supabase Auth user via the admin API (service role only), then upserts
// their `profiles` row with the role the ADMIN chose at invite time (never
// taken from the request body) — this is the actual privilege-escalation
// guard: nothing here reads a client-supplied role.
// ---------------------------------------------------------------------------

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const svc = createServerClient()
  if (!svc) return NextResponse.json({ ok: false, error: 'Not configured.' }, { status: 503 })

  let body: { token?: string; password?: string; fullName?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 })
  }

  const token = (body.token || '').trim()
  const password = body.password || ''
  const fullName = (body.fullName || '').trim()
  if (!token || password.length < 8 || !fullName) {
    return NextResponse.json({ ok: false, error: 'Full name and a password of at least 8 characters are required.' }, { status: 400 })
  }

  const { data: invite, error: inviteErr } = await svc
    .from('team_invites')
    .select('id, email, role, status, expires_at')
    .eq('token', token)
    .maybeSingle()
  if (inviteErr || !invite) return NextResponse.json({ ok: false, error: 'This invite link is invalid.' }, { status: 404 })
  if (invite.status !== 'pending') return NextResponse.json({ ok: false, error: 'This invite has already been used or revoked.' }, { status: 410 })
  if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ ok: false, error: 'This invite has expired.' }, { status: 410 })

  const { data: created, error: createErr } = await svc.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (createErr || !created?.user) {
    const msg = createErr?.message?.includes('already been registered')
      ? 'An account with this email already exists — sign in instead.'
      : createErr?.message || 'Failed to create account'
    return NextResponse.json({ ok: false, error: msg }, { status: 400 })
  }

  const newUserId = created.user.id

  const { error: profileErr } = await svc
    .from('profiles')
    .upsert({ id: newUserId, email: invite.email, full_name: fullName, role: invite.role, status: 'active' }, { onConflict: 'id' })
  if (profileErr) {
    return NextResponse.json({ ok: false, error: profileErr.message }, { status: 500 })
  }

  await svc.from('team_invites').update({ status: 'accepted', accepted_by: newUserId, accepted_at: new Date().toISOString() }).eq('id', invite.id)

  return NextResponse.json({ ok: true, email: invite.email })
}
