'use client'

import { Suspense } from 'react'
import AppShell from '@/components/layout/AppShell'
import BillingDashboard from '@/components/billing/BillingDashboard'

export default function BillingPage() {
  return (
    <AppShell active="Billing">
      <Suspense fallback={<div style={{ padding: 40 }}>Loading billing...</div>}>
        <BillingDashboard />
      </Suspense>
    </AppShell>
  )
}
