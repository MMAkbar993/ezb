'use client'

import AppShell from '@/components/layout/AppShell'
import ListingsDashboard from '@/components/listings/ListingsDashboard'

export default function ListingsPage() {
  return (
    <AppShell active="Listings">
      <ListingsDashboard />
    </AppShell>
  )
}
