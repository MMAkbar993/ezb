'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader } from '@/components/ui'
import TrainingCertificate from '@/components/training/TrainingCertificate'
import type { TrainingCertificate as Cert } from '@/lib/training'

interface VerifiedResult {
  ok: boolean
  reason?: string
  certificate?: {
    id: string
    brokerName: string | null
    brokerEmail: string | null
    moduleTitle: string | null
    issuedAt: string | null
    code: string | null
    verified: boolean
    verifiedAt: string | null
  }
}

// Certificates hub — shows the broker's earned certificates (with QR/verify),
// provides a public code-verification tool, and lists certified brokers.
export default function CertificatesPage() {
  const [brokerId, setBrokerId] = useState<string | null>(null)
  const [certs, setCerts] = useState<Cert[]>([])
  const [modules, setModules] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [code, setCode] = useState('')
  const [verify, setVerify] = useState<VerifiedResult | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    const id = window.localStorage.getItem('concord_broker_id')
    setBrokerId(id || null)
  }, [])

  useEffect(() => {
    if (!brokerId) { setLoading(false); return }
    (async () => {
      try {
        const { fetchCertificates, fetchModules } = await import('@/lib/training')
        const [c, m] = await Promise.all([fetchCertificates(brokerId), fetchModules()])
        setCerts(c as Cert[])
        const map: Record<string, string> = {}
        m.forEach((mod) => { map[mod.id] = mod.title })
        setModules(map)
      } catch {
        /* empty */
      } finally {
        setLoading(false)
      }
    })()
  }, [brokerId])

  const runVerify = async () => {
    const trim = code.trim()
    if (!trim) return
    setChecking(true)
    try {
      const res = await fetch(`/api/certificates/verify?code=${encodeURIComponent(trim)}`)
      setVerify(await res.json())
    } catch {
      setVerify({ ok: false, reason: 'Verification failed. Try again.' })
    } finally {
      setChecking(false)
    }
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 16px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: 'var(--navy)', marginBottom: 4 }}>My Certificates</h1>
        <p style={{ color: 'var(--muted)', margin: 0, fontSize: 14 }}>Your training achievements, printable with QR verification.</p>
      </div>

      {/* earned certificates */}
      {loading ? (
        <Card style={{ padding: 24, color: 'var(--muted)' }}>Loading certificates…</Card>
      ) : certs.length === 0 ? (
        <Card style={{ padding: 24, color: 'var(--muted)' }}>
          <CardHeader title="No certificates yet" subtitle="Complete all lessons in a training module to earn your first certificate." />
        </Card>
      ) : (
        certs.map((c) => (
          <TrainingCertificate
            key={c.id}
            brokerName={brokerId ? '' : 'Broker'}
            moduleTitle={modules[c.module_id] || 'Training Module'}
            moduleId={c.module_id.slice(0, 8)}
            issuedAt={c.issued_at}
            verificationCode={c.verification_code}
            defaultTemplate={(c.template as 'gold' | 'navy' | 'ivory') || 'gold'}
          />
        ))
      )}

      {/* public verification tool */}
      <Card>
        <CardHeader title="Verify a Certificate" subtitle="Enter a certificate’s 8-character verification code to confirm it’s valid." />
        <div style={{ padding: '0 20px 20px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. A3K9QX2M"
            style={{
              flex: 1, minWidth: 220, padding: '10px 12px', borderRadius: 8,
              border: '1px solid var(--line)', fontSize: 15, letterSpacing: 2,
              fontFamily: 'monospace', textTransform: 'uppercase',
            }}
          />
          <button className="btn btn-primary" onClick={runVerify} disabled={checking || !code.trim()}>
            {checking ? 'Checking…' : 'Verify'}
          </button>
        </div>
        {verify && (
          <div
            style={{
              margin: '0 20px 20px', padding: 14, borderRadius: 8, fontSize: 14,
              background: verify.ok ? '#f0fdf4' : '#fdf0f0',
              border: '1px solid ' + (verify.ok ? '#bbf7d0' : '#fecaca'),
              color: verify.ok ? '#15803d' : '#b42318',
            }}
          >
            {verify.ok ? (
              <>
                <strong>✓ Valid certificate</strong>
                {verify.certificate && (
                  <div style={{ marginTop: 8, color: '#374151' }}>
                    <div><strong>{verify.certificate.brokerName || 'Broker'}</strong> — {verify.certificate.moduleTitle || 'training module'}</div>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                      Issued {verify.certificate.issuedAt ? new Date(verify.certificate.issuedAt).toLocaleDateString() : ''}
                      {verify.certificate.verified && ' · marked verified'}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <strong>✗ {verify.reason || 'Invalid certificate code.'}</strong>
            )}
          </div>
        )}
      </Card>

      {/* certified broker roster is rendered in its own section when the user
          opens the roster page; keep this hub focused on the broker's certs. */}
    </div>
  )
}
