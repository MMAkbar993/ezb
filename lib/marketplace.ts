// =============================================================================
// Public listing marketplace helpers — query the public_listing_feed view
// (sql/public_website_schema.sql) for the public site, broker directory, and
// marketplace stats. NEVER query `listings` directly from public-facing code
// — the view is the only safe projection (see lib/publicListing.ts for the
// CRM-side publish workflow that populates it).
// =============================================================================

// The Supabase client is imported lazily (not at module top-level) so this
// module can be safely imported by server components that get statically
// collected/prerendered during `next build` — a top-level import would throw
// immediately if NEXT_PUBLIC_SUPABASE_URL/ANON_KEY aren't set at build time.
async function getClient() {
  return (await import('@/lib/supabase/client')).supabase
}

// Shape returned by public.public_listing_feed — a narrow, pre-redacted
// projection of `listings`. Fields like agent_id and exact property address
// are structurally absent; financial fields are null unless the broker
// opted in per listing (public_listings.show_financials).
export interface PublicListing {
  id: string
  business_name: string | null
  headline: string | null
  industry: string | null
  location_general: string | null
  description: string | null
  reason_for_sale: string | null
  asking_price: number | null
  annual_revenue: number | null
  sde: number | null
  ebitda: number | null
  inventory_value: number | null
  ffe_value: number | null
  real_estate_included: boolean | null
  status: string | null
  created_at?: string | null
  updated_at?: string | null
  image_urls: string[] | null
  primary_image_url: string | null
  featured_image_url: string | null
  slug: string | null
  is_featured: boolean | null
  is_confidential: boolean | null
  location_exposure: 'general' | 'city_state' | 'full_address' | null
  property_city: string | null
  property_state: string | null
  property_address: string | null
  property_zip: string | null
  require_buyer_phone: boolean | null
  require_buyer_zip: boolean | null
  ask_funds_available: boolean | null
  ask_buyer_timeframe: boolean | null
  broker_id: string | null
  website: string | null
}

const FEED = 'public_listing_feed'

export interface MarketplaceStats {
  totalListings: number
  avgAsking: number
  totalBusinessesSold: number
  industries: number
}

export interface SearchFilters {
  query?: string
  industry?: string
  location?: string
  minPrice?: number
  maxPrice?: number
  maxRevenue?: number
}

export async function fetchMarketplaceStats(): Promise<MarketplaceStats> {
  const supabase = await getClient()
  const [{ data, error }, { data: soldRow }] = await Promise.all([
    supabase.from(FEED).select('asking_price, industry'),
    supabase.from('public_deal_stats').select('total_businesses_sold').single(),
  ])
  if (error || !data) return { totalListings: 0, avgAsking: 0, totalBusinessesSold: 0, industries: 0 }

  const prices = data.map((l: any) => l.asking_price).filter((p: any) => typeof p === 'number') as number[]
  const industries = new Set((data as any[]).map((l) => l.industry).filter(Boolean)).size
  return {
    totalListings: data.length,
    avgAsking: prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0,
    totalBusinessesSold: (soldRow as any)?.total_businesses_sold ?? 0,
    industries,
  }
}

export async function searchPublicListings(filters: SearchFilters = {}): Promise<PublicListing[]> {
  const supabase = await getClient()
  let query = supabase.from(FEED).select('*')

  if (filters.industry) query = query.eq('industry', filters.industry)
  if (filters.location) query = query.ilike('location_general', `%${filters.location}%`)
  if (filters.minPrice) query = query.gte('asking_price', filters.minPrice)
  if (filters.maxPrice) query = query.lte('asking_price', filters.maxPrice)
  if (filters.query) {
    const like = `%${filters.query}%`
    query = query.or(`business_name.ilike.${like},headline.ilike.${like},industry.ilike.${like}`)
  }

  const { data, error } = await query.order('created_at', { ascending: false }).limit(100)
  if (error) {
    console.error('searchPublicListings error:', error)
    return []
  }
  return (data as PublicListing[]) || []
}

export async function fetchFeaturedListings(limit = 6): Promise<PublicListing[]> {
  const supabase = await getClient()
  const { data, error } = await supabase
    .from(FEED)
    .select('*')
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data as PublicListing[]
}

export async function fetchListingById(id: string): Promise<PublicListing | null> {
  const supabase = await getClient()
  const { data, error } = await supabase.from(FEED).select('*').eq('id', id).maybeSingle()
  if (error || !data) return null
  return data as PublicListing
}

export async function fetchAllIndustries(): Promise<string[]> {
  const supabase = await getClient()
  const { data, error } = await supabase.from(FEED).select('industry')
  if (error || !data) return []
  const unique = new Set((data as any[]).map((l) => l.industry).filter(Boolean))
  return Array.from(unique).sort() as string[]
}

// Broker directory
export interface PublicBroker {
  id: string
  profile_id: string | null
  public_name: string
  title: string
  bio: string
  avatar_url: string
  phone: string
  email_public: string
  linkedin: string
  agency?: { name: string } | null
}

export async function fetchPublicBrokers(): Promise<PublicBroker[]> {
  const supabase = await getClient()
  const { data, error } = await supabase
    .from('broker_profiles')
    .select('*, agency:agencies(name)')
    .eq('is_public', true)
    .limit(100)
  if (error || !data) return []
  return (data as any[]).map((b) => ({
    id: b.id,
    profile_id: b.profile_id || null,
    public_name: b.public_name || '',
    title: b.title || 'Business Broker',
    bio: b.bio || '',
    avatar_url: b.avatar_url || '',
    phone: b.phone || '',
    email_public: b.email_public || '',
    linkedin: b.linkedin || '',
    agency: b.agency,
  }))
}

export async function fetchPublicBrokerById(id: string): Promise<PublicBroker | null> {
  const supabase = await getClient()
  const { data, error } = await supabase
    .from('broker_profiles')
    .select('*, agency:agencies(name)')
    .eq('id', id)
    .eq('is_public', true)
    .maybeSingle()
  if (error || !data) return null
  const b = data as any
  return {
    id: b.id,
    profile_id: b.profile_id || null,
    public_name: b.public_name || '',
    title: b.title || 'Business Broker',
    bio: b.bio || '',
    avatar_url: b.avatar_url || '',
    phone: b.phone || '',
    email_public: b.email_public || '',
    linkedin: b.linkedin || '',
    agency: b.agency,
  }
}

// Reverse lookup for the listing detail page's "Listed by" link — keyed by
// profile_id (listings.agent_id / feed's broker_id), not broker_profiles.id.
export async function fetchBrokerByProfileId(profileId: string): Promise<PublicBroker | null> {
  const supabase = await getClient()
  const { data, error } = await supabase
    .from('broker_profiles')
    .select('*, agency:agencies(name)')
    .eq('profile_id', profileId)
    .eq('is_public', true)
    .maybeSingle()
  if (error || !data) return null
  const b = data as any
  return {
    id: b.id,
    profile_id: b.profile_id || null,
    public_name: b.public_name || '',
    title: b.title || 'Business Broker',
    bio: b.bio || '',
    avatar_url: b.avatar_url || '',
    phone: b.phone || '',
    email_public: b.email_public || '',
    linkedin: b.linkedin || '',
    agency: b.agency,
  }
}

// A broker's active, published listing portfolio (BizBuySell-style profile
// page). Keyed by profile_id, which is what listings.agent_id -> the feed's
// broker_id column actually points at (broker_profiles.id is a separate,
// directory-only id — see sql/broker_listing_link.sql).
export async function fetchListingsByBroker(profileId: string): Promise<PublicListing[]> {
  const supabase = await getClient()
  const { data, error } = await supabase
    .from(FEED)
    .select('*')
    .eq('broker_id', profileId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data as PublicListing[]
}

// Lead capture from public forms
export interface PublicLeadInput {
  kind: 'buyer' | 'seller'
  name: string
  email: string
  phone?: string
  source: string
  message?: string
  listing_id?: string | null
  zip?: string
  fundsAvailable?: string
  timeframe?: string
}

export async function capturePublicLead(input: PublicLeadInput): Promise<{ ok: boolean; error?: string }> {
  // Sellers -> seller_leads; Buyers -> buyer_leads (reuse existing real tables).
  // NOTE: this previously dropped the person's name, message, and (for
  // buyers) which listing they asked about — only email/phone were ever
  // saved, even though full_name/message/listing_id all exist as real
  // columns on both tables. Fixed here.
  const supabase = await getClient()
  const table = input.kind === 'seller' ? 'seller_leads' : 'buyer_leads'
  const payload: any =
    input.kind === 'seller'
      ? { full_name: input.name, email: input.email, phone: input.phone || null, message: input.message || null, status: 'new' }
      : {
          listing_id: input.listing_id || null, full_name: input.name, contact_name: input.name,
          email: input.email, phone: input.phone || null, message: input.message || null, status: 'new',
          zip: input.zip || null, funds_available: input.fundsAvailable ? Number(input.fundsAvailable) || null : null,
          timeframe: input.timeframe || null,
        }

  const { error } = await supabase.from(table).insert(payload)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
