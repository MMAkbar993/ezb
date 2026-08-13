'use client'

import AppShell from '@/components/layout/AppShell'
import EmailSettings from '@/components/settings/EmailSettings'
import LicenseSettings from '@/components/settings/LicenseSettings'
import TeamManagement from '@/components/settings/TeamManagement'
import BusinessCardBrandSettings from '@/components/cards/BusinessCardBrandSettings'
import AgencyBrandAdmin from '@/components/cards/AgencyBrandAdmin'
import { ToastProvider } from '@/components/ui/Toast'

export default function SettingsPage() {
  return (
    <AppShell active="Settings">
      <ToastProvider>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <h1
            style={{
              fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 26,
              color: 'var(--navy)', marginBottom: 4,
            }}
          >
            Settings
          </h1>
          <p style={{ color: 'var(--muted)', marginBottom: 24 }}>Manage your notification, email, licensing, and branding preferences.</p>
          <TeamManagement />
          <EmailSettings />
          <div style={{ height: 24 }} />
          <LicenseSettings />
          <div style={{ height: 24 }} />
          <AgencyBrandAdmin />
          <div style={{ height: 24 }} />
          <BusinessCardBrandSettings />
        </div>
      </ToastProvider>
    </AppShell>
  )
}
