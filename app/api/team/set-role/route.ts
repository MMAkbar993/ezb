import { NextRequest, NextResponse } from 'next/server'
import { requireUser, unauthorized } from '@/lib/apiAuth'

// ---------------------------------------------------------------------------
// POST /api/team/set-role — admin-only: change another team member's
// profiles.role ('agent' | 'broker' | 'admin'). This has to be a service-role
// route rather than a plain client-side update: profiles RLS only allows
// `auth.uid() = id` (self-only) updates, and the self-escalation trigger
// (sql/phase3_security_hardening.sql) exists specifically to stop a
// non-admin from granting themselves a higher role. This route is the
// deliberate, narrow, server-checked bypass for a real admin promoting
// someone else — it does its own admin check before writing, and
// sql/role_access_control.sql updates the trigger to let service-role writes
// through (auth.uid() is NULL under the service-role client, so the trigger
// would otherwise silently revert the change even after this route's own
// check passed).
// ---------------------------------------------------------------------------

export const runtime = 'nodejs'

const VALID_ROLES = ['agent', 'broker', 'admin'] as const
type RoleValue = (typeof VALID_ROLES)[number]

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth) return unauthorized()
  const { user, supabase } = auth

  let body: { targetId?: string; role?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 })
  }

  const targetId = (body.targetId || '').trim()
  const role = (body.role || '').trim() as RoleValue
  if (!targetId || !VALID_ROLES.includes(role)) {
    return NextResponse.json({ ok: false, error: 'targetId and a valid role are required' }, { status: 400 })
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
    return NextResponse.json({ ok: false, error: 'Only an admin can change team member roles.' }, { status: 403 })
  }

  if (targetId === user.id && role !== 'admin') {
    return NextResponse.json({ ok: false, error: "You can't demote your own account." }, { status: 400 })
  }

  const { data: updated, error: updateErr } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', targetId)
    .select('id, email, full_name, role')
    .maybeSingle()
  if (updateErr) {
    return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 })
  }
  if (!updated) {
    return NextResponse.json({ ok: false, error: 'Team member not found.' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, profile: updated })
}
