'use client'

import QrScanPage from '@/components/cards/QrScanPage'

// QR scan destination — opened when a card's QR is scanned. No auth required;
// renders contact info with one-click save-to-contacts (vCard).
export default function QrPage({ params }: { params: { brokerId: string } }) {
  return <QrScanPage brokerId={params.brokerId} />
}
