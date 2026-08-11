'use client'

// =============================================================================
// Guided Listing Workflow — service
// -----------------------------------------------------------------------------
// Implements the 10-step listing workflow:
//   1  Legal docs (listing agreement)
//   2  Financial details
//   3  Recast financials
//   4  Generate BOV (auto after step 2)
//   5  Generate CIM (auto after step 3)
//   6  Generate BLI (auto after step 5)
//   7  SBA qualification (OPTIONAL)
//   8  List business (auto-publish + BizBuySell push)
//   9  Buyer management (NDA, financial proof, primary buyer)
//   10 Deal closing (LOI → under contract → sold)
//
// Listing status lifecycle: draft → active → under_loi → closed. Agent can
// withdraw (→ withdrawn) at any time. Confirmed against the live
// listings_status_check constraint 2026-08-11 — matches Rabin's brief §3
// exactly. (Previously assumed pending_sale/under_contract/sold, all three
// of which the live constraint rejects — the buyer-agreement flow below was
// silently failing to update listing status on every LOI/purchase-agreement/
// closing event.) Fine-grained deal progression (LOI → under contract → due
// diligence → closing → closed) is tracked separately on `deals.status` —
// see lib/pipeline.ts — which already uses correct, working values.
// =============================================================================

import { supabase } from '@/lib/supabase/client'
import { authedFetch } from '@/lib/apiFetch'

// ---------------------------------------------------------------------------
// Status constants
// ---------------------------------------------------------------------------
export const LISTING_STATUS_LIFECYCLE = ['draft', 'active', 'under_loi', 'closed']
export const WITHDRAWN = 'withdrawn'

export const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: '#7a7a8a', bg: '#f3f3f6' },
  active: { label: 'Active', color: '#16a34a', bg: '#e8f7ee' },
  under_loi: { label: 'Under LOI', color: '#b45309', bg: '#fdf3e3' },
  closed: { label: 'Closed', color: '#1a1a2e', bg: '#ece8f5' },
  withdrawn: { label: 'Withdrawn', color: '#dc2626', bg: '#fdeaea' },
}

// ---------------------------------------------------------------------------
// Workflow step definitions
// ---------------------------------------------------------------------------
export const WORKFLOW_STEPS = [
  { step: 1, key: 'legal_docs', label: 'Legal Docs', icon: '📄', desc: 'Listing agreement & disclosures' },
  { step: 2, key: 'financials', label: 'Financial Details', icon: '💰', desc: 'Revenue, SDE, EBITDA, balance' },
  { step: 3, key: 'recast', label: 'Recast Financials', icon: '🔄', desc: 'Normalize owner financials' },
  { step: 4, key: 'bov', label: 'Generate BOV', icon: '⚖️', desc: 'Broker opinion of value' },
  { step: 5, key: 'cim', label: 'Generate CIM', icon: '📑', desc: 'Confidential info memorandum' },
  { step: 6, key: 'bli', label: 'Generate BLI', icon: '📋', desc: 'Business listing info' },
  { step: 7, key: 'sba', label: 'SBA Qualification', icon: '🏦', desc: 'Optional SBA eligibility' },
  { step: 8, key: 'list', label: 'List Business', icon: '🌐', desc: 'Publish + push to marketplaces' },
  { step: 9, key: 'buyers', label: 'Buyer Management', icon: '👥', desc: 'NDA, qualifications, primary buyer' },
  { step: 10, key: 'closing', label: 'Deal Closing', icon: '🤝', desc: 'LOI, under contract, closing' },
] as const

// ---------------------------------------------------------------------------
// Workflow row CRUD
// ---------------------------------------------------------------------------
export interface ListingWorkflow {
  id: string
  listing_id: string
  agent_id: string | null
  current_step: number
  completed_steps: number[] | string[]
  started_at?: string | null
  completed_at?: string | null
}

export async function getWorkflow(listingId: string): Promise<ListingWorkflow | null> {
  try {
    const { data, error } = await supabase.from('listing_workflows').select('*').eq('listing_id', listingId).maybeSingle()
    if (error || !data) return null
    return data as unknown as ListingWorkflow
  } catch {
    return null
  }
}

export async function startWorkflow(listingId: string): Promise<ListingWorkflow | null> {
  try {
    const { data, error } = await supabase.from('listing_workflows').insert({ listing_id: listingId }).select().single()
    if (error) return null
    return data as unknown as ListingWorkflow
  } catch {
    return null
  }
}

/** Mark a step complete (as an array of step numbers). */
export async function completeStep(listingId: string, step: number): Promise<ListingWorkflow | null> {
  const wf = (await getWorkflow(listingId)) || (await startWorkflow(listingId))
  if (!wf) return null
  const done = Array.isArray(wf.completed_steps) ? (wf.completed_steps as number[]).map(Number) : []
  const existing = done.includes(step)
  const next = Math.min(10, wf.current_step + 1)
  const completed = existing ? done : [...done, step]
  const patch: any = { current_step: Math.max(wf.current_step, step + 1), completed_steps: completed, updated_at: new Date().toISOString() }
  if (next >= 10) patch.completed_at = new Date().toISOString()
  const { data, error } = await supabase.from('listing_workflows').update(patch).eq('listing_id', listingId).select().single()
  if (error) return wf
  return data as unknown as ListingWorkflow
}

// ---------------------------------------------------------------------------
// Status management + auto-transitions
// ---------------------------------------------------------------------------
export async function setListingStatus(listingId: string, status: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('listings').update({ status, updated_at: new Date().toISOString() }).eq('id', listingId)
    return !error
  } catch {
    return false
  }
}

/**
 * A buyer goes into agreement → status auto-updates.
 *  - LOI signed  → under_loi
 *  - Purchase agreement signed → under_loi (no finer-grained listing-level
 *    state exists live; deals.status tracks the detailed progression)
 *  - Closing complete → closed
 */
export async function updateStatusFromAgreement(
  listingId: string,
  agreementStatus: 'loi' | 'under_contract' | 'closing',
): Promise<boolean> {
  const map: Record<string, string> = {
    loi: 'under_loi',
    under_contract: 'under_loi',
    closing: 'closed',
  }
  const status = map[agreementStatus] || agreementStatus
  return setListingStatus(listingId, status)
}

// ---------------------------------------------------------------------------
// Step-specific data helpers
// ---------------------------------------------------------------------------

// --- Step 1: legal docs ---
//
// NOTE (2026-08-03): the live `listing_documents` table is an e-signature doc
// store with a restrictive `listing_documents_category_check` allow-list:
//   nda, purchase_agreement, marketing_agreement, other
// It has NO `file_name` column. The guided workflow needs `listing_agreement`
// and `financial_proof`, which the constraint REJECTS. Until the schema
// migration (sql/crm_test_fixes.sql) is applied, we map unsupported types onto
// allowed buckets (`listing_agreement`→`other`, `financial_proof`→`other`)
// and preserve the true type in `body_text` so Step 1 still works.
//
// Once the migration is applied, `listing_agreement`/`financial_proof` are
// permitted verbatim and this mapping becomes a harmless no-op.
const CATEGORY_FALLBACK: Record<string, string> = {
  listing_agreement: 'other',
  financial_proof: 'other',
}

export async function uploadListingDocument(listingId: string, doc: { document_type: string; file_name?: string; file_url: string; party_type?: string }) {
  const category = CATEGORY_FALLBACK[doc.document_type] || doc.document_type
  const row: any = {
    listing_id: listingId,
    category,
    party_type: doc.party_type || 'seller',
    file_url: doc.file_url,
    status: 'pending',
    // Preserve the true workflow type (lost by the fallback mapping) so the
    // UI can still distinguish a listing agreement from a generic upload.
    body_text: doc.document_type === category ? null : `doc_type=${doc.document_type}`,
  }
  // Try with file_name; fall back to without if the column is absent.
  let { data, error } = await supabase.from('listing_documents').insert({ ...row, file_name: doc.file_name ?? null }).select().single()
  if (error && /file_name/.test(error.message || '')) {
    delete row.file_name
    ;({ data, error } = await supabase.from('listing_documents').insert(row).select().single())
  }
  if (error) throw error
  return data
}
export async function fetchListingDocuments(listingId: string): Promise<any[]> {
  try {
    const { data } = await supabase.from('listing_documents').select('*').eq('listing_id', listingId).order('created_at', { ascending: false })
    // Normalise back to the legacy `document_type` key the UI reads; recover
    // the true type from `body_text` when it was stored by the fallback above;
    // derive a display name when there is no `file_name` column.
    return ((data || []) as any[]).map((d) => {
      const storedType = /^doc_type=(.+)$/.exec(d.body_text || '')?.[1]
      const document_type = storedType || d.category || d.document_type || 'document'
      const name = d.file_name || ((d.file_url || '').split('/').pop()) || document_type
      return { ...d, document_type, file_name: name }
    })
  } catch { return [] }
}

// --- Step 2: financials ---
export async function saveFinancials(listingId: string, fin: Partial<any>): Promise<boolean> {
  try {
    const exists = await supabase.from('listing_financials').select('id').eq('listing_id', listingId).maybeSingle()
    if (exists.data) {
      const { error } = await supabase.from('listing_financials').update({ ...fin, updated_at: new Date().toISOString() }).eq('listing_id', listingId)
      return !error
    }
    const { error } = await supabase.from('listing_financials').insert({ listing_id: listingId, ...fin })
    return !error
  } catch { return false }
}
export async function fetchFinancials(listingId: string): Promise<any | null> {
  try {
    const { data } = await supabase.from('listing_financials').select('*').eq('listing_id', listingId).maybeSingle()
    return data || null
  } catch { return null }
}

// --- Step 3: recast ---
export async function saveRecast(listingId: string, recast: Partial<any>): Promise<boolean> {
  try {
    const { error } = await supabase.from('listing_recasts').insert({ listing_id: listingId, ...recast, recasted_at: new Date().toISOString() })
    return !error
  } catch { return false }
}
export async function fetchRecast(listingId: string): Promise<any | null> {
  try {
    const { data } = await supabase.from('listing_recasts').select('*').eq('listing_id', listingId).order('recasted_at', { ascending: false }).maybeSingle()
    return data || null
  } catch { return null }
}

// --- Steps 4-6: BOV / CIM / BLI auto-generation ---
export async function generateBOV(listingId: string): Promise<any | null> {
  try {
    const listing = await fetchListingRaw(listingId)
    const multiple = 3.0
    const sde = listing?.sde || 0
    const valuation = Math.round((sde as number) * multiple)
    const { data, error } = await supabase.from('bov_versions').insert({
      listing_id: listingId, version_number: 1, valuation_multiple: multiple, valuation_amount: valuation,
      content: { valuation_multiple: multiple, valuation_amount: valuation, sde, business_name: listing?.business_name },
      status: 'draft', generated_at: new Date().toISOString(),
    }).select().single()
    if (error) return null
    return data
  } catch { return null }
}
export async function generateCIM(listingId: string): Promise<any | null> {
  try {
    const listing = await fetchListingRaw(listingId)
    const recast = await fetchRecast(listingId)
    const { data, error } = await supabase.from('cim_versions').insert({
      listing_id: listingId, version_number: 1,
      content: { business_name: listing?.business_name, recasted_sde: recast?.recasted_sde ?? listing?.sde, generated_from: 'recast' },
      status: 'draft', generated_at: new Date().toISOString(),
    }).select().single()
    if (error) return null
    return data
  } catch { return null }
}
export async function generateBLI(listingId: string): Promise<any | null> {
  try {
    const listing = await fetchListingRaw(listingId)
    const { data, error } = await supabase.from('bli_versions').insert({
      listing_id: listingId, version_number: 1,
      content: { business_name: listing?.business_name, asking_price: listing?.asking_price, industry: listing?.industry, location_general: listing?.location_general },
      status: 'draft', generated_at: new Date().toISOString(),
    }).select().single()
    if (error) return null
    return data
  } catch { return null }
}
async function fetchListingRaw(id: string): Promise<any | null> {
  try {
    const { data } = await supabase.from('listings').select('*').eq('id', id).single()
    return data || null
  } catch { return null }
}
export async function fetchVersions(listingId: string, table: 'bov_versions' | 'cim_versions' | 'bli_versions'): Promise<any[]> {
  try {
    const { data } = await supabase.from(table).select('*').eq('listing_id', listingId).order('version_number', { ascending: false })
    return (data || []) as any[]
  } catch { return [] }
}
export async function finalizeVersion(table: 'bov_versions' | 'cim_versions' | 'bli_versions', id: string, status: string): Promise<boolean> {
  try {
    const { error } = await supabase.from(table).update({ status }).eq('id', id)
    return !error
  } catch { return false }
}

// --- Step 7: SBA (optional) ---
export async function saveSBA(listingId: string, sba: Partial<any>): Promise<boolean> {
  try {
    const exists = await supabase.from('sba_qualifications').select('id').eq('listing_id', listingId).maybeSingle()
    if (exists.data) {
      const { error } = await supabase.from('sba_qualifications').update(sba).eq('listing_id', listingId)
      return !error
    }
    const { error } = await supabase.from('sba_qualifications').insert({ listing_id: listingId, ...sba, is_optional: true })
    return !error
  } catch { return false }
}
export async function fetchSBA(listingId: string): Promise<any | null> {
  try {
    const { data } = await supabase.from('sba_qualifications').select('*').eq('listing_id', listingId).maybeSingle()
    return data || null
  } catch { return null }
}

// --- Step 8: list business (auto-publish + BizBuySell stub) ---
export async function publishListing(listingId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('listings').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', listingId)
    await pushToMarketplaces(listingId).catch(() => {})
    return !error
  } catch { return false }
}
/** Push to external marketplaces (BizBuySell etc.). Graceful no-op if unconfigured. */
export async function pushToMarketplaces(listingId: string): Promise<boolean> {
  try {
    const res = await authedFetch('/api/sync/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listingId }) })
    return res.ok
  } catch { return false }
}

// --- Step 9: buyers ---
export async function addBuyer(listingId: string, buyer: Partial<any>): Promise<boolean> {
  try {
    const { error } = await supabase.from('buyer_lists').insert({ listing_id: listingId, ...buyer })
    return !error
  } catch { return false }
}
export async function fetchBuyers(listingId: string): Promise<any[]> {
  try {
    const { data } = await supabase.from('buyer_lists').select('*').eq('listing_id', listingId).order('created_at', { ascending: false })
    return (data || []) as any[]
  } catch { return [] }
}
export async function updateBuyer(id: string, patch: Partial<any>): Promise<boolean> {
  try {
    const { error } = await supabase.from('buyer_lists').update(patch).eq('id', id)
    return !error
  } catch { return false }
}

// --- Step 10: closing / agreements ---
export async function getAgreement(listingId: string): Promise<any | null> {
  try {
    const { data } = await supabase.from('deal_agreements').select('*').eq('listing_id', listingId).maybeSingle()
    return data || null
  } catch { return null }
}
/** Record LOI → auto-updates listing status to under_loi. */
export async function recordLOI(listingId: string, buyerId: string | null, fileUrl?: string): Promise<boolean> {
  try {
    const existing = await getAgreement(listingId)
    if (existing) {
      const { error } = await supabase.from('deal_agreements').update({ loi_signed_at: new Date().toISOString(), loi_file_url: fileUrl, status: 'loi' }).eq('id', existing.id)
      if (error) return false
    } else {
      const { error } = await supabase.from('deal_agreements').insert({ listing_id: listingId, buyer_id: buyerId, loi_signed_at: new Date().toISOString(), loi_file_url: fileUrl, status: 'loi' })
      if (error) return false
    }
    return updateStatusFromAgreement(listingId, 'loi')
  } catch { return false }
}
/** Record purchase agreement → auto-updates listing status to under_loi (the
 * deal_agreements row itself still tracks the finer 'under_contract' state). */
export async function recordPurchaseAgreement(listingId: string, buyerId: string | null, fileUrl?: string): Promise<boolean> {
  try {
    const existing = await getAgreement(listingId)
    if (existing) {
      const { error } = await supabase.from('deal_agreements').update({
        purchase_agreement_signed_at: new Date().toISOString(), purchase_agreement_file_url: fileUrl, status: 'under_contract',
      }).eq('id', existing.id)
      if (error) return false
    } else {
      const { error } = await supabase.from('deal_agreements').insert({
        listing_id: listingId, buyer_id: buyerId, purchase_agreement_signed_at: new Date().toISOString(), purchase_agreement_file_url: fileUrl, status: 'under_contract',
      })
      if (error) return false
    }
    return updateStatusFromAgreement(listingId, 'under_contract')
  } catch { return false }
}
/** Mark deal closed → auto-updates listing status to closed. */
export async function recordClosing(listingId: string, details: Partial<any>): Promise<boolean> {
  try {
    const agreement = await getAgreement(listingId)
    // deal_closing_details live columns: id, listing_id, closing_date,
    // final_purchase_price, created_at (confirmed 2026-08-11) — no closed_at
    // column; created_at already timestamps the row.
    const { error } = await supabase.from('deal_closing_details').insert({ listing_id: listingId, ...details })
    if (error) return false
    if (agreement) {
      await supabase.from('deal_agreements').update({ status: 'closing' }).eq('id', agreement.id)
    }
    return updateStatusFromAgreement(listingId, 'closing')
  } catch { return false }
}
export async function fetchClosingDetails(listingId: string): Promise<any | null> {
  try {
    const { data } = await supabase.from('deal_closing_details').select('*').eq('listing_id', listingId).maybeSingle()
    return data || null
  } catch { return null }
}
