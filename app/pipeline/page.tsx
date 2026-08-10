'use client'

import AppShell from '@/components/layout/AppShell'
import DealPipeline from '@/components/deals/DealPipeline'

export default function PipelinePage() {
  return (
    <AppShell active="Deal Pipeline">
      <DealPipeline />
    </AppShell>
  )
}
