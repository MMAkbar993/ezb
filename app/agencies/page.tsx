'use client'

import AppShell from '@/components/layout/AppShell'
import AgencyAdmin from '@/components/agencies/AgencyAdmin'

export default function AgenciesPage() {
  return (
    <AppShell active="Agency Admin">
      <AgencyAdmin />
    </AppShell>
  )
}
