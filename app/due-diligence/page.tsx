'use client'

import AppShell from '@/components/layout/AppShell'
import DueDiligenceDashboard from '@/components/dueDiligence/DueDiligenceDashboard'

export default function DueDiligencePage() {
  return (
    <AppShell active="Due Diligence">
      <DueDiligenceDashboard />
    </AppShell>
  )
}
