'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Agency, fetchAgencies } from '@/lib/agencies'
import { fetchListingsByAgency, PublicListing } from '@/lib/marketplace'
import PublicListingCard from '@/components/public/PublicListingCard'
import { LoadingState } from '@/components/ui'

/** White-label public agency home, rendered on agency.concordplatform.com. */
export default function AgencyHomePage({ params }: { params: { slug: string } }) {
  const [agency, setAgency] = useState<Agency | null>(null)
  const [listings, setListings] = useState<PublicListing[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const agencies = await fetchAgencies()
        const found = agencies.find((a) => a.slug === params.slug)
        setAgency(found || null)
        setListings(found ? await fetchListingsByAgency(found.id) : [])
      } catch { setAgency(null) } finally { setLoading(false) }
    })()
  }, [params.slug])

  const brand = agency?.brand_color || '#1a1a2e'
  const accent = agency?.accent_color || '#c9a84c'

  if (loading) return <LoadingState label="Loading..." />

  return (
    <div>
      {/* Top bar with agency branding */}
      <header style={{ background: brand, color: '#fff', padding: '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {agency?.logo_url ? (
            <img src={agency.logo_url} alt={agency?.name} style={{ height: 36 }} />
          ) : (
            <span style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 800 }}>{agency?.name || 'Agency'}</span>
          )}
        </div>
        <nav style={{ display: 'flex', gap: 20, fontSize: 14, fontFamily: 'Georgia, serif' }}>
          <Link href="/marketplace/listings" style={{ color: '#fff', textDecoration: 'none' }}>Listings</Link>
          <Link href="/marketplace/sell" style={{ color: '#fff', textDecoration: 'none' }}>Sell</Link>
          <Link href="/marketplace/brokers" style={{ color: '#fff', textDecoration: 'none' }}>Brokers</Link>
        </nav>
      </header>

      {/* Hero */}
      <section style={{ background: `linear-gradient(135deg, ${brand}, ${brand}cc)`, color: '#fff', padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ color: accent, fontSize: 13, letterSpacing: '0.25em', textTransform: 'uppercase', fontWeight: 700 }}>
            {agency?.about ? 'Confidential Business Brokerage' : (agency?.name || 'Agency') + ' — Business Brokerage'}
          </div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 42, fontWeight: 800, margin: '18px 0', lineHeight: 1.15 }}>
            Buy or Sell a <span style={{ color: accent }}>Profitable Business</span>
          </h1>
          {agency?.about && <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 16, lineHeight: 1.6 }}>{agency.about}</p>}
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 28 }}>
            <Link href="/marketplace/listings" style={{ background: accent, color: brand, padding: '13px 28px', borderRadius: 6, textDecoration: 'none', fontWeight: 700, fontFamily: 'Georgia, serif' }}>Browse Listings</Link>
            <Link href="/marketplace/sell" style={{ border: `2px solid ${accent}`, color: accent, padding: '11px 28px', borderRadius: 6, textDecoration: 'none', fontWeight: 700, fontFamily: 'Georgia, serif' }}>Value My Business</Link>
          </div>
        </div>
      </section>

      {/* Listings */}
      <section style={{ maxWidth: 1200, margin: '60px auto 0', padding: '0 24px' }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 30, color: brand, margin: '0 0 24px' }}>Active Listings</h2>
        {listings.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#888', padding: 50, background: '#fff', border: '1px solid #ece8dc', borderRadius: 12 }}>
            Contact us for current confidential opportunities.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {listings.map((l) => <PublicListingCard key={l.id} listing={l} />)}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer style={{ background: brand, color: 'rgba(255,255,255,0.7)', marginTop: 80, padding: '30px 40px', textAlign: 'center', fontSize: 13 }}>
        © {new Date().getFullYear()} {agency?.name || 'Agency'}. All rights reserved. Business brokerage services provided by licensed professionals.
      </footer>
    </div>
  )
}
