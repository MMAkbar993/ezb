import { NextRequest, NextResponse } from 'next/server'
import { requireUser, unauthorized } from '@/lib/apiAuth'

// ---------------------------------------------------------------------------
// POST /api/billing/bump-usage
// Increments an agency's usage counter (listings/leads/deals/storage) during a
// trial, enforcing the max limit. Callers (listing/lead/deal create flows)
// POST here AFTER the current usage is checked client-side via checkUsageLimits;
// this route is the authoritative gate so a blocked agency cannot exceed its
// limit even if the client is bypassed.
//
// Body: { agencyId, key: 'listings'|'leads'|'deals'|'storage', delta?, bytes? }
// Returns { ok, allowed, used, max, reason }.
// ---------------------------------------------------------------------------

export const runtime = 'nodejs'

const LIMIT_MAP: Record<string, { col: string; def: number; mbDef: number }> = {
  listings: { col: 'listings_used', def: 5, mbDef: 0 },
  leads: { col: 'leads_used', def: 20, mbDef: 0 },
  deals: { col: 'deals_used', def: 5, mbDef: 0 },
  storage: { col: 'storage_used', def: 100, mbDef: 100 },
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth) return unauthorized()
  const db = auth.supabase

  let body: { agencyId: string; key: string; delta?: number; bytes?: number }
    = { agencyId: '', key: 'listings' }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'invalid body' }, { status: 400 }) }

  const { agencyId, key } = body
  const cfg = LIMIT_MAP[key]
  if (!agencyId || !cfg) return NextResponse.json({ ok: false, error: 'invalid agencyId or key' }, { status: 400 })

  // fetch agency + settings to know paid vs trial + max
  const { data: agency } = await db.from('agencies').select('id, paid_plan_active, trial_active').eq('id', agencyId).maybeSingle()
  if (!agency) return NextResponse.json({ ok: false, error: 'agency not found' }, { status: 404 })

  // default settings
  const { data: settings } = await db.from('trial_settings').select('*').eq('agency_id', null).limit(1).maybeSingle()
  const max = agency.paid_plan_active
    ? null // unlimited on paid — always allowed
    : (parseInt(settings?.[cfg.col === 'storage_used' ? 'max_storage_mb' : 'max_' + cfg.col.replace('_used', '')] ?? cfg.def, 10) )

  // fetch latest usage row
  const { data: usage } = await db.from('agency_usage').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  const current = cfg.col === 'storage_used'
    ? (usage?.storage_used || 0)
    : (usage?.[cfg.col] || 0)

  // enforce max (converted to bytes for storage)
  const limitValue = key === 'storage' ? (max ?? cfg.def) * 1024 * 1024 : max ?? cfg.def
  const delta = key === 'storage' ? (body.bytes ?? 0) : (body.delta ?? 1)
  const nextValue = current + delta

  if (max !== null && nextValue > limitValue) {
    return NextResponse.json({ ok: false, allowed: false, used: current, max: limitValue, reason: `Trial limit reached (${cfg.col}). Upgrade for more.` })
  }

  const patch: Record<string, unknown> = {}
  patch[cfg.col] = nextValue
  if (usage) {
    await db.from('agency_usage').update(patch).eq('id', usage.id)
  } else {
    const now = new Date().toISOString()
    await db.from('agency_usage').insert({
      agency_id: agencyId, listings_used: 0, leads_used: 0, deals_used: 0, storage_used: 0,
      period_start: now, period_end: new Date(Date.now() + 30 * 86400000).toISOString(), ...patch,
    })
  }

  return NextResponse.json({ ok: true, allowed: true, used: nextValue, max: max ?? -1 })
}
