'use client'

import AppShell from '@/components/layout/AppShell'
import { CartProvider } from '@/components/marketing/CartContext'
import { ToastProvider } from '@/components/ui/Toast'

// Shared shell for all /dashboard/marketing/* routes. Wraps the cart context so
// brokers can stage items in the store and check out from the orders page.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell active="Marketing">
      <ToastProvider>
        <CartProvider>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            {/* Page header with quick links */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
              <div>
                <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 26, color: 'var(--navy)', marginBottom: 4 }}>
                  Marketing Materials
                </h1>
                <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 0 }}>
                  Design, customize, and order branded marketing materials from one place.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { href: '/dashboard/marketing', label: 'Store' },
                  { href: '/dashboard/marketing/templates', label: 'Templates' },
                  { href: '/dashboard/marketing/orders', label: 'Orders' },
                ].map((n) => (
                  <a
                    key={n.href}
                    href={n.href}
                    style={{
                      padding: '8px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13, textDecoration: 'none',
                      background: 'var(--cream)', color: 'var(--navy)', border: '1px solid var(--line)',
                    }}
                  >
                    {n.label}
                  </a>
                ))}
              </div>
            </div>
            {children}
          </div>
        </CartProvider>
      </ToastProvider>
    </AppShell>
  )
}
