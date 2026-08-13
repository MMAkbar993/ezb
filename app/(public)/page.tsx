import type { Metadata } from 'next'
import Link from 'next/link'
import { fetchFeaturedListings, fetchMarketplaceStats, fetchAllIndustries } from '@/lib/marketplace'
import PublicListingCard from '@/components/public/PublicListingCard'
import AuthRedirect from '@/components/public/AuthRedirect'

// ---------------------------------------------------------------------------
// / — public homepage (Server Component). Hero, search, featured listings,
// and buyer/seller CTAs, all server-rendered from public_listing_feed (the
// safe projection — see sql/public_website_schema.sql). The search form is
// a plain GET form so it works with zero client JS; only the "already
// signed in? go to /dashboard" nudge (AuthRedirect) runs client-side, and it
// never blocks or replaces this SEO content.
// ---------------------------------------------------------------------------

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://concord.ezbusinessadvisors.com'
const APP_NAME = 'EZ Business Advisors'

export const metadata: Metadata = {
  title: `${APP_NAME} — Buy or Sell a Business`,
  description:
    'A confidential business-for-sale marketplace from EZ Business Advisors. Browse vetted, profitable businesses for sale, or get a free valuation to sell your business.',
  alternates: { canonical: BASE },
  openGraph: {
    title: `${APP_NAME} — Buy or Sell a Business`,
    description: 'Browse vetted, profitable businesses for sale, or get a free valuation to sell yours.',
    type: 'website',
    url: BASE,
    siteName: 'Concord Deal Platform',
  },
}

export default async function HomePage() {
  const [featured, stats, industries] = await Promise.all([
    fetchFeaturedListings(6),
    fetchMarketplaceStats(),
    fetchAllIndustries(),
  ])

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: APP_NAME,
    url: BASE,
    description: 'Confidential business brokerage — buy or sell an established, profitable business.',
  }

  return (
    <div>
      <AuthRedirect />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* HERO */}
      <section
        style={{
          background: 'linear-gradient(135deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%)',
          color: '#fff',
          padding: '80px 24px 64px',
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ color: '#c9a84c', fontSize: 13, letterSpacing: '0.25em', textTransform: 'uppercase', fontWeight: 700 }}>
            Confidential Business Brokerage
          </div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(30px, 5vw, 48px)', margin: '16px 0 14px', lineHeight: 1.15, color: '#fff' }}>
            Buy or Sell a Business<br />With Confidence
          </h1>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.78)', maxWidth: 640, margin: '0 auto 36px', lineHeight: 1.6 }}>
            EZ Business Advisors connects qualified buyers with vetted, profitable businesses —
            and helps owners sell confidentially, for the right price.
          </p>

          {/* Search — plain GET form, no client JS required */}
          <form
            action="/marketplace/listings"
            method="GET"
            className="grid-responsive collapse-md"
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 14,
              '--grid-cols': '2fr 1.3fr 1fr auto',
              '--grid-gap': '10px',
              maxWidth: 820,
              margin: '0 auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
            } as React.CSSProperties}
          >
            <input name="q" placeholder="Keyword (e.g. restaurant, HVAC, e-commerce)" style={searchInput} />
            <select name="industry" defaultValue="" style={searchInput}>
              <option value="">All Industries</option>
              {industries.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
            <input name="location" placeholder="Location" style={searchInput} />
            <button type="submit" style={{ background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 8, padding: '0 22px', fontWeight: 700, fontFamily: 'Georgia, serif', fontSize: 14, cursor: 'pointer' }}>
              Search
            </button>
          </form>

          <div style={{ marginTop: 28, display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/marketplace/listings" style={ctaGold}>Browse All Listings →</Link>
            <Link href="/marketplace/sell" style={ctaGhost}>Get a Free Valuation</Link>
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <section style={{ background: '#fff', borderBottom: '1px solid #ece8dc' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 20, textAlign: 'center' }}>
          <Stat label="Businesses for Sale" value={String(stats.totalListings)} />
          <Stat label="Avg. Asking Price" value={stats.avgAsking ? '$' + stats.avgAsking.toLocaleString() : '—'} />
          <Stat label="Businesses Sold" value={String(stats.totalBusinessesSold)} />
          <Stat label="Industries" value={String(stats.industries)} />
        </div>
      </section>

      {/* FEATURED LISTINGS */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '56px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 26, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ color: '#c9a84c', fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700 }}>Featured Opportunities</div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: '#1a1a2e', margin: '6px 0 0' }}>Recently Listed Businesses</h2>
          </div>
          <Link href="/marketplace/listings" style={{ color: '#1a1a2e', fontWeight: 700, fontFamily: 'Georgia, serif', textDecoration: 'none' }}>
            View all listings →
          </Link>
        </div>

        {featured.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', background: '#faf9f4', border: '1px solid #ece8dc', borderRadius: 12, color: '#888' }}>
            New listings are added regularly — check back soon, or{' '}
            <Link href="/contact" style={{ color: '#c9a84c', fontWeight: 700 }}>contact a broker</Link> about off-market opportunities.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {featured.map((l) => (
              <PublicListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </section>

      {/* BUYER / SELLER CTAs */}
      <section style={{ background: '#faf9f4', padding: '56px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
          <CtaCard
            eyebrow="For Buyers"
            title="Find Your Next Acquisition"
            body="Browse a curated selection of vetted, cash-flowing businesses. Sign an NDA to unlock full financials on any listing that interests you."
            href="/marketplace/listings"
            label="Browse Businesses"
          />
          <CtaCard
            eyebrow="For Sellers"
            title="Sell Your Business Confidentially"
            body="Get a free, no-obligation valuation from a licensed business broker. We market your business discreetly to qualified buyers only."
            href="/marketplace/sell"
            label="Get a Free Valuation"
          />
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700, color: '#1a1a2e' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{label}</div>
    </div>
  )
}

function CtaCard({ eyebrow, title, body, href, label }: { eyebrow: string; title: string; body: string; href: string; label: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #ece8dc', borderRadius: 12, padding: 32 }}>
      <div style={{ color: '#c9a84c', fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700 }}>{eyebrow}</div>
      <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#1a1a2e', margin: '10px 0 12px' }}>{title}</h3>
      <p style={{ fontSize: 14.5, color: '#666', lineHeight: 1.6, margin: '0 0 20px' }}>{body}</p>
      <Link href={href} style={{ display: 'inline-block', background: '#1a1a2e', color: '#fff', padding: '12px 24px', borderRadius: 6, textDecoration: 'none', fontWeight: 700, fontFamily: 'Georgia, serif', fontSize: 14 }}>
        {label}
      </Link>
    </div>
  )
}

const searchInput: React.CSSProperties = {
  padding: '13px 14px', border: '1px solid #d8d2c2', borderRadius: 8, fontSize: 14, fontFamily: 'Georgia, serif', outline: 'none', color: '#1a1a2e',
}
const ctaGold: React.CSSProperties = {
  background: '#c9a84c', color: '#1a1a2e', padding: '13px 26px', borderRadius: 6, textDecoration: 'none', fontWeight: 700, fontFamily: 'Georgia, serif', fontSize: 14.5,
}
const ctaGhost: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.4)', color: '#fff', padding: '13px 26px', borderRadius: 6, textDecoration: 'none', fontWeight: 700, fontFamily: 'Georgia, serif', fontSize: 14.5,
}
