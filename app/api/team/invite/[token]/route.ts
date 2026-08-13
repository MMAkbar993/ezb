import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireUser, unauthorized } from '@/lib/apiAuth'

// ---------------------------------------------------------------------------
// GET  — public lookup by token (no auth — the token IS the auth, same
//        pattern as app/api/seller-form). Used by the accept page to show
//        "you're invited as a Broker" before the person creates a password.
// PATCH — admin-only: revoke a pending invite.
// ---------------------------------------------------------------------------

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const svc = createServerClient()
  if (!svc) return NextResponse.json({ ok: false, error: 'Not configured.' }, { status: 503 })

  const { data: invite, error } = await svc
    .from('team_invites')
    .select('email, role, status, expires_at')
    .eq('token', params.token)
    .maybeSingle()
  if (error || !invite) return NextResponse.json({ ok: false, error: 'This invite link is invalid.' }, { status: 404 })
  if (invite.status !== 'pending') return NextResponse.json({ ok: false, error: 'This invite has already been used or revoked.' }, { status: 410 })
  if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ ok: false, error: 'This invite has expired.' }, { status: 410 })

  return NextResponse.json({ ok: true, email: invite.email, role: invite.role })
}

export async function PATCH(req: NextRequest, { params }: { params: { token: string } }) {
  const auth = await requireUser(req)
  if (!auth) return unauthorized()
  const { data: profile, error: profErr } = await auth.supabase.from('profiles').select('role').eq('id', auth.user.id).maybeSingle()
  if (profErr || profile?.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Admin access required.' }, { status: 403 })
  }

  const { error } = await auth.supabase
    .from('team_invites')
    .update({ status: 'revoked' })
    .eq('token', params.token)
    .eq('status', 'pending')
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
