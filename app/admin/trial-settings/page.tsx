'use client'

import AdminTrialSettings from '@/components/agency/AdminTrialSettings'

// /admin/trial-settings — admin global + per-agency trial configuration.
// Super-admin only; wrap with an admin gate in production.
export default function AdminTrialSettingsPage() {
  return <AdminTrialSettings />
}
