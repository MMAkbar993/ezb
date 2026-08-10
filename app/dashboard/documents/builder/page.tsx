'use client'

import AppShell from '@/components/layout/AppShell'
import DocumentBuilder from '@/components/documents/DocumentBuilder'

export default function DocumentBuilderPage() {
  return (
    <AppShell active="Documents">
      <DocumentBuilder />
    </AppShell>
  )
}
