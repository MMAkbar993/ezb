import { NextRequest, NextResponse } from 'next/server'
import { requireUser, unauthorized } from '@/lib/apiAuth'
import { createServerClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// POST /api/billing/create-agency
// Creates a new agency on signup, with either:
//   - trial: trial_start_date = now(), trial_end_date = now() + trial_days,
//     trial_active = true, grace_end_date = end + grace_days
//   - paid:  paid_plan_active = true, plan_type = tier, records subscription
// Creates the agency, links the caller as admin owner, seeds a fresh usage
// period, then hands the agency id back to redirect to billing for payment.
// Uses the service-role client (server-only).
// ---------------------------------------------------------------------------

export const runtime = 'nodejs'

interface Body {
  name: string
  tier?: 'starter' | 'professional' | 'enterprise'
  startTrial?: boolean
  profileId?: string
}

async function getGlobalSettings(db: Awaited<ReturnType<typeof createServerClient>>) {
  try {
    const { data } = await db!.from('trial_settings').select('*').eq('agency_id', null).limit(1).maybeSingle()
    return {
      trialDays: data?.trial_days ?? 14,
      graceDays: data?.grace_days ?? 7,
      maxListings: data?.max_listings ?? 5,
      maxLeads: data?.max_leads ?? 20,
      maxDeals: data?.max_deals ?? 5,
      maxStorageMb: data?.max_storage_mb ?? 100,
    }
  } catch {
    return { trialDays: 14, graceDays: 7, maxListings: 5, maxLeads: 20, maxDeals: 5, maxStorageMb: 100 }
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth) return unauthorized()
  const db = auth.supabase

  let body: Body = { name: '' }
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid body' }, { status: 400 })
  }

  const name = (body.name || '').trim()
  if (!name) return NextResponse.json({ ok: false, error: 'Agency name is required' }, { status: 400 })

  const tier = body.tier || 'professional'
  const startTrial = body.startTrial !== false
  const settings = await getGlobalSettings(db)

  const now = Date.now()
  const trialStart = new Date(now).toISOString()
  const trialEnd = new Date(now + settings.trialDays * 86400000).toISOString()
  const graceEnd = new Date(now + (settings.trialDays + settings.graceDays) * 86400000).toISOString()

  const slug = (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')) + '-' + Math.random().toString(36).slice(2, 6)

  // 1) Create agency
  const { data: agency, error: aErr } = await db.from('agencies').insert({
    name,
    slug,
    is_active: true,
    brand_color: '#1a1a2e',
    accent_color: '#c9a84c',
    plan_type: startTrial ? 'free' : tier,
    trial_start_date: startTrial ? trialStart : null,
    trial_end_date: startTrial ? trialEnd : null,
    grace_end_date: startTrial ? graceEnd : null,
    trial_active: startTrial,
    paid_plan_active: !startTrial,
  }).select().single()

  if (aErr || !agency) {
    return NextResponse.json({ ok: false, error: aErr?.message || 'Failed to create agency' }, { status: 500 })
  }
  const agencyId = agency.id

  // 2) Link the verified caller as admin owner (not the client-supplied
  //    profileId — the caller is already required to be signed in).
  await db.from('agency_members').insert({
    agency_id: agencyId,
    profile_id: auth.user.id,
    role: 'admin',
    is_owner: true,
  })

  // 3) Seed a fresh usage period.
  const periodEnd = new Date(now + 30 * 86400000).toISOString()
  await db.from('agency_usage').insert({
    agency_id: agencyId,
    listings_used: 0, leads_used: 0, deals_used: 0, storage_used: 0,
    period_start: trialStart,
    period_end: periodEnd,
  })

  // 4) Record subscription_history entry.
  await db.from('subscription_history').insert({
    agency_id: agencyId,
    plan_type: startTrial ? 'trial' : tier,
    start_date: trialStart,
    end_date: startTrial ? trialEnd : null,
    amount: 0,
    status: startTrial ? 'active' : 'active',
    notes: startTrial ? `Free trial (${settings.trialDays} days)` : `Subscribed to ${tier}`,
  })

  return NextResponse.json({ ok: true, agencyId, startTrial, trialEnd })
}
