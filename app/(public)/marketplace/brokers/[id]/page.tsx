'use client'

// ---------------------------------------------------------------------------
// Individual public broker profile — BizBuySell "BrokerWorks" style: bio +
// contact card plus a grid of this broker's active, published listings.
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { fetchPublicBrokerById, fetchListingsByBroker, PublicBroker, PublicListing } from '@/lib/marketplace'
import PublicListingCard from '@/components/public/PublicListingCard'
import { LoadingState } from '@/components/ui'

export default function BrokerProfilePage() {
  const params = useParams()
  const id = params?.id as string
  const [broker, setBroker] = useState<PublicBroker | null>(null)
  const [listings, setListings] = useState<PublicListing[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    (async () => {
      const b = await fetchPublicBrokerById(id)
      setBroker(b)
      if (b?.profile_id) {
        setListings(await fetchListingsByBroker(b.profile_id))
      }
      setLoading(false)
    })()
  }, [id])

  if (loading) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 24px' }}>
        <LoadingState />
      </div>
    )
  }

  if (!broker) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🤝</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>Broker not found</div>
        <div style={{ marginTop: 16 }}>
          <Link href="/marketplace/brokers" style={{ color: '#c9a84c', fontWeight: 700, textDecoration: 'none' }}>← Back to all brokers</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px' }}>
      <Link href="/marketplace/brokers" style={{ color: '#888', fontSize: 13, textDecoration: 'none' }}>← All brokers</Link>

      {/* Profile header */}
      <div style={{ display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap', background: '#fff', border: '1px solid #ece8dc', borderRadius: 14, padding: 32, marginTop: 16, boxShadow: '0 2px 12px rgba(26,26,46,0.06)' }}>
        <div style={{ width: 120, height: 120, borderRadius: '50%', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '3px solid #c9a84c', flexShrink: 0 }}>
          {broker.avatar_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={broker.avatar_url} alt={broker.public_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ color: '#c9a84c', fontSize: 44, fontWeight: 800, fontFamily: 'Georgia, serif' }}>{(broker.public_name || 'B').charAt(0)}</span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 30, color: '#1a1a2e', margin: 0 }}>{broker.public_name}</h1>
          <div style={{ fontSize: 14, color: '#c9a84c', fontWeight: 700, marginTop: 4 }}>{broker.title || 'Business Broker'}</div>
          {broker.agency?.name && <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{broker.agency.name}</div>}
          <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
            {broker.email_public && (
              <Link href={`mailto:${broker.email_public}`} style={{ color: '#1a1a2e', textDecoration: 'none', fontSize: 13.5, fontWeight: 600 }}>✉️ {broker.email_public}</Link>
            )}
            {broker.phone && (
              <Link href={`tel:${broker.phone}`} style={{ color: '#1a1a2e', textDecoration: 'none', fontSize: 13.5, fontWeight: 600 }}>📞 {broker.phone}</Link>
            )}
            {broker.linkedin && (
              <Link href={broker.linkedin} target="_blank" style={{ color: '#1a1a2e', textDecoration: 'none', fontSize: 13.5, fontWeight: 600 }}>🔗 LinkedIn</Link>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'center', background: '#faf9f4', borderRadius: 10, padding: '16px 24px' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#1a1a2e', fontFamily: 'Georgia, serif' }}>{listings.length}</div>
          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Active Listing{listings.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {broker.bio && (
        <div style={{ background: '#fff', border: '1px solid #ece8dc', borderRadius: 14, padding: 28, marginTop: 20 }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, color: '#c9a84c', fontWeight: 700, marginBottom: 10 }}>About</div>
          <p style={{ fontSize: 14.5, color: '#555', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>{broker.bio}</p>
        </div>
      )}

      {/* Listing portfolio */}
      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#1a1a2e', marginBottom: 16 }}>
          Listings by {broker.public_name}
        </h2>
        {listings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', background: '#fff', border: '1px solid #ece8dc', borderRadius: 12, color: '#888' }}>
            No active published listings right now — contact {broker.public_name.split(' ')[0] || 'this broker'} directly for off-market opportunities.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {listings.map((l) => <PublicListingCard key={l.id} listing={l} />)}
          </div>
        )}
      </div>
    </div>
  )
}
