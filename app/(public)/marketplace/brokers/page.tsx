'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { fetchPublicBrokers, PublicBroker } from '@/lib/marketplace'
import { LoadingState } from '@/components/ui'

export default function BrokersPage() {
  const [brokers, setBrokers] = useState<PublicBroker[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPublicBrokers().then(setBrokers).finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: 44 }}>
        <div style={{ color: '#c9a84c', fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700 }}>Our Team</div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 38, color: '#1a1a2e', margin: '8px 0 12px' }}>Meet the Concord Brokers</h1>
        <p style={{ color: '#666', fontSize: 15, maxWidth: 560, margin: '0 auto', lineHeight: 1.6 }}>
          Licensed, experienced business brokerage professionals guiding you through every step of your transaction.
        </p>
      </div>

      {loading ? <LoadingState /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 }}>
          {brokers.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#888', padding: 60, background: '#fff', border: '1px solid #ece8dc', borderRadius: 12 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🤝</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>Broker profiles coming soon</div>
              <div style={{ fontSize: 14, marginTop: 8 }}>Contact us directly to be connected with a dedicated broker.</div>
            </div>
          ) : (
            brokers.map((b) => (
              <Link
                key={b.id}
                href={`/marketplace/brokers/${b.id}`}
                style={{ background: '#fff', border: '1px solid #ece8dc', borderRadius: 12, padding: 28, textAlign: 'center', boxShadow: '0 2px 12px rgba(26,26,46,0.06)', textDecoration: 'none', display: 'block' }}
              >
                <div style={{ width: 88, height: 88, borderRadius: '50%', background: '#1a1a2e', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '3px solid #c9a84c' }}>
                  {b.avatar_url ? (
                    <img src={b.avatar_url} alt={b.public_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ color: '#c9a84c', fontSize: 32, fontWeight: 800, fontFamily: 'Georgia, serif' }}>{(b.public_name || 'B').charAt(0)}</span>
                  )}
                </div>
                <div style={{ fontSize: 19, fontWeight: 700, color: '#1a1a2e', fontFamily: 'Georgia, serif' }}>{b.public_name}</div>
                <div style={{ fontSize: 13, color: '#c9a84c', fontWeight: 600, marginTop: 4 }}>{b.title || 'Business Broker'}</div>
                {b.agency?.name && <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{b.agency.name}</div>}
                {b.bio && <p style={{ fontSize: 13.5, color: '#666', lineHeight: 1.6, marginTop: 12 }}>{b.bio}</p>}
                <div style={{ marginTop: 16, color: '#1a1a2e', fontSize: 13, fontWeight: 700 }}>View Profile & Listings →</div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  )
}
