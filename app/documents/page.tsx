'use client'

import AppShell from '@/components/layout/AppShell'
import DocumentsDashboard from '@/components/documents/DocumentsDashboard'

export default function DocumentsPage() {
  return (
    <AppShell active="Documents">
      <DocumentsDashboard />
    </AppShell>
  )
}
