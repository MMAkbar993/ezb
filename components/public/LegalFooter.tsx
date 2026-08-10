import Link from 'next/link'

/** Slim legal footer rendered site-wide (wraps all routes via root layout). */
export default function LegalFooter() {
  const year = new Date().getFullYear()
  return (
    <footer
      style={{
        borderTop: '1px solid var(--line)',
        background: 'var(--paper)',
        padding: '18px 24px',
        width: '100%',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          fontSize: 13,
          color: 'var(--muted)',
        }}
      >
        <span>© {year} Concord Deal Platform. All rights reserved.</span>
        <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
          <Link href="/legal/terms" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
            Terms of Service
          </Link>
          <Link href="/legal/privacy" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
            Privacy Policy
          </Link>
          <Link href="/legal/dmca" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
            DMCA
          </Link>
          <Link href="/legal/cookies" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
            Cookie Policy
          </Link>
        </nav>
      </div>
    </footer>
  )
}
