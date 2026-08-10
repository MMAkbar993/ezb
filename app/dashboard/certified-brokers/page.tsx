'use client'

import CertifiedBrokers from '@/components/training/CertifiedBrokers'

export default function CertifiedBrokersPage() {
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 16px 40px' }}>
      <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: 'var(--navy)', marginBottom: 4 }}>
        Certified Brokers
      </h1>
      <p style={{ color: 'var(--muted)', marginTop: 0, marginBottom: 20, fontSize: 14 }}>
        Team members who’ve earned training certificates. Verify any certificate with its code on the Certificates page.
      </p>
      <CertifiedBrokers />
    </div>
  )
}
