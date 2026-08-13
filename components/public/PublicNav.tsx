'use client'

import Link from 'next/link'
import { useState } from 'react'

/** Public-facing header for the marketplace (no auth shell). */
export default function PublicNav() {
  const [open, setOpen] = useState(false)
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 50, background: '#ffffff', borderBottom: '1px solid #ece8dc', boxShadow: '0 1px 8px rgba(26,26,46,0.06)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 72 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'baseline', gap: 8, textDecoration: 'none' }}>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 800, color: '#1a1a2e', letterSpacing: 0.5 }}>CONCORD</span>
          <span style={{ fontSize: 10, letterSpacing: '0.25em', color: '#c9a84c', textTransform: 'uppercase' }}>Markets</span>
        </Link>

        {/* Desktop nav — hidden under 860px via .publicnav-links (an inline
            display:none can't be overridden by a media query, so visibility
            for both this and the toggle button below is CSS-class driven). */}
        <nav className="publicnav-links" style={{ gap: 28, alignItems: 'center' }}>
          <NavLink href="/marketplace/listings">Buy a Business</NavLink>
          <NavLink href="/marketplace/sell">Sell a Business</NavLink>
          <NavLink href="/marketplace/brokers">Our Brokers</NavLink>
          <NavLink href="/about">About</NavLink>
          <NavLink href="/contact">Contact</NavLink>
          <Link
            href="/auth"
            style={{ background: '#1a1a2e', color: '#fff', padding: '10px 22px', borderRadius: 6, textDecoration: 'none', fontWeight: 700, fontSize: 14, fontFamily: 'Georgia, serif' }}
          >
            Broker Login
          </Link>
        </nav>

        <button
          onClick={() => setOpen(!open)}
          className="publicnav-toggle"
          aria-label={open ? 'Close menu' : 'Open menu'}
          style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#1a1a2e' }}
        >
          {open ? '✕' : '☰'}
        </button>
      </div>
      {open && (
        <nav style={{ padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid #ece8dc', background: '#fff' }}>
          <NavLink href="/marketplace/listings" onClick={() => setOpen(false)}>Buy a Business</NavLink>
          <NavLink href="/marketplace/sell" onClick={() => setOpen(false)}>Sell a Business</NavLink>
          <NavLink href="/marketplace/brokers" onClick={() => setOpen(false)}>Our Brokers</NavLink>
          <NavLink href="/about" onClick={() => setOpen(false)}>About</NavLink>
          <NavLink href="/contact" onClick={() => setOpen(false)}>Contact</NavLink>
          <Link
            href="/auth"
            onClick={() => setOpen(false)}
            style={{ background: '#1a1a2e', color: '#fff', padding: '10px 16px', borderRadius: 6, textDecoration: 'none', fontWeight: 700, fontSize: 14, fontFamily: 'Georgia, serif', textAlign: 'center' }}
          >
            Broker Login
          </Link>
        </nav>
      )}
    </header>
  )
}

function NavLink({ href, children, arrow, onClick }: { href: string; children: React.ReactNode; arrow?: boolean; onClick?: () => void }) {
  return (
    <Link href={href} onClick={onClick} style={{ color: '#1a1a2e', textDecoration: 'none', fontSize: 14.5, fontWeight: 600, fontFamily: 'Georgia, serif', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {children} {arrow && <span style={{ color: '#c9a84c' }}>→</span>}
    </Link>
  )
}
