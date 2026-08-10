'use client'

import AppShell from '@/components/layout/AppShell'
import SyncDashboard from '@/components/bbs/SyncDashboard'

export default function SyncPage() {
  return (
    <AppShell active="BizBuySell">
      <SyncDashboard />
    </AppShell>
  )
}
