import { NextResponse } from 'next/server'
import { runTrialSweep } from '@/lib/trial-expiration'

// ---------------------------------------------------------------------------
// POST /api/cron/check-trials
// Daily cron entry point. Protected by a shared CRON secret (Header
// `x-cron-secret` matching env CRON_SECRET). Calls the trial sweep which sends
// 7/3/1-day reminders, opens grace windows at trial end, locks after grace, and
// flags archived agencies. Idempotent — safe to run more than once a day.
// ---------------------------------------------------------------------------

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('x-cron-secret')
  if (secret && auth !== secret) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const summary = await runTrialSweep()
  return NextResponse.json({ ok: true, ...summary })
}
