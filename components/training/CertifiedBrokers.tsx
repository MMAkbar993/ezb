'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader } from '@/components/ui'
import type { CertifiedBroker } from '@/lib/training'

// Certified brokers roster — reads the certified_brokers view.
export default function CertifiedBrokers() {
  const [brokers, setBrokers] = useState<CertifiedBroker[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const { fetchCertifiedBrokers } = await import('@/lib/training')
        setBrokers(await fetchCertifiedBrokers())
      } catch {
        /* empty */
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <Card>
      <CardHeader
        title="Certified Brokers"
        subtitle="Team members who have completed at least one training module"
        right={<BadgeCert count={brokers.length} />}
      />
      {loading ? (
        <div style={{ padding: '0 20px 20px', color: 'var(--muted)' }}>Loading roster…</div>
      ) : brokers.length === 0 ? (
        <p style={{ padding: '0 20px 20px', color: 'var(--muted)' }}>
          No certified brokers yet. Team members earn a certificate when they complete all lessons in a module.
        </p>
      ) : (
        <div style={{ padding: '4px 8px 12px' }}>
          {brokers.map((b, i) => (
            <div
              key={b.broker_id}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 12px',
                borderBottom: i < brokers.length - 1 ? '1px solid var(--line)' : 'none',
              }}
            >
              <div
                style={{
                  width: 38, height: 38, flex: '0 0 38px', borderRadius: '50%',
                  background: 'linear-gradient(135deg,#0f2038,#14294f)', color: 'var(--gold)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 16,
                }}
              >
                {(b.full_name || '?').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{b.full_name || 'Unnamed broker'}</div>
                {b.email && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{b.email}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gold-dark)' }}>
                  {b.modules_certified} module{b.modules_certified === 1 ? '' : 's'}
                </div>
                {b.last_certified_at && (
                  <div style={{ fontSize: 11, color: 'var(--muted-2)' }}>
                    {new Date(b.last_certified_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function BadgeCert({ count }: { count: number }) {
  return (
    <span
      style={{
        background: 'var(--gold)', color: '#fff', borderRadius: 20, padding: '3px 12px',
        fontSize: 12, fontWeight: 700, fontFamily: 'Georgia, serif',
      }}
    >
      🏆 {count} certified
    </span>
  )
}
