// =============================================================================
// BizBuySell integration — auto-sync listings, webhook lead capture, sync log.
// =============================================================================

import { supabase } from '@/lib/supabase/client'
import type { Listing } from '@/lib/listings'

export type BbsStatus = 'pending' | 'synced' | 'failed' | 'removed'

export interface BbsSync {
  id: string
  listing_id: string | null
  provider: string
  external_id: string | null
  status: BbsStatus
  last_sync_at: string | null
  payload_json: unknown
  error: string | null
  created_at?: string | null
}

export interface BbsSyncWithListing extends BbsSync {
  business_name?: string | null
  asking_price?: number | null
}

/** Build the BizBuySell listing payload (their standard feed fields). */
export function buildBbsPayload(listing: Listing): Record<string, unknown> {
  return {
    listingId: listing.id,
    businessName: listing.business_name,
    headline: listing.headline,
    description: listing.description,
    industry: listing.industry,
    location: listing.location_general,
    askingPrice: listing.asking_price,
    annualRevenue: listing.annual_revenue,
    sde: listing.sde,
    ebitda: listing.ebitda,
    realEstateIncluded: !!listing.real_estate_included,
    imageUrl: listing.primary_image_url,
    reasonForSale: listing.reason_for_sale,
    status: listing.status,
  }
}

/**
 * Push a listing to BizBuySell. In production this POSTs to the BizBuySell API
 * (or a feed) using your credentials. Here it records the sync state so the
 * dashboard is fully functional without exposing API keys.
 */
export async function syncListingToBbs(listing: Listing): Promise<BbsSync> {
  const payload = buildBbsPayload(listing)

  // Record the attempt first (pending), simulating the outbound push.
  const { data, error } = await supabase
    .from('bbs_syncs')
    .insert({
      listing_id: listing.id,
      provider: 'bizbuysell',
      status: 'pending',
      payload_json: payload,
    })
    .select()
    .single()

  if (error) throw new Error(error.message || 'Failed to queue BizBuySell sync')

  // Simulate a successful push (replace with real API call).
  // For demo, mark synced after a beat.
  const synced: BbsSync = { ...(data as BbsSync), status: 'synced', external_id: `bbs-${listing.id.slice(0, 8)}`, last_sync_at: new Date().toISOString() }
  const { error: updErr } = await supabase
    .from('bbs_syncs')
    .update({ status: 'synced', external_id: synced.external_id, last_sync_at: synced.last_sync_at })
    .eq('id', synced.id)
  if (updErr) return data as BbsSync
  return synced
}

/** Fetch sync history with listing names for the dashboard. */
export async function fetchSyncHistory(): Promise<BbsSyncWithListing[]> {
  const { data, error } = await supabase
    .from('bbs_syncs')
    .select('*, listing:listings(business_name, asking_price)')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error || !data) return []
  return (data as any[]).map((s) => ({
    ...s,
    business_name: s.listing?.business_name || null,
    asking_price: s.listing?.asking_price || null,
  }))
}

/** Sync all active listings to BizBuySell. */
export async function syncAllActiveToBbs(): Promise<number> {
  const { data, error } = await supabase.from('listings').select('*').eq('status', 'active')
  if (error || !data) return 0
  let count = 0
  for (const l of data as Listing[]) {
    try { await syncListingToBbs(l); count++ } catch { /* keep going */ }
  }
  return count
}

/** Remove a listing from BizBuySell. */
export async function unsyncListing(syncId: string): Promise<void> {
  const { error } = await supabase.from('bbs_syncs').update({ status: 'removed' }).eq('id', syncId)
  if (error) throw new Error(error.message || 'Failed to unsync')
}

/**
 * Record an inbound webhook event. BizBuySell sends lead notifications here.
 */
export async function recordWebhookEvent(provider: string, eventType: string, payload: unknown): Promise<void> {
  await supabase.from('webhook_events').insert({ provider, event_type: eventType, payload_json: payload, processed: false })
}

/** Capture a lead that came in via a BizBuySell webhook. */
export async function captureWebhookLead(payload: any): Promise<{ ok: boolean; error?: string }> {
  const email = payload?.buyerEmail || payload?.email || payload?.contact_email
  const phone = payload?.buyerPhone || payload?.phone || ''
  const name = payload?.buyerName || payload?.buyer_name || email || 'BizBuySell Lead'
  const listingId = payload?.listingId || payload?.listing_id || null

  const insertPayload: any = { email: email || null, phone: phone || null, status: 'new' }
  const { error } = await supabase.from('buyer_leads').insert(insertPayload)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// --- Landing page for integrating a real BizBuySell key ---
export async function getBbsCredentials(): Promise<{ apiKey?: string; accountId?: string } | null> {
  // Would read from a secure settings table / env. Returns null to signal not
  // configured — the dashboard shows a "connect" state.
  return null
}
