'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ToastProvider } from '@/components/ui/Toast'
import SearchBar from '@/components/search/SearchBar'
import { supabase } from '@/lib/supabase/client'
import { RoleContext, deriveRoleState, Role } from '@/lib/auth/RoleContext'

interface NavItem {
  href: string
  label: string
  icon: string
  minRole?: Role // undefined = everyone; 'broker' = broker+admin; 'admin' = admin only (admin === owner, see lib/auth/RoleContext.tsx)
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/dashboard/command-center', label: 'Command Center', icon: '🎛️', minRole: 'broker' },
  { href: '/dashboard/analytics', label: 'Analytics', icon: '📈', minRole: 'broker' },
  { href: '/pipeline', label: 'Deal Pipeline', icon: '🔄' },
  { href: '/listings', label: 'Listings', icon: '🏢' },
  { href: '/dashboard/listings/new', label: 'New Listing', icon: '➕' },
  { href: '/dashboard/performance', label: 'Performance', icon: '🏆', minRole: 'broker' },
  { href: '/dashboard/financial', label: 'Financial', icon: '🗂️' },
  { href: '/leads', label: 'Lead Management', icon: '🎯' },
  { href: '/dashboard/search', label: 'Search', icon: '🔍' },
  { href: '/documents', label: 'Documents', icon: '📁' },
  { href: '/due-diligence', label: 'Due Diligence', icon: '🔍' },
  { href: '/dashboard/portal', label: 'Client Portal', icon: '👥' },
  { href: '/agencies', label: 'Agency Admin', icon: '🏛️', minRole: 'admin' },
  { href: '/billing', label: 'Billing', icon: '💳', minRole: 'admin' },
  { href: '/dashboard/social', label: 'Social Media', icon: '📣', minRole: 'broker' },
  { href: '/dashboard/newspaper', label: 'Weekly Newspaper', icon: '📰', minRole: 'broker' },
  { href: '/dashboard/training', label: 'Training', icon: '🎓' },
  { href: '/dashboard/onboarding', label: 'Onboarding', icon: '🚀' },
  { href: '/dashboard/certificates', label: 'Certificates', icon: '🏆' },
  { href: '/dashboard/certified-brokers', label: 'Certified Brokers', icon: '🎖️' },
  { href: '/dashboard/agents', label: 'Agents', icon: '🤖' },
  { href: '/dashboard/marketing', label: 'Marketing', icon: '🖨️' },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
]

const ROLE_RANK: Record<Role, number> = { agent: 0, broker: 1, admin: 2 }

export default function AppShell({
  active,
  children,
}: {
  active?: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Self-contained role fetch: AppShell is rendered by pages both under
  // app/dashboard/layout.tsx (which already provides RoleContext) and by
  // several top-level pages that aren't (e.g. /pipeline, /listings, /leads,
  // /billing, /agencies) — fetching here directly makes nav gating correct
  // on every page that renders AppShell, not just the ones nested under a
  // layout that happens to populate the context.
  const [role, setRole] = useState<Role | null>(null)
  const [roleLoading, setRoleLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id
      if (!uid) {
        if (!cancelled) setRoleLoading(false)
        return
      }
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle()
      if (!cancelled) {
        setRole((prof?.role as Role) || 'agent')
        setRoleLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const roleState = deriveRoleState(role, roleLoading)

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  // While role is still loading, show everything — RLS is the real
  // enforcement layer underneath; this filter is only for a clean
  // minimum-access UI, not the security boundary itself.
  const visibleNav = roleLoading ? NAV : NAV.filter((item) => !item.minRole || ROLE_RANK[roleState.role] >= ROLE_RANK[item.minRole])

  return (
    <ToastProvider>
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--paper)' }}>
        {/* Mobile toggle — visibility controlled by CSS (.appshell-toggle,
            app/globals.css) so it only appears under the 900px breakpoint;
            an inline `display` ternary can't be overridden by a media query. */}
        <button
          onClick={() => setOpen(!open)}
          className="appshell-toggle"
          aria-label={open ? 'Close menu' : 'Open menu'}
          style={{
            position: 'fixed', top: 12, left: 12, zIndex: 60,
            background: 'var(--navy)', color: '#fff', border: 'none',
            borderRadius: 6, padding: '8px 12px', fontSize: 16, cursor: 'pointer',
          }}
        >
          {open ? '✕' : '☰'}
        </button>

        {/* Overlay for mobile */}
        {open && (
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 49, display: 'block' }}
          />
        )}

        {/* Sidebar — .appshell-sidebar (app/globals.css) goes off-canvas
            (position: fixed + translateX(-100%)) under the 900px breakpoint
            and slides in when the .open class is present; unchanged (sticky,
            always visible) above that breakpoint. */}
        <aside
          className={`appshell-sidebar${open ? ' open' : ''}`}
          style={{
            width: 240, flexShrink: 0,
            background: 'linear-gradient(180deg, var(--navy) 0%, var(--navy-2) 100%)',
            color: '#fff', display: 'flex', flexDirection: 'column',
            position: 'sticky', top: 0, height: '100vh',
            zIndex: 50,
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
            {visibleNav.map((item) => {
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
        <main className="appshell-main" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Top header with global search */}
          <div className="appshell-topbar" style={{ padding: '14px 40px', borderBottom: '1px solid var(--line)', background: '#fff', display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ width: '100%', maxWidth: 420 }}>
              <SearchBar backdrop />
            </div>
          </div>
          <div className="appshell-content" style={{ padding: '32px 40px' }}>
            <RoleContext.Provider value={roleState}>{children}</RoleContext.Provider>
          </div>
        </main>
      </div>
    </ToastProvider>
  )
}
