'use client'

// =============================================================================
// Search & Filter service
// -----------------------------------------------------------------------------
// Cross-entity search across listings, deals, leads, and documents, with
// status/date/price/industry filters and per-user saved searches.
//
// Uses supabase `ilike` over key columns for predictable behavior against the
// anon client + RLS (no server-side RPC required). FTS indexes in the SQL file
// speed up real workloads once the generated_columns are added — see
// sql/search_schema.sql.
// =============================================================================

import { supabase } from '@/lib/supabase/client'

export type SearchScope = 'all' | 'listings' | 'deals' | 'leads' | 'documents'

export interface SearchFilter {
  status?: string
  dateFrom?: string
  dateTo?: string
  minPrice?: number
  maxPrice?: number
  industry?: string
  scope?: SearchScope
}

export interface ListingResult {
  id: string
  type: 'listing'
  title: string
  subtitle: string
  price: number | null
  status: string | null
  industry: string | null
  created_at?: string | null
  href: string
}

export interface DealResult {
  id: string
  type: 'deal'
  title: string
  subtitle: string
  price: number | null
  status: string | null
  created_at?: string | null
  href: string
}

export interface LeadResult {
  id: string
  type: 'lead'
  kind: 'buyer' | 'seller'
  title: string
  subtitle: string
  status: string | null
  created_at?: string | null
  href: string
}

export interface DocumentResult {
  id: string
  type: 'document'
  title: string
  subtitle: string
  created_at?: string | null
  href: string
}

export type SearchResult =
  | ListingResult
  | DealResult
  | LeadResult
  | DocumentResult

export type SearchResults = SearchResult[]

export interface SearchSummary {
  results: SearchResults
  counts: { listings: number; deals: number; leads: number; documents: number }
  total: number
}

/** Null-query → return empty (avoids dumping everything). */
export function isEmptyQuery(q: string): boolean {
  return !q || q.trim().length < 2
}

const matches = (val: string | null | undefined, q: string): boolean =>
  val ? val.toLowerCase().includes(q.toLowerCase()) : false

/** Apply status/date/price/industry filters to an in-memory result list. */
function applyFilters<T extends { status?: string | null; created_at?: string | null; price?: number | null; industry?: string | null }>(
  rows: T[],
  filter: SearchFilter,
): T[] {
  let out = rows
  if (filter.status) out = out.filter((r) => r.status === filter.status)
  if (filter.industry) out = out.filter((r) => r.industry?.toLowerCase() === filter.industry!.toLowerCase())
  if (filter.minPrice != null) out = out.filter((r) => (r.price ?? 0) >= filter.minPrice!)
  if (filter.maxPrice != null) out = out.filter((r) => (r.price ?? 0) <= filter.maxPrice!)
  if (filter.dateFrom || filter.dateTo) {
    out = out.filter((r) => {
      if (!r.created_at) return true
      const d = new Date(r.created_at).getTime()
      if (filter.dateFrom && d < new Date(filter.dateFrom).getTime()) return false
      if (filter.dateTo && d > new Date(filter.dateTo + 'T23:59:59').getTime()) return false
      return true
    })
  }
  return out
}

/**
 * Search across the requested scope(s). Returns matching rows + per-entity counts.
 */
export async function searchAll(
  query: string,
  filter: SearchFilter = {},
): Promise<SearchSummary> {
  const q = query.trim()
  if (isEmptyQuery(q)) return { results: [], counts: { listings: 0, deals: 0, leads: 0, documents: 0 }, total: 0 }

  const scope = filter.scope || 'all'
  const results: SearchResults = []
  const counts = { listings: 0, deals: 0, leads: 0, documents: 0 }

  const run = async (fn: () => Promise<void>) => {
    try { await fn() } catch (e) { console.error('[search]', e) }
  }

  // --- Listings -----------------------------------------------------------
  if (scope === 'all' || scope === 'listings') {
    await run(async () => {
      const { data } = await supabase
        .from('listings').select('*')
        .or(`business_name.ilike.%${q}%,headline.ilike.%${q}%,industry.ilike.%${q}%,location_general.ilike.%${q}%,description.ilike.%${q}%`)
        .limit(30)
      if (data) {
        const mapped = (data as any[]).map((r) => ({
          id: r.id, type: 'listing' as const,
          title: r.business_name || r.headline || 'Untitled listing',
          subtitle: [r.industry, r.location_general].filter(Boolean).join(' · ') || 'Listing',
          price: r.asking_price ?? null,
          status: r.status ?? null,
          industry: r.industry ?? null,
          created_at: r.created_at,
          href: r.primary_image_url ? `/marketplace/listings/${r.id}` : '/marketplace/listings',
        }))
        counts.listings += mapped.length
        results.push(...applyFilters(mapped, filter))
      }
    })
  }

  // --- Deals --------------------------------------------------------------
  if (scope === 'all' || scope === 'deals') {
    await run(async () => {
      const { data } = await supabase
        .from('deals').select('*')
        .or(`title.ilike.%${q}%,status.ilike.%${q}%`)
        .limit(30)
      if (data) {
        const mapped = (data as any[]).map((r) => ({
          id: r.id, type: 'deal' as const,
          title: r.title || 'Untitled deal',
          subtitle: `Deal · ${r.status || '—'}`,
          price: r.purchase_price ?? null,
          status: r.status ?? null,
          created_at: r.created_at,
          href: '/pipeline',
        }))
        counts.deals += mapped.length
        results.push(...applyFilters(mapped, filter))
      }
    })
  }

  // --- Leads --------------------------------------------------------------
  if (scope === 'all' || scope === 'leads') {
    await run(async () => {
      const [s, b] = await Promise.all([
        supabase.from('seller_leads').select('*').or(`business_name.ilike.%${q}%,contact_name.ilike.%${q}%,industry.ilike.%${q}%,location_general.ilike.%${q}%`).limit(20),
        supabase.from('buyer_leads').select('*').or(`contact_name.ilike.%${q}%,company.ilike.%${q}%,email.ilike.%${q}%,industry_interest.ilike.%${q}%`).limit(20),
      ])
      const sRows = (s.data || []) as any[]
      const bRows = (b.data || []) as any[]
      const sl = sRows.map((r) => ({
        id: r.id, type: 'lead' as const, kind: 'seller' as const,
        title: r.business_name || r.contact_name || 'Seller lead',
        subtitle: `Seller · ${[r.industry, r.location_general].filter(Boolean).join(' · ') || '—'}`,
        status: r.status ?? null, created_at: r.created_at, href: '/leads',
      }))
      const bl = bRows.map((r) => ({
        id: r.id, type: 'lead' as const, kind: 'buyer' as const,
        title: r.contact_name || r.company || 'Buyer lead',
        subtitle: `Buyer · ${r.industry_interest || '—'}`,
        status: r.status ?? null, created_at: r.created_at, href: '/leads',
      }))
      counts.leads += sl.length + bl.length
      results.push(...applyFilters([...sl, ...bl], filter))
    })
  }

  // --- Documents ----------------------------------------------------------
  if (scope === 'all' || scope === 'documents') {
    await run(async () => {
      const { data } = await supabase
        .from('deal_documents').select('*')
        .or(`name.ilike.%${q}%,category.ilike.%${q}%`)
        .limit(20)
      if (data) {
        const mapped = (data as any[]).map((r) => ({
          id: r.id, type: 'document' as const,
          title: r.name || 'Document',
          subtitle: ['deal_documents', r.category].filter(Boolean).join(' · ') || 'Document',
          created_at: r.created_at, href: '/documents',
        }))
        counts.documents += mapped.length
        results.push(...mapped)
      }
    })
  }

  // De-duplicate + order by created_at desc
  const seen = new Set<string>()
  const deduped = results
    .filter((r) => { const k = `${r.type}:${r.id}`; if (seen.has(k)) return false; seen.add(k); return true })
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))

  return { results: deduped, counts, total: deduped.length }
}

/** Distinct industries for the filter dropdown. */
export async function fetchIndustries(): Promise<string[]> {
  try {
    const { data } = await supabase.from('listings').select('industry').not('industry', 'is', null)
    const set = new Set<string>()
    ;(data || []).forEach((r: any) => r.industry && set.add(r.industry))
    return Array.from(set).sort()
  } catch {
    return []
  }
}

/** Possible filter statuses per scope. */
export const SCOPE_STATUSES: Record<Exclude<SearchScope, 'all'>, string[]> = {
  listings: ['active', 'under_contract', 'sold', 'off_market', 'draft'],
  deals: ['new', 'qualified', 'due_diligence', 'negotiation', 'closed', 'lost'],
  leads: ['new', 'contacted', 'qualified', 'unqualified'],
  documents: [],
}

// --- Saved searches ---------------------------------------------------------
export interface SavedSearch {
  id: string
  name: string
  scope: SearchScope
  query: string
  filters: SearchFilter
  created_at?: string
}

export async function fetchSavedSearches(): Promise<SavedSearch[]> {
  try {
    const { data } = await supabase.from('saved_searches').select('*').order('created_at', { ascending: false })
    return (data || []).map((r: any) => ({
      id: r.id, name: r.name, scope: r.scope || 'all',
      query: r.query || '', filters: r.filters || {}, created_at: r.created_at,
    }))
  } catch {
    return []
  }
}

export async function saveSearch(input: { name: string; scope: SearchScope; query: string; filters?: SearchFilter }): Promise<SavedSearch | null> {
  try {
    const { data } = await supabase.from('saved_searches').insert({
      name: input.name, scope: input.scope, query: input.query, filters: input.filters || {},
    }).select().single()
    return data as unknown as SavedSearch
  } catch {
    return null
  }
}

export async function deleteSavedSearch(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('saved_searches').delete().eq('id', id)
    return !error
  } catch {
    return false
  }
}

export async function logSearch(query: string, scope: SearchScope) {
  try { await supabase.from('search_log').insert({ query, scope }) } catch { /* non-critical */ }
}
