import { NextRequest, NextResponse } from 'next/server'
import { requireUser, unauthorized } from '@/lib/apiAuth'

// ---------------------------------------------------------------------------
// POST /api/billing/convert-trial
// Converts a trial agency to a paid plan. Collects payment method + plan,
// records the subscription history entry, sets paid_plan_active = true and
// clears trial fields, and clears grace/lock so all data is retained/unlocked.
// The actual Stripe Checkout session is wired in billing.ts; this route is the
// source of truth for the agency's plan state.
// ---------------------------------------------------------------------------

export const runtime = 'nodejs'

interface Body {
  agencyId: string
  planType: 'starter' | 'professional' | 'enterprise'
  paymentMethod?: string
  amount?: number
  billingCycle?: 'monthly' | 'annual'
}

const PLANS: Record<string, { monthly: number; annual: number }> = {
  starter: { monthly: 9, annual: 86 },
  professional: { monthly: 49, annual: 470 },
  enterprise: { monthly: 149, annual: 1430 },
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth) return unauthorized()
  const db = auth.supabase

  let body: Body = { agencyId: '', planType: 'starter' }
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid body' }, { status: 400 })
  }

  const { agencyId, planType, billingCycle = 'monthly' } = body
  const plan = PLANS[planType]
  if (!agencyId || !plan) {
    return NextResponse.json({ ok: false, error: 'missing agencyId or invalid plan' }, { status: 400 })
  }

  const { data: agency } = await db.from('agencies').select('*').eq('id', agencyId).maybeSingle()
  if (!agency) return NextResponse.json({ ok: false, error: 'agency not found' }, { status: 404 })

  const amount = body.amount ?? (billingCycle === 'annual' ? plan.annual : plan.monthly)

  // 1) Mark paid + clear trial/grace/lock/archive state (retain all data).
  await db.from('agencies').update({
    paid_plan_active: true,
    trial_active: false,
    plan_type: planType,
    trial_start_date: agency.trial_start_date || null,
    trial_end_date: agency.trial_end_date || null,
    grace_end_date: null,
    locked_at: null,
    archive_at: null,
  }).eq('id', agencyId)

  // 2) Record subscription history.
  await db.from('subscription_history').insert({
    agency_id: agencyId,
    plan_type: planType,
    start_date: new Date().toISOString(),
    end_date: billingCycle === 'annual'
      ? new Date(Date.now() + 365 * 86400000).toISOString()
      : new Date(Date.now() + 30 * 86400000).toISOString(),
    amount,
    status: 'active',
    notes: `Converted from trial via ${billingCycle} billing${body.paymentMethod ? ` · ${body.paymentMethod}` : ''}`,
  })

  // 3) Open a fresh usage period.
  const now = new Date()
  const end = new Date(Date.now() + 30 * 86400000).toISOString()
  await db.from('agency_usage').insert({
    agency_id: agencyId,
    listings_used: 0,
    leads_used: 0,
    deals_used: 0,
    storage_used: 0,
    period_start: now.toISOString(),
    period_end: end,
  })

  return NextResponse.json({ ok: true, agencyId, planType, amount, billingCycle, status: 'paid' })
}
