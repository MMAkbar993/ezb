'use client'

import AppShell from '@/components/layout/AppShell'
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard'
import { ToastProvider } from '@/components/ui/Toast'

export default function AnalyticsPage() {
  return (
    <AppShell active="Analytics">
      <ToastProvider>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <AnalyticsDashboard />
        </div>
      </ToastProvider>
    </AppShell>
  )
}
