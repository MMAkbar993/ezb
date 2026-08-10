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
  const { data, error } = await supabase.from(FEED).select('asking_price, industry')
  if (error || !data) return { totalListings: 0, avgAsking: 0, totalBusinessesSold: 0, industries: 0 }

  const prices = data.map((l: any) => l.asking_price).filter((p: any) => typeof p === 'number') as number[]
  const industries = new Set((data as any[]).map((l) => l.industry).filter(Boolean)).size
  return {
    totalListings: data.length,
    avgAsking: prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0,
    totalBusinessesSold: 128, // demo metric — replace with real closed-deal count
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

// Lead capture from public forms
export interface PublicLeadInput {
  kind: 'buyer' | 'seller'
  name: string
  email: string
  phone?: string
  source: string
  message?: string
  listing_id?: string | null
}

export async function capturePublicLead(input: PublicLeadInput): Promise<{ ok: boolean; error?: string }> {
  // Sellers -> seller_leads; Buyers -> buyer_leads (reuse existing real tables).
  const supabase = await getClient()
  const table = input.kind === 'seller' ? 'seller_leads' : 'buyer_leads'
  const payload: any =
    input.kind === 'seller'
      ? { business_name: input.name, email: input.email, phone: input.phone || null, status: 'new' }
      : { email: input.email, phone: input.phone || null, status: 'new' }

  const { error } = await supabase.from(table).insert(payload)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
