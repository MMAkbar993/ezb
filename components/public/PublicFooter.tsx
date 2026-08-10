import Link from 'next/link'

/** Public footer for the marketplace. */
export default function PublicFooter() {
  return (
    <footer style={{ background: '#1a1a2e', color: '#fff', marginTop: 80 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 32 }}>
        <div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 800, letterSpacing: 0.5 }}>CONCORD</div>
          <div style={{ fontSize: 10, letterSpacing: '0.25em', color: '#c9a84c', textTransform: 'uppercase', marginTop: 2 }}>Deal Platform</div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginTop: 12, maxWidth: 260 }}>
            Confidential business brokerage for buyers and sellers of established companies.
          </p>
        </div>

        <FooterCol title="For Buyers" links={[['Browse Listings', '/marketplace/listings'], ['How It Works', '/marketplace/buy'], ['Buyer Questionnaire', '/marketplace/buy'], ['Acquisition Financing', '/marketplace/buy']]} />
        <FooterCol title="For Sellers" links={[['Sell a Business', '/marketplace/sell'], ['Business Valuation', '/marketplace/sell'], ['Reasons to Sell', '/marketplace/sell'], ['Listing Your Business', '/marketplace/sell']]} />
        <FooterCol title="Company" links={[['Our Brokers', '/marketplace/brokers'], ['About Us', '/about'], ['Contact', '/contact']]} />
      </div>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '18px 24px', fontSize: 12, color: 'rgba(255,255,255,0.4)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span>© {new Date().getFullYear()} Concord Deal Platform. All rights reserved.</span>
          <span>Confidential. Business brokerage services provided by licensed professionals.</span>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div style={{ fontSize: 13, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c9a84c', fontWeight: 700, marginBottom: 14 }}>{title}</div>
      {links.map(([label, href]) => (
        <Link key={label} href={href} style={{ display: 'block', color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: 14, marginBottom: 10, fontFamily: 'Georgia, serif' }}>
          {label}
        </Link>
      ))}
    </div>
  )
}
