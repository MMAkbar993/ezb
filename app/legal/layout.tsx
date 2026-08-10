import Link from 'next/link'

/** Shared shell for legal documents: header bar + centered document column. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      {/* Legal header bar */}
      <div
        style={{
          background: 'linear-gradient(180deg, var(--navy) 0%, var(--navy-2) 100%)',
          color: '#fff',
        }}
      >
        <div
          style={{
            maxWidth: 860,
            margin: '0 auto',
            padding: '22px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 800, letterSpacing: 0.5 }}>
              CONCORD
            </div>
            <div style={{ fontSize: 10, letterSpacing: '0.25em', color: 'var(--gold-light)', textTransform: 'uppercase', marginTop: 2 }}>
              Legal
            </div>
          </div>
          <Link
            href="/"
            style={{
              color: '#fff', textDecoration: 'none', fontSize: 14,
              background: 'rgba(201,168,76,0.18)', border: '1px solid var(--gold)',
              padding: '8px 16px', borderRadius: 8, fontFamily: 'Georgia, serif',
            }}
          >
            ← Back to Home
          </Link>
        </div>
      </div>

      {children}
    </div>
  )
}
