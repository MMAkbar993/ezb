import { supabase } from '@/lib/supabase/client'

// =============================================================================
// Public website publish workflow — CRM-side (authenticated broker) helpers.
//
// Two gates control whether a listing appears on the public marketplace:
//   1. listings.review_stage: draft -> internal_review -> approved
//      (internal approval, independent of the operational `status` field)
//   2. public_listings.published: the actual "is it live on the website" flag
//      (requires review_stage = 'approved' — enforced by a DB trigger too)
//
// See sql/public_website_schema.sql for the schema this depends on, and
// lib/marketplace.ts for the public-facing read side (queries the
// `public_listing_feed` view built from these same rows).
// =============================================================================

export type ReviewStage = 'draft' | 'internal_review' | 'approved'

export interface PublicListingSettings {
  reviewStage: ReviewStage
  published: boolean
  publishedAt: string | null
  slug: string | null
  isFeatured: boolean
  isConfidential: boolean
  publicTitle: string | null
  showFinancials: boolean
  showExactLocation: boolean
}

const DEFAULT_SETTINGS: PublicListingSettings = {
  reviewStage: 'draft',
  published: false,
  publishedAt: null,
  slug: null,
  isFeatured: false,
  isConfidential: false,
  publicTitle: null,
  showFinancials: false,
  showExactLocation: false,
}

export async function fetchPublicListingSettings(listingId: string): Promise<PublicListingSettings> {
  const [{ data: listing }, { data: pub }] = await Promise.all([
    supabase.from('listings').select('review_stage').eq('id', listingId).maybeSingle(),
    supabase.from('public_listings').select('*').eq('listing_id', listingId).maybeSingle(),
  ])

  return {
    reviewStage: (listing?.review_stage as ReviewStage) || 'draft',
    published: !!pub?.published,
    publishedAt: pub?.published_at || null,
    slug: pub?.slug || null,
    isFeatured: !!pub?.is_featured,
    isConfidential: !!pub?.is_confidential,
    publicTitle: pub?.public_title || null,
    showFinancials: !!pub?.show_financials,
    showExactLocation: !!pub?.show_exact_location,
  }
}

async function setReviewStage(listingId: string, stage: ReviewStage): Promise<boolean> {
  const { error } = await supabase
    .from('listings')
    .update({ review_stage: stage, updated_at: new Date().toISOString() })
    .eq('id', listingId)
  return !error
}

export const submitForReview = (listingId: string) => setReviewStage(listingId, 'internal_review')
export const approveListing = (listingId: string) => setReviewStage(listingId, 'approved')
export const revertToDraft = (listingId: string) => setReviewStage(listingId, 'draft')

export interface PublishOptions {
  isConfidential?: boolean
  publicTitle?: string | null
  showFinancials?: boolean
  showExactLocation?: boolean
  isFeatured?: boolean
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60)
}

/**
 * Publish (or update) a listing's public website settings. Requires
 * review_stage === 'approved' — the DB trigger rejects the write otherwise,
 * this check just gives a clearer error before hitting the network.
 */
export async function publishToWebsite(
  listingId: string,
  opts: PublishOptions = {},
): Promise<{ ok: boolean; error?: string }> {
  const { data: listing } = await supabase.from('listings').select('review_stage, business_name').eq('id', listingId).maybeSingle()
  if (!listing || listing.review_stage !== 'approved') {
    return { ok: false, error: 'Listing must be approved (internal review) before it can be published to the public website.' }
  }

  const { data: existing } = await supabase.from('public_listings').select('slug').eq('listing_id', listingId).maybeSingle()
  const slug = existing?.slug || `${slugify(listing.business_name || 'business')}-${listingId.slice(0, 8)}`

  const patch = {
    listing_id: listingId,
    slug,
    published: true,
    published_at: new Date().toISOString(),
    is_confidential: !!opts.isConfidential,
    public_title: opts.publicTitle ?? null,
    show_financials: !!opts.showFinancials,
    show_exact_location: !!opts.showExactLocation,
    is_featured: !!opts.isFeatured,
  }

  const { error } = await supabase.from('public_listings').upsert(patch, { onConflict: 'listing_id' })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function unpublishFromWebsite(listingId: string): Promise<boolean> {
  const { error } = await supabase
    .from('public_listings')
    .update({ published: false })
    .eq('listing_id', listingId)
  return !error
}
