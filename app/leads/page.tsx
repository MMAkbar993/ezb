'use client'

import AppShell from '@/components/layout/AppShell'
import LeadsDashboard from '@/components/leads/LeadsDashboard'

export default function LeadsPage() {
  return (
    <AppShell active="Lead Management">
      <LeadsDashboard />
    </AppShell>
  )
}
