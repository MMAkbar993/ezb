'use client'

import { Suspense } from 'react'
import AppShell from '@/components/layout/AppShell'
import BovGenerator from '@/components/bov/BovGenerator'

export default function BovPage() {
  return (
    <AppShell active="BOV Generator">
      <Suspense fallback={<div style={{ padding: 40, color: 'var(--muted)', fontFamily: 'Georgia, serif' }}>Loading BOV Generator...</div>}>
        <BovGenerator />
      </Suspense>
    </AppShell>
  )
}
