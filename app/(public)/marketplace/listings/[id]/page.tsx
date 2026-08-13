import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fetchListingById, fetchBrokerByProfileId, PublicListing, PublicBroker } from '@/lib/marketplace'
import ListingDetailInteractive from '@/components/public/ListingDetailInteractive'

// ---------------------------------------------------------------------------
// /marketplace/listings/[id] — Server Component.
// Fetches the listing server-side via the public_listing_feed view (the only
// safe public projection — see sql/public_website_schema.sql), renders full
// SEO metadata (title, OG, JSON-LD) and delegates the interactive gallery +
// contact form to a client child. No service-role client needed here: the
// view itself is the security boundary, so the anon key is sufficient and
// 404s cleanly for draft/unapproved/unpublished listings (they're simply
// absent from the view).
// ---------------------------------------------------------------------------

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://concord.ezbusinessadvisors.com'

async function getListing(id: string): Promise<PublicListing | null> {
  return fetchListingById(id)
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const listing = await getListing(params.id)
  if (!listing) {
    return {
      title: 'Listing Not Found',
      robots: { index: false },
    }
  }
  const title = `${listing.business_name} for Sale${listing.location_general ? ` in ${listing.location_general}` : ''}`
  const description =
    listing.headline ||
    (listing.description || '').slice(0, 155) ||
    `${listing.business_name} — a profitable business offered for confidential sale.`
  const images = [listing.primary_image_url, listing.featured_image_url].filter(Boolean) as string[]

  return {
    title,
    description,
    alternates: { canonical: `${BASE}/marketplace/listings/${listing.id}` },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${BASE}/marketplace/listings/${listing.id}`,
      siteName: 'Concord Deal Platform',
      images: images.map((url) => ({ url, width: 1200, height: 630, alt: listing.business_name || '' })),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images,
    },
  }
}

export default async function ListingDetailPage({ params }: { params: { id: string } }) {
  const listing = await getListing(params.id)
  if (!listing) notFound()
  const broker: PublicBroker | null = listing.broker_id ? await fetchBrokerByProfileId(listing.broker_id) : null

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: listing.business_name,
    description: listing.headline || undefined,
    image: listing.primary_image_url || undefined,
    priceRange: listing.asking_price ? `$${listing.asking_price.toLocaleString()}` : undefined,
    address: listing.location_general
      ? { '@type': 'PostalAddress', addressRegion: listing.location_general }
      : undefined,
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Link href="/marketplace/listings" style={{ color: '#888', textDecoration: 'none', fontSize: 14, fontFamily: 'Georgia, serif' }}>
        ← Back to listings
      </Link>

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', margin: '20px 0 24px', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 34, color: '#1a1a2e', margin: 0 }}>{listing.business_name}</h1>
            <span style={{ background: '#f0ecdf', color: '#1a1a2e', padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 700 }}>{listing.industry || 'Business'}</span>
          </div>
          <p style={{ color: '#666', fontSize: 15, margin: '8px 0 0' }}>{listing.headline}</p>
          {(() => {
            // Show the most specific location the broker opted into exposing
            // (location_exposure) — full address, city/state, or just the
            // general area. Never falls back to a more specific field than
            // what the view actually returned (that gating happens server-side).
            const specific = listing.property_address
              ? [listing.property_address, listing.property_city, listing.property_state].filter(Boolean).join(', ')
              : listing.property_city
                ? [listing.property_city, listing.property_state].filter(Boolean).join(', ')
                : null
            const display = specific || listing.location_general
            return display ? <p style={{ color: '#888', fontSize: 14, margin: '4px 0 0' }}>📍 {display}</p> : null
          })()}
          {listing.website && (
            <p style={{ margin: '4px 0 0', fontSize: 14 }}>
              🌐 <a href={listing.website} target="_blank" rel="noopener noreferrer" style={{ color: '#1a1a2e', fontWeight: 600 }}>{listing.website}</a>
            </p>
          )}
          {broker && (
            <p style={{ margin: '8px 0 0', fontSize: 13, color: '#888' }}>
              Listed by{' '}
              <Link href={`/marketplace/brokers/${broker.id}`} style={{ color: '#c9a84c', fontWeight: 700, textDecoration: 'none' }}>
                {broker.public_name}
              </Link>
            </p>
          )}
        </div>
      </div>

      {/* Interactive gallery + financial snapshot + contact form */}
      <ListingDetailInteractive listing={listing} />
    </div>
  )
}
