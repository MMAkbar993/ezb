'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ToastProvider } from '@/components/ui/Toast'
import SearchBar from '@/components/search/SearchBar'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/dashboard/command-center', label: 'Command Center', icon: '🎛️' },
  { href: '/dashboard/analytics', label: 'Analytics', icon: '📈' },
  { href: '/pipeline', label: 'Deal Pipeline', icon: '🔄' },
  { href: '/listings', label: 'Listings', icon: '🏢' },
  { href: '/dashboard/listings/new', label: 'New Listing', icon: '➕' },
  { href: '/dashboard/performance', label: 'Performance', icon: '🏆' },
  { href: '/dashboard/financial-files', label: 'Financial Files', icon: '🗂️' },
  { href: '/recast', label: 'Financial Recast', icon: '📊' },
  { href: '/cim', label: 'CIM Generator', icon: '📑' },
  { href: '/bov', label: 'BOV Generator', icon: '⚖️' },
  { href: '/leads', label: 'Lead Management', icon: '🎯' },
  { href: '/dashboard/search', label: 'Search', icon: '🔍' },
  { href: '/documents', label: 'Documents', icon: '📁' },
  { href: '/due-diligence', label: 'Due Diligence', icon: '🔍' },
  { href: '/dashboard/portal', label: 'Client Portal', icon: '👥' },
  { href: '/agencies', label: 'Agency Admin', icon: '🏛️' },
  { href: '/billing', label: 'Billing', icon: '💳' },
  { href: '/sync', label: 'BizBuySell', icon: '🔄' },
  { href: '/dashboard/social', label: 'Social Media', icon: '📣' },
  { href: '/dashboard/newspaper', label: 'Weekly Newspaper', icon: '📰' },
  { href: '/dashboard/training', label: 'Training', icon: '🎓' },
  { href: '/dashboard/onboarding', label: 'Onboarding', icon: '🚀' },
  { href: '/dashboard/certificates', label: 'Certificates', icon: '🏆' },
  { href: '/dashboard/certified-brokers', label: 'Certified Brokers', icon: '🎖️' },
  { href: '/dashboard/agents', label: 'Agents', icon: '🤖' },
  { href: '/dashboard/marketing', label: 'Marketing', icon: '🖨️' },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
]

export default function AppShell({
  active,
  children,
}: {
  active?: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <ToastProvider>
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--paper)' }}>
        {/* Mobile toggle */}
        <button
          onClick={() => setOpen(!open)}
          style={{
            position: 'fixed', top: 12, left: 12, zIndex: 60,
            display: open ? 'none' : 'inline-flex',
            background: 'var(--navy)', color: '#fff', border: 'none',
            borderRadius: 6, padding: '8px 12px', fontSize: 16, cursor: 'pointer',
          }}
        >
          ☰
        </button>

        {/* Overlay for mobile */}
        {open && (
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 49, display: 'block' }}
          />
        )}

        {/* Sidebar */}
        <aside
          style={{
            width: 240, flexShrink: 0,
            background: 'linear-gradient(180deg, var(--navy) 0%, var(--navy-2) 100%)',
            color: '#fff', display: 'flex', flexDirection: 'column',
            position: 'sticky', top: 0, height: '100vh',
            transition: 'transform 0.25s ease', zIndex: 50,
            transform: open ? 'translateX(0)' : undefined,
          }}
        >
          {/* Brand */}
          <div style={{ padding: '26px 20px 20px', borderBottom: '1px solid rgba(201,168,76,0.3)' }}>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Georgia, serif', color: '#fff', letterSpacing: 0.5 }}>
              CONCORD
            </div>
            <div style={{ fontSize: 11, letterSpacing: '0.28em', color: 'var(--gold-light)', textTransform: 'uppercase', marginTop: 2 }}>
              Deal Platform
            </div>
            <div style={{ height: 2, width: 40, background: 'var(--gold)', marginTop: 10 }} />
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: '14px 12px', overflowY: 'auto' }}>
            {NAV.map((item) => {
              const activeItem = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 14px', marginBottom: 4, borderRadius: 8,
                    textDecoration: 'none', fontSize: 14.5,
                    fontFamily: 'Georgia, serif',
                    color: activeItem ? '#fff' : 'rgba(255,255,255,0.65)',
                    background: activeItem ? 'rgba(201,168,76,0.18)' : 'transparent',
                    borderLeft: activeItem ? `3px solid var(--gold)` : '3px solid transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 17 }}>{item.icon}</span>
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(201,168,76,0.3)', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            CONCORD · v1.0
          </div>
        </aside>

        {/* Main */}
        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Top header with global search */}
          <div style={{ padding: '14px 40px', borderBottom: '1px solid var(--line)', background: '#fff', display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: '100%', maxWidth: 420 }}>
              <SearchBar backdrop />
            </div>
          </div>
          <div style={{ padding: '32px 40px' }}>
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  )
}
