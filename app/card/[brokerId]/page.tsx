'use client'

import PublicCardView from '@/components/cards/PublicCardView'

// Public business card page — anyone with the link can view, save contact, and
// print. No auth required.
export default function CardPage({ params }: { params: { brokerId: string } }) {
  return <PublicCardView brokerId={params.brokerId} />
}
