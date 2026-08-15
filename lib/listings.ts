import { supabase } from '@/lib/supabase/client'
import { ensureDealForListing } from '@/lib/pipeline'

// ---------------------------------------------------------------------------
// Listings CRUD — configured to the REAL listings schema (probed live):
//   id, agent_id, business_name, headline, industry, location_general,
//   description, asking_price, annual_revenue, sde, ebitda, inventory_value,
//   ffe_value, real_estate_included, reason_for_sale, status, created_at,
//   updated_at, image_urls, primary_image_url, featured_image_url
//   + real-estate option (property_value, square_footage, ..., total_value)
// ---------------------------------------------------------------------------

export interface Listing {
  id: string
  agent_id: string | null
  business_name: string | null
  headline: string | null
  industry: string | null
  location_general: string | null
  description: string | null
  asking_price: number | null
  annual_revenue: number | null
  sde: number | null
  ebitda: number | null
  inventory_value: number | null
  ffe_value: number | null
  real_estate_included: boolean | null
  reason_for_sale: string | null
  status: string | null
  created_at?: string | null
  updated_at?: string | null
  image_urls: string[] | null
  primary_image_url: string | null
  featured_image_url: string | null
  // Real-estate option (only populated when real_estate_included = true)
  property_value: number | null
  property_description: string | null
  square_footage: number | null
  land_acres: number | null
  year_built: number | null
  property_address: string | null
  property_city: string | null
  property_state: string | null
  property_zip: string | null
  total_value: number | null
  // Operational details (apply regardless of real_estate_included)
  num_employees: number | null
  num_employees_ft: number | null
  num_employees_pt: number | null
  num_employees_contractor: number | null
  num_owners: number | null
  business_square_footage: number | null
  lease_years_remaining: number | null
  monthly_rent: number | null
  // BizBuySell-style classification + marketing detail
  business_type: string | null
  sub_industry: string | null
  year_established: number | null
  hours_of_operation: string | null
  growth_potential: string | null
  competition: string | null
  market_position: string | null
  furniture_and_equipment_included: boolean | null
  inventory_included: boolean | null
  // Real-estate detail (only relevant when real_estate_included = true)
  property_type: string | null
  real_estate_asking_price: number | null
  // BLI-only confidentiality — never affects CIM/BOV (see lib/bli.ts)
  bli_anonymize: boolean | null
  // "Business is currently" status flags
  is_absentee_owner: boolean | null
  is_relocatable: boolean | null
  is_home_based: boolean | null
  is_franchise: boolean | null
  website: string | null
  website_confidential: boolean | null
}

export type ListingInput = Partial<Omit<Listing, 'id' | 'created_at' | 'updated_at'>>

// Confirmed against the live listings_status_check constraint (2026-08-11) —
// matches Rabin's brief §3 exactly. NOT pending_sale/under_contract/sold,
// which the constraint rejects (that was the previous, incorrect assumption).
export const LISTING_STATUSES = ['draft', 'active', 'under_loi', 'closed', 'withdrawn']

export async function fetchListings(status?: string): Promise<Listing[]> {
  let query = supabase.from('listings').select('*')
  if (status) query = query.eq('status', status)
  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    console.error('fetchListings error:', error)
    throw new Error(error.message || 'Failed to load listings')
  }
  return (data as Listing[]) || []
}

export async function fetchListing(id: string): Promise<Listing | null> {
  const { data, error } = await supabase.from('listings').select('*').eq('id', id).single()
  if (error) {
    console.error('fetchListing error:', error)
    throw new Error(error.message || 'Failed to load listing')
  }
  return (data as Listing) || null
}

/** Clone a listing into a new draft — keeps every business/financial/
 * operational/real-estate field, but starts fresh: new id, draft status, no
 * photos (a duplicate shouldn't inherit the original's storefront images),
 * and " (Copy)" appended to the name so it's visually distinguishable in the
 * list. agent_id is re-stamped to the current session automatically by
 * createListing() below, same as any other new listing. */
export async function duplicateListing(id: string): Promise<Listing> {
  const source = await fetchListing(id)
  if (!source) throw new Error('Listing not found')
  // total_value is a Postgres GENERATED column (computed from asking_price +
  // property_value) — inserting an explicit value into it errors (428C9).
  const { id: _id, created_at: _createdAt, updated_at: _updatedAt, agent_id: _agentId, total_value: _totalValue, ...rest } = source
  return createListing({
    ...rest,
    business_name: `${source.business_name || 'Untitled'} (Copy)`,
    status: 'draft',
    image_urls: null,
    primary_image_url: null,
    featured_image_url: null,
  })
}

export async function createListing(input: ListingInput): Promise<Listing> {
  // listings.agent_id is NOT NULL — always stamp it with the authenticated
  // user's id (auth.uid() at the DB layer maps to the JWT subject). This
  // permanently fixes the "null value in column \"agent_id\"" insert error.
  // Prefer the signed-in user; fall back to an explicit input.agent_id if a
  // caller supplies one (e.g. service-role seeding).
  //
  // Explicitly check for a valid session first: the RLS insert policy
  // requires agent_id = auth.uid(), and if the session token is missing or
  // has expired, the request is evaluated as `anon` (no insert policy at
  // all) and fails with a cryptic 42501 RLS error instead of a clear
  // "please sign in again" message.
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData?.session) {
    throw new Error('Your session has expired. Please sign in again and retry.')
  }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Your session has expired. Please sign in again and retry.')
  }
  const agentId: string | null = user?.id ?? input.agent_id ?? null

  const { data, error } = await supabase
    .from('listings')
    .insert({ ...input, agent_id: agentId, status: input.status || 'active' })
    .select()
    .single()
  if (error) {
    console.error('createListing error:', error)
    throw new Error(error.message || 'Failed to create listing')
  }
  // Auto-link to the Deal Pipeline as soon as a listing goes live — a
  // listing previously never showed up on the pipeline board unless a
  // broker separately created an unrelated "Deal" and picked it from a
  // dropdown. Best-effort: never block listing creation on this.
  if ((data as Listing).status === 'active') {
    ensureDealForListing((data as Listing).id).catch(() => {})
  }
  return data as Listing
}

export async function updateListing(id: string, input: ListingInput): Promise<Listing> {
  const { data, error } = await supabase
    .from('listings')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) {
    console.error('updateListing error:', error)
    throw new Error(error.message || 'Failed to update listing')
  }
  if (input.status === 'active') {
    ensureDealForListing(id).catch(() => {})
  }
  return data as Listing
}

export async function deleteListing(id: string): Promise<void> {
  const { error } = await supabase.from('listings').delete().eq('id', id)
  if (error) {
    console.error('deleteListing error:', error)
    throw new Error(error.message || 'Failed to delete listing')
  }
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------
export const fmtMoney = (n: number | null | undefined): string => {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export const fmtMoneyCompact = (n: number | null | undefined): string => {
  if (n === null || n === undefined || isNaN(n)) return '—'
  if (Math.abs(n) >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2).replace(/\.00$/, '') + 'M'
  if (Math.abs(n) >= 1_000) return '$' + Math.round(n / 1_000) + 'K'
  return '$' + n
}

export const fmtNum = (n: number | null | undefined): string => {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(n)
}
