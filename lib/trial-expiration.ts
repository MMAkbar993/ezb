import { createServerClient } from '@/lib/supabase/server'

// =============================================================================
// Trial expiration handler (server-side).
// The daily cron route (/api/cron/check-trials) calls these to:
//   1. Detect trials ending in 7 / 3 / 1 day(s) → send reminder emails.
//   2. At trial end → open a grace period (read-only); send "trial ended".
//   3. After grace → hard-lock the agency.
//   4. After grace + archive window → mark agency archived (data preserved).
// Used by the server cron and the convert-trial route. Never import from the
// browser bundle (service role).
// =============================================================================

export const runtime = 'nodejs'

const DAY_MS = 86_400_000

interface AgencyTrialRow {
  id: string
  name: string
  trial_start_date?: string | null
  trial_end_date?: string | null
  trial_active?: boolean
  paid_plan_active?: boolean
  grace_end_date?: string | null
  locked_at?: string | null
  archive_at?: string | null
}

async function getSettings() {
  const db = createServerClient()
  if (!db) return { trialDays: 14, graceDays: 7, archiveDays: 30, sendReminders: true }
  const { data } = await db
    .from('trial_settings')
    .select('*')
    .eq('agency_id', null)
    .limit(1)
    .maybeSingle()
  return {
    trialDays: data?.trial_days ?? 14,
    graceDays: data?.grace_days ?? 7,
    archiveDays: data?.archive_days ?? 30,
    sendReminders: data?.send_reminders ?? true,
  }
}

/**
 * Find all agencies whose trial is active and ending within the next `days`
 * window (inclusive). Used by reminder logic.
 */
async function findTrialsEndingWithinDays(days: number) {
  const db = createServerClient()
  if (!db) return []
  const now = new Date().toISOString()
  const endWindow = new Date(Date.now() + days * DAY_MS).toISOString()
  const { data } = await db
    .from('agencies')
    .select('*')
    .eq('trial_active', true)
    .eq('paid_plan_active', false)
    .not('trial_end_date', 'is', null)
    .lte('trial_end_date', endWindow)
    .gte('trial_end_date', now)
  return (data as AgencyTrialRow[]) || []
}

async function sendTrialEmail(
  agencyName: string,
  emailTo: string | null | undefined,
  subject: string,
  body: string,
) {
  if (!emailTo) return
  // Light-weight email send via the existing email service (imported lazily to
  // avoid pulling the mail client into this module's critical path).
  try {
    const { notify } = await import('@/lib/email')
    await notify('generic', emailTo, { title: subject, message: body })
  } catch {
    // non-fatal — cron should not crash because an email failed
  }
}

/** Where the agency's admin email lives. */
async function agencyAdminEmail(agencyId: string): Promise<string | null> {
  const db = createServerClient()
  if (!db) return null
  const { data } = await db
    .from('agency_members')
    .select('profile_id')
    .eq('agency_id', agencyId)
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()
  if (!data?.profile_id) return null
  const { data: prof } = await db
    .from('profiles')
    .select('email')
    .eq('id', data.profile_id)
    .maybeSingle()
  return prof?.email || null
}

/**
 * Main daily sweep. Returns a summary object with counts of what happened:
 * { remindersSent, graceOpened, locked, archived, totals }
 */
export async function runTrialSweep(): Promise<Record<string, number | unknown>> {
  const db = createServerClient()
  if (!db) return { error: 'not configured' }
  const settings = await getSettings()
  const now = Date.now()
  const results = { remindersSent: 0, graceOpened: 0, locked: 0, archived: 0, ext: <unknown[]>[] }

  // 1) Reminders at 7, 3, 1 days before end.
  if (settings.sendReminders) {
    for (const d of [7, 3, 1]) {
      for (const ag of await findTrialsEndingWithinDays(d)) {
        const daysLeft = ag.trial_end_date ? Math.ceil((new Date(ag.trial_end_date).getTime() - now) / DAY_MS) : -1
        const email = await agencyAdminEmail(ag.id)
        let msg: string
        if (daysLeft <= 1) msg = 'Your trial ends tomorrow! Upgrade now to keep your listings, leads, and deals.'
        else if (daysLeft <= 3) msg = `Your trial ends in ${daysLeft} days. Upgrade to continue creating without limits.`
        else msg = `Your trial ends in ${daysLeft} days. Plan ahead — upgrade or we'll switch you to a read-only grace period.`
        await sendTrialEmail(ag.name, email, `Your CONCORD trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`, msg)
        results.remindersSent++
      }
    }
  }

  // 2) Trials that have ENDED (now >= trial_end_date), still trial_active, not paid.
  const { data: ended } = await db
    .from('agencies')
    .select('*')
    .eq('trial_active', true)
    .eq('paid_plan_active', false)
    .not('trial_end_date', 'is', null)
    .lte('trial_end_date', new Date().toISOString())
  for (const ag of (ended as AgencyTrialRow[]) || []) {
    // Open grace period (read-only) if not already set.
    if (!ag.grace_end_date) {
      const graceEnd = new Date(now + settings.graceDays * DAY_MS).toISOString()
      await db.from('agencies').update({ grace_end_date: graceEnd, trial_active: false }).eq('id', ag.id)
      results.graceOpened++
      const email = await agencyAdminEmail(ag.id)
      await sendTrialEmail(
        ag.name, email,
        'Your CONCORD trial has ended',
        'Your trial has ended. You are now in a read-only grace period — your data is preserved. Upgrade to keep creating.',
      )
    }
  }

  // 3) Hard-lock agencies whose grace period has passed.
  const { data: inGrace } = await db
    .from('agencies')
    .select('*')
    .eq('paid_plan_active', false)
    .not('grace_end_date', 'is', null)
    .lte('grace_end_date', new Date().toISOString())
  for (const ag of (inGrace as AgencyTrialRow[]) || []) {
    if (!ag.locked_at) {
      await db.from('agencies').update({ locked_at: new Date(now).toISOString() }).eq('id', ag.id)
      results.locked++
    }
  }

  // 4) Archive (flag) after locked + archive window.
  const { data: lockedAgs } = await db
    .from('agencies')
    .select('*')
    .eq('paid_plan_active', false)
    .not('locked_at', 'is', null)
  for (const ag of (lockedAgs as AgencyTrialRow[]) || []) {
    const locked = ag.locked_at ? new Date(ag.locked_at).getTime() : now
    if (!ag.archive_at && now - locked > settings.archiveDays * DAY_MS) {
      await db.from('agencies').update({ archive_at: new Date(now).toISOString() }).eq('id', ag.id)
      results.archived++
    }
  }

  results.ext = await runTrialSweepInternal()
  return { ...results }
}

/** Export counters for analytics (separate pure read). */
export async function runTrialSweepInternal() {
  const db = createServerClient()
  if (!db) return []
  const { data } = await db
    .from('agencies')
    .select('id, name, trial_active, paid_plan_active, plan_type, trial_start_date, trial_end_date, grace_end_date, locked_at, archive_at')
    .order('created_at', { ascending: false })
    .limit(500)
  return data || []
}
