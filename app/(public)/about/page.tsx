import type { Metadata } from 'next'
import Link from 'next/link'

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://concord.ezbusinessadvisors.com'

export const metadata: Metadata = {
  title: 'About Us',
  description: 'EZ Business Advisors is a confidential business brokerage helping owners sell and buyers acquire established, profitable businesses.',
  alternates: { canonical: `${BASE}/about` },
}

export default function AboutPage() {
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '56px 24px' }}>
      <div style={{ color: '#c9a84c', fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700 }}>About Us</div>
      <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 36, color: '#1a1a2e', margin: '10px 0 20px' }}>
        A Confidential, Professional Approach to Business Brokerage
      </h1>
      <p style={{ fontSize: 16, color: '#555', lineHeight: 1.8, marginBottom: 18 }}>
        EZ Business Advisors helps business owners sell what they've built and helps qualified
        buyers find their next acquisition — with the discretion, financial rigor, and process
        a transaction of this size deserves.
      </p>
      <p style={{ fontSize: 16, color: '#555', lineHeight: 1.8, marginBottom: 18 }}>
        Every listing we bring to market goes through a structured internal review before it's
        published: financials are normalized (recast), a broker opinion of value is prepared, and
        confidential details are protected until a prospective buyer is qualified. Sellers control
        exactly what's public — from an anonymous listing title to whether financials are shown
        before an NDA is signed.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, margin: '40px 0' }}>
        <Pillar title="Confidential by Default" body="Business identity, exact location, and financials stay private unless a seller explicitly approves them for public display." />
        <Pillar title="Rigorous Valuation" body="Every listing is backed by a normalized financial recast and a broker opinion of value — not guesswork." />
        <Pillar title="Qualified Buyers Only" body="Full financials and identifying details are shared only with buyers who've signed an NDA and demonstrated the means to close." />
      </div>

      <div style={{ background: '#faf9f4', border: '1px solid #ece8dc', borderRadius: 12, padding: 28, marginTop: 20 }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#1a1a2e', margin: '0 0 10px' }}>Work With Us</h2>
        <p style={{ fontSize: 14.5, color: '#666', lineHeight: 1.7, margin: '0 0 18px' }}>
          Whether you're ready to sell or looking for your next acquisition, our brokers are here to help.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/marketplace/sell" style={btnPrimary}>Get a Free Valuation</Link>
          <Link href="/marketplace/listings" style={btnGhost}>Browse Businesses</Link>
          <Link href="/marketplace/brokers" style={btnGhost}>Meet Our Brokers</Link>
        </div>
      </div>
    </div>
  )
}

function Pillar({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #ece8dc', borderRadius: 10, padding: 22 }}>
      <div style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 16, color: '#1a1a2e', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13.5, color: '#666', lineHeight: 1.6 }}>{body}</div>
    </div>
  )
}

const btnPrimary: React.CSSProperties = { background: '#1a1a2e', color: '#fff', padding: '11px 22px', borderRadius: 6, textDecoration: 'none', fontWeight: 700, fontFamily: 'Georgia, serif', fontSize: 14 }
const btnGhost: React.CSSProperties = { border: '1px solid #c9a84c', color: '#1a1a2e', padding: '11px 22px', borderRadius: 6, textDecoration: 'none', fontWeight: 700, fontFamily: 'Georgia, serif', fontSize: 14 }
