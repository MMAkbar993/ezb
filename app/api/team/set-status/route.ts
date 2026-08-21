import { NextRequest, NextResponse } from 'next/server'
import { requireUser, unauthorized } from '@/lib/apiAuth'

// ---------------------------------------------------------------------------
// POST /api/team/set-status — admin-only: activate/deactivate another team
// member's account (profiles.status). Same pattern as /api/team/set-role —
// profiles RLS only allows self-updates, so this is the deliberate,
// server-checked bypass for an admin managing someone else's account.
// A deactivated account is blocked from the dashboard by
// app/dashboard/layout.tsx's auth guard (checks status on every session
// load, signs out + redirects if inactive) — RLS itself doesn't need to
// change since role-scoped policies still apply either way; this just
// stops the account from ever reaching a page that would use them.
// ---------------------------------------------------------------------------

export const runtime = 'nodejs'

const VALID_STATUSES = ['active', 'inactive'] as const
type StatusValue = (typeof VALID_STATUSES)[number]

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth) return unauthorized()
  const { user, supabase } = auth

  let body: { targetId?: string; status?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 })
  }

  const targetId = (body.targetId || '').trim()
  const status = (body.status || '').trim() as StatusValue
  if (!targetId || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ ok: false, error: 'targetId and a valid status are required' }, { status: 400 })
  }

  const { data: callerProfile, error: callerErr } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (callerErr) {
    return NextResponse.json({ ok: false, error: callerErr.message }, { status: 500 })
  }
  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Only an admin can activate or deactivate team members.' }, { status: 403 })
  }

  if (targetId === user.id && status === 'inactive') {
    return NextResponse.json({ ok: false, error: "You can't deactivate your own account." }, { status: 400 })
  }

  const { data: updated, error: updateErr } = await supabase
    .from('profiles')
    .update({ status })
    .eq('id', targetId)
    .select('id, email, full_name, role, status')
    .maybeSingle()
  if (updateErr) {
    return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 })
  }
  if (!updated) {
    return NextResponse.json({ ok: false, error: 'Team member not found.' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, profile: updated })
}
