import { supabase } from '@/lib/supabase/client'
import { createDeal } from '@/lib/pipeline'

// ---------------------------------------------------------------------------
// Unified Lead Management — buyer + seller leads.
// Real schema (probed live):
//   seller_leads: id, business_name, email, phone, status, created_at
//   buyer_leads:  id, email, phone, status, created_at
//   lead_activities: (create via sql files) id, lead_id, type, description, created_at
// ---------------------------------------------------------------------------

export type LeadStatus = 'new' | 'qualifying' | 'qualified' | 'handed_off' | 'not_a_fit'

export const LEAD_STATUSES: { id: LeadStatus; label: string; color: string }[] = [
  { id: 'new', label: 'New', color: '#3b82f6' },
  { id: 'qualifying', label: 'Qualifying', color: '#f59e0b' },
  { id: 'qualified', label: 'Qualified', color: '#8b5cf6' },
  { id: 'handed_off', label: 'Handed Off', color: '#22c55e' },
  { id: 'not_a_fit', label: 'Not a Fit', color: '#ef4444' },
]

// NOTE (2026-08-03): the live `seller_leads_status_check` constraint ONLY
// allows: new | contacted | closed. The unified funnel above (qualifying /
// qualified / handed_off / not_a_fit) is fully supported on buyer_leads but
// NOT on seller_leads. Until the schema migration is applied, we translate
// seller-lead writes onto the allowed set so lead management never hits a
// constraint error. (buyer_leads already matches the unified list verbatim.)
const SELLER_STATUS_MAP: Record<string, string> = {
  new: 'new',
  qualifying: 'contacted',
  qualified: 'contacted',
  handed_off: 'closed',
  not_a_fit: 'closed',
}
export const normalizeSellerStatus = (s?: string | null): string => SELLER_STATUS_MAP[s || 'new'] || s || 'new'

export const statusMeta = (s?: string | null) =>
  LEAD_STATUSES.find((x) => x.id === s) || { id: s || 'new', label: s || 'New', color: '#94a3b8' }

export type LeadKind = 'buyer' | 'seller'

export interface UnifiedLead {
  kind: LeadKind
  id: string
  business_name: string | null
  email: string | null
  phone: string | null
  status: string
  created_at?: string | null
  // Buyer-lead enrichment (financials + desired business type)
  desired_business_type?: string | null
  budget_range?: string | null
  funds_available?: number | null
  financing_method?: string | null
  preferred_location?: string | null
  notes?: string | null
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------
export async function fetchAllLeads(): Promise<UnifiedLead[]> {
  const results = await Promise.allSettled([
    supabase.from('seller_leads').select('*').order('created_at', { ascending: false }),
    supabase.from('buyer_leads').select('*').order('created_at', { ascending: false }),
  ])

  const rows: UnifiedLead[] = []

  const seller = results[0]
  if (seller.status === 'fulfilled' && seller.value.data) {
    for (const r of seller.value.data) {
      rows.push({
        kind: 'seller', id: r.id, business_name: r.business_name, email: r.email,
        phone: r.phone, status: r.status || 'new', created_at: r.created_at,
      })
    }
  }

  const buyer = results[1]
  if (buyer.status === 'fulfilled' && buyer.value.data) {
    for (const r of buyer.value.data) {
      rows.push({
        kind: 'buyer', id: r.id, business_name: null, email: r.email,
        phone: r.phone, status: r.status || 'new', created_at: r.created_at,
      })
    }
  }

  // Sort: newest first
  rows.sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0
    return tb - ta
  })

  return rows
}

// Curated list of common business types for buyer leads.
export const BUSINESS_TYPES = [
  'Retail', 'Restaurant / Food Service', 'Home Health', 'Medical / Dental',
  'Manufacturing', 'Professional Services', 'Construction', 'Automotive',
  'Real Estate / Property', 'Technology / IT', 'Cleaning / Janitorial',
  'Distribution / Wholesale', 'Fitness / Wellness', 'Beauty / Salon',
  'Transportation / Logistics', 'E-commerce', 'Other',
]

export async function fetchBuyerLeads(): Promise<UnifiedLead[]> {
  const { data, error } = await supabase
    .from('buyer_leads')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('fetchBuyerLeads error:', error)
    return []
  }
  return (data || []).map((r) => ({
    kind: 'buyer' as LeadKind, id: r.id, business_name: null,
    email: r.email, phone: r.phone, status: r.status || 'new', created_at: r.created_at,
    desired_business_type: r.desired_business_type || null,
    budget_range: r.budget_range || null,
    funds_available: r.funds_available ?? null,
    financing_method: r.financing_method || null,
    preferred_location: r.preferred_location || null,
    notes: r.notes || null,
  }))
}

// --- Match buyer leads to a listing by business type ------------------
// Returns buyer leads whose desired business type overlaps the listing's
// industry (fuzzy: both directions contain, plus keyword token overlap).
// Normalizes common short forms (e.g. "restaurant" vs "food service").
const TYPE_SYNONYMS: Record<string, string[]> = {
  restaurant: ['restaurant', 'food', 'food service', 'cafe', 'bar', 'diner', 'catering'],
  'home health': ['home health', 'homecare', 'home care', 'healthcare', 'nursing'],
  medical: ['medical', 'dental', 'clinic', 'doctor', 'healthcare'],
  retail: ['retail', 'store', 'shop', 'boutique', 'convenience'],
  manufacturing: ['manufacturing', 'factory', 'production', 'plant'],
}
function typeTokens(t?: string | null): string[] {
  const raw = (t || '').toLowerCase()
  const out = new Set<string>()
  for (const [key, syns] of Object.entries(TYPE_SYNONYMS)) {
    if (syns.some((s) => raw.includes(s)) || raw.includes(key)) {
      syns.forEach((s) => out.add(s))
      out.add(key)
    }
  }
  raw.split(/[^a-z0-9]+/).filter(Boolean).forEach((w) => out.add(w))
  return [...out]
}
function typesOverlap(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false
  const ta = typeTokens(a)
  const tb = typeTokens(b)
  return ta.some((x) => tb.includes(x))
}

export async function matchBuyerLeads(listingIndustry?: string | null): Promise<UnifiedLead[]> {
  const leads = await fetchBuyerLeads()
  if (!listingIndustry) return []
  return leads.filter((l) => typesOverlap(l.desired_business_type, listingIndustry))
}

export async function createBuyerLead(input: {
  email?: string; phone?: string; status?: LeadStatus
  desired_business_type?: string; budget_range?: string; funds_available?: number
  financing_method?: string; preferred_location?: string; notes?: string
}): Promise<UnifiedLead> {
  const payload: Record<string, unknown> = {
    email: input.email || null,
    phone: input.phone || null,
    status: input.status || 'new',
    desired_business_type: input.desired_business_type || null,
    budget_range: input.budget_range || null,
    funds_available: input.funds_available ?? null,
    financing_method: input.financing_method || null,
    preferred_location: input.preferred_location || null,
    notes: input.notes || null,
  }
  const { data, error } = await supabase.from('buyer_leads').insert(payload).select().single()
  if (error) {
    console.error('createBuyerLead error:', error)
    throw new Error(error.message || 'Failed to create buyer lead')
  }
  return {
    kind: 'buyer', id: data.id, business_name: null,
    email: data.email, phone: data.phone, status: data.status || 'new', created_at: data.created_at,
    desired_business_type: data.desired_business_type, budget_range: data.budget_range,
    funds_available: data.funds_available, financing_method: data.financing_method,
    preferred_location: data.preferred_location, notes: data.notes,
  }
}

export async function updateBuyerLead(id: string, input: Partial<Parameters<typeof createBuyerLead>[0]>): Promise<UnifiedLead> {
  const payload: Record<string, unknown> = {}
  if (input.email !== undefined) payload.email = input.email || null
  if (input.phone !== undefined) payload.phone = input.phone || null
  if (input.status !== undefined) payload.status = input.status
  if (input.desired_business_type !== undefined) payload.desired_business_type = input.desired_business_type || null
  if (input.budget_range !== undefined) payload.budget_range = input.budget_range || null
  if (input.funds_available !== undefined) payload.funds_available = input.funds_available ?? null
  if (input.financing_method !== undefined) payload.financing_method = input.financing_method || null
  if (input.preferred_location !== undefined) payload.preferred_location = input.preferred_location || null
  if (input.notes !== undefined) payload.notes = input.notes || null
  const { data, error } = await supabase.from('buyer_leads').update(payload).eq('id', id).select().single()
  if (error) {
    console.error('updateBuyerLead error:', error)
    throw new Error(error.message || 'Failed to update buyer lead')
  }
  return {
    kind: 'buyer', id: data.id, business_name: null,
    email: data.email, phone: data.phone, status: data.status || 'new', created_at: data.created_at,
    desired_business_type: data.desired_business_type, budget_range: data.budget_range,
    funds_available: data.funds_available, financing_method: data.financing_method,
    preferred_location: data.preferred_location, notes: data.notes,
  }
}
export async function createLead(kind: LeadKind, input: {
  business_name?: string; email?: string; phone?: string; status?: LeadStatus
}): Promise<UnifiedLead> {
  const table = kind === 'seller' ? 'seller_leads' : 'buyer_leads'
  const payload: Record<string, unknown> = {
    email: input.email || null,
    phone: input.phone || null,
    status: input.status || 'new',
  }
  if (kind === 'seller') payload.business_name = input.business_name || ''
  if (kind === 'seller') payload.status = normalizeSellerStatus(input.status || 'new')

  const { data, error } = await supabase.from(table).insert(payload).select().single()
  if (error) {
    console.error('createLead error:', error)
    throw new Error(error.message || 'Failed to create lead')
  }
  return {
    kind, id: data.id, business_name: data.business_name || null,
    email: data.email, phone: data.phone, status: data.status || 'new', created_at: data.created_at,
  }
}

export async function updateLead(kind: LeadKind, id: string, input: {
  business_name?: string; email?: string; phone?: string; status?: LeadStatus
}): Promise<UnifiedLead> {
  const table = kind === 'seller' ? 'seller_leads' : 'buyer_leads'
  const payload: Record<string, unknown> = { status: kind === 'seller' ? normalizeSellerStatus(input.status) : input.status }
  if (kind === 'seller' && input.business_name !== undefined) payload.business_name = input.business_name
  if (input.email !== undefined) payload.email = input.email || null
  if (input.phone !== undefined) payload.phone = input.phone || null

  const { data, error } = await supabase.from(table).update(payload).eq('id', id).select().single()
  if (error) {
    console.error('updateLead error:', error)
    throw new Error(error.message || 'Failed to update lead')
  }
  return {
    kind, id: data.id, business_name: data.business_name || null,
    email: data.email, phone: data.phone, status: data.status || 'new', created_at: data.created_at,
  }
}

export async function deleteLead(kind: LeadKind, id: string): Promise<void> {
  const table = kind === 'seller' ? 'seller_leads' : 'buyer_leads'
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) {
    console.error('deleteLead error:', error)
    throw new Error(error.message || 'Failed to delete lead')
  }
}

// ---------------------------------------------------------------------------
// Convert a lead into a deal in the pipeline.
// - Seller lead -> creates a deal (status 'letter_of_intent'); optionally ties
//   to a listing. Because `deals.listing_id` is NOT NULL, if no listing is
//   supplied we auto-create a draft listing from the lead's business info.
// - Buyer lead -> also creates a deal; we attach the buyer's email as the
//   deal's only identifier since deals table has no buyer fields.
// ---------------------------------------------------------------------------
export async function convertLeadToDeal(
  lead: UnifiedLead,
  listingId?: string
): Promise<{ dealId: string }> {
  const dealNameBase = lead.business_name || lead.email || 'Lead'

  // Resolve a listing (deals.listing_id is NOT NULL). Auto-create a draft
  // listing from the lead when one isn't passed in.
  let resolvedListingId = listingId
  if (!resolvedListingId) {
    const listingInsert: any = {
      agent_id: (await supabase.auth.getUser()).data?.user?.id || null,
      business_name: lead.business_name || `${dealNameBase} — Listing`,
      headline: `Confidential — ${lead.business_name || dealNameBase}`,
      industry: (lead as any).industry || (lead as any).desired_business_type || null,
      status: 'draft',
    }
    const loc = (lead as any).location_general || (lead as any).preferred_location
    if (loc) listingInsert.location_general = loc
    const rev = (lead as any).revenue_range
    if (rev) listingInsert.description = `Lead conversion from ${dealNameBase}. Revenue range: ${rev}.`
    const { data: newListing, error: lErr } = await supabase.from('listings').insert(listingInsert).select().single()
    if (lErr) throw new Error('Could not create a listing for this lead: ' + lErr.message)
    resolvedListingId = newListing.id
  }

  const deal = await createDeal({
    listing_id: resolvedListingId,
    status: 'letter_of_intent',
    purchase_price: null,
  })
  const dealId = deal.id

  // Log activity on the lead (fail-soft if lead_activities missing)
  try {
    await supabase.from('lead_activities').insert({
      lead_id: lead.id,
      type: 'conversion',
      description: `Converted ${lead.kind} lead "${dealNameBase}" into deal ${dealId.slice(0, 8)}.`,
    })
  } catch {
    // ignore — activity table may not exist
  }

  // Mark the lead handed off
  try {
    const table = lead.kind === 'seller' ? 'seller_leads' : 'buyer_leads'
    // Buyer leads accept 'handed_off' verbatim; seller leads map it to 'closed'
    // (their status constraint only allows new | contacted | closed).
    const nextStatus = lead.kind === 'seller' ? 'closed' : 'handed_off'
    await supabase.from(table).update({ status: nextStatus }).eq('id', lead.id)
  } catch {
    // ignore
  }

  return { dealId }
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------
export interface LeadActivity {
  id: string
  lead_id: string
  type: string
  description: string
  created_at?: string | null
}

export async function fetchLeadActivities(leadId: string): Promise<LeadActivity[]> {
  const { data, error } = await supabase
    .from('lead_activities')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
  if (error) return []
  return (data as LeadActivity[]) || []
}

export async function addLeadActivity(leadId: string, type: string, description: string): Promise<LeadActivity | null> {
  const { data, error } = await supabase
    .from('lead_activities')
    .insert({ lead_id: leadId, type, description })
    .select()
    .single()
  if (error) {
    console.warn('addLeadActivity error:', error.message)
    return null
  }
  return data as LeadActivity
}

// ---------------------------------------------------------------------------
// Counts for dashboard
// ---------------------------------------------------------------------------
export async function fetchLeadStats(): Promise<{ total: number; newLeads: number; buyers: number; sellers: number }> {
  const all = await fetchAllLeads()
  return {
    total: all.length,
    newLeads: all.filter((l) => l.status === 'new').length,
    buyers: all.filter((l) => l.kind === 'buyer').length,
    sellers: all.filter((l) => l.kind === 'seller').length,
  }
}

export const initials = (name: string | null | undefined): string => {
  if (!name) return '?'
  return name.trim().split(/\s+/).map((n) => n[0] || '').join('').toUpperCase().slice(0, 2)
}
