import Link from 'next/link'

const NAV = [
  { href: '/legal/terms', label: 'Terms of Service' },
  { href: '/legal/privacy', label: 'Privacy Policy' },
  { href: '/legal/dmca', label: 'DMCA' },
  { href: '/legal/cookies', label: 'Cookie Policy' },
]

/**
 * Shared document shell for legal pages: sub-nav across legal docs, a title
 * bar, and a styled body column with consistent heading markup.
 */
export default function LegalDocument({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: React.ReactNode
}) {
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px 80px' }}>
      {/* Legal docs sub-nav */}
      <nav
        style={{
          display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24,
        }}
      >
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              fontSize: 12.5, textDecoration: 'none', padding: '6px 14px', borderRadius: 999,
              fontFamily: 'Georgia, serif',
              background: item.href === `/legal/${currentSlug(title)}` ? 'var(--gold)' : 'var(--cream)',
              color: item.href === `/legal/${currentSlug(title)}` ? 'var(--navy)' : 'var(--muted)',
              border: '1px solid var(--line)',
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Document */}
      <article
        style={{
          background: 'var(--cream)', border: '1px solid var(--line)',
          borderRadius: 10, boxShadow: '0 1px 3px rgba(26,26,46,0.08)', overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '28px 32px 22px', borderBottom: '2px solid var(--gold)',
            background: 'linear-gradient(180deg, #fff 0%, var(--cream) 100%)',
          }}
        >
          <h1 style={{ margin: 0, fontSize: 28, color: 'var(--navy)', fontFamily: 'Georgia, serif' }}>
            {title}
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--muted)' }}>
            Last updated: {updated}
          </p>
        </div>
        <div className="legal-body" style={{ padding: '28px 32px 40px', fontSize: 15, lineHeight: 1.7, color: 'var(--text)' }}>
          {children}
        </div>
      </article>
    </div>
  )
}

// Resolve the current legal page slug from a human title so the sub-nav
// active state matches. This is a lightweight helper; the actual active
// highlight falls back gracefully if a title doesn't map to a route.
function currentSlug(title: string) {
  const map: Record<string, string> = {
    'Terms of Service': 'terms',
    'Privacy Policy': 'privacy',
    dmca: 'dmca',
    'Cookie Policy': 'cookies',
  }
  return map[title] || 'terms'
}
