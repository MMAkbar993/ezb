'use client'

import AppShell from '@/components/layout/AppShell'
import RecastStudio from '@/components/recast/RecastStudio'

export default function RecastPage() {
  return (
    <AppShell active="Financial Recast">
      <RecastStudio />
    </AppShell>
  )
}
