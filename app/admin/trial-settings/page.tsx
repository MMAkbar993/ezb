'use client'

import AdminTrialSettings from '@/components/agency/AdminTrialSettings'

// /admin/trial-settings — admin global + per-agency trial configuration.
// Gated by app/admin/layout.tsx (profiles.role === 'admin').
export default function AdminTrialSettingsPage() {
  return <AdminTrialSettings />
}
