'use client'

// ---------------------------------------------------------------------------
// /seller-form/[listingId]/[token] — no-login page for a seller to review and
// sign one of their legal document forms. The token in the URL is the only
// auth, same pattern as /portal/[dealId]/[token].
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import DynamicFormFields, { type FormValues } from '@/components/forms/DynamicFormFields'
import type { SellerFormSection } from '@/lib/sellerFormSchemas'

interface FormPayload {
  schema: { title: string; intro?: string; sections: SellerFormSection[]; requiresSignature: boolean }
  formData: FormValues
  status: 'draft' | 'sent' | 'signed'
  signerName: string | null
  signedAt: string | null
  businessName: string | null
}

export default function SellerFormSignPage() {
  const params = useParams()
  const listingId = String(params.listingId)
  const token = String(params.token)

  const [payload, setPayload] = useState<FormPayload | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [values, setValues] = useState<FormValues>({})
  const [signerName, setSignerName] = useState('')
  const [signerTitle, setSignerTitle] = useState('')
  const [agree, setAgree] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    fetch(`/api/seller-form?listingId=${encodeURIComponent(listingId)}&token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) { setError(data.error || 'This link is invalid or has expired.'); return }
        setPayload(data)
        setValues(data.formData || {})
        if (data.status === 'signed') setDone(true)
      })
      .catch(() => setError('Something went wrong loading this document.'))
      .finally(() => setLoading(false))
  }, [listingId, token])

  const set = (key: string, value: string | boolean) => setValues((v) => ({ ...v, [key]: value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!signerName.trim()) { setError('Please type your full name to sign.'); return }
    if (payload?.schema.requiresSignature && !agree) { setError('Please confirm the acknowledgement below.'); return }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/seller-form/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, token, formData: values, signerName, signerTitle }),
      })
      const data = await res.json()
      if (!data.ok) { setError(data.error || 'Could not submit.'); if (data.alreadySigned) setDone(true); return }
      setDone(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: '#0b1f3a' }}>Loading…</div>
  }

  if (error && !payload) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0b1f3a,#14294f)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: '#fff', borderRadius: 10, padding: 32, maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>⚠️</div>
          <div style={{ fontFamily: 'Georgia,serif', fontSize: 18, color: '#0b1f3a', fontWeight: 700, marginBottom: 8 }}>Link not valid</div>
          <div style={{ fontSize: 13.5, color: '#6b7280' }}>{error}</div>
        </div>
      </div>
    )
  }

  if (!payload) return null

  return (
    <div style={{ minHeight: '100vh', background: '#f7f6f2' }}>
      <div style={{ background: 'linear-gradient(135deg,#0b1f3a,#14294f)', padding: '26px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', fontFamily: 'Georgia,serif' }}>CONCORD <span style={{ color: '#c9a84c' }}>· EZ Business Advisors</span></div>
        <div style={{ fontSize: 13, color: '#c9c9d8', marginTop: 4 }}>{payload.businessName || 'Business Listing'}</div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 20px 60px' }}>
        <div style={{ background: '#fff', border: '1px solid #ece8dc', borderRadius: 12, padding: 28 }}>
          <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 22, color: '#0b1f3a', margin: '0 0 6px' }}>{payload.schema.title}</h1>
          {payload.schema.intro && <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px' }}>{payload.schema.intro}</p>}

          {done ? (
            <div style={{ background: '#e8f7ee', color: '#16a34a', padding: '16px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>
              ✓ {payload.status === 'signed' && payload.signerName ? `Signed by ${payload.signerName}. Thank you.` : 'Submitted — thank you. EZ Business Advisors LLC has been notified.'}
            </div>
          ) : (
            <form onSubmit={submit}>
              <DynamicFormFields sections={payload.schema.sections} values={values} onChange={set} />

              {payload.schema.requiresSignature && (
                <div style={{ marginTop: 26, paddingTop: 20, borderTop: '1px solid #ece8dc' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0b1f3a', marginBottom: 12 }}>Signature</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label className="label">Full Name (typed signature) *</label>
                      <input className="input" value={signerName} onChange={(e) => setSignerName(e.target.value)} required />
                    </div>
                    <div>
                      <label className="label">Title / Capacity</label>
                      <input className="input" value={signerTitle} onChange={(e) => setSignerTitle(e.target.value)} placeholder="e.g. Owner, Member, President" />
                    </div>
                  </div>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: '#666', lineHeight: 1.4 }}>
                    <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 2 }} />
                    By typing my name above, I agree this constitutes my electronic signature, valid under the Pennsylvania Electronic Transactions Act (73 P.S. § 2260.101 et seq.) and the federal E-SIGN Act (15 U.S.C. § 7001 et seq.), and that the information provided is true and correct to the best of my knowledge.
                  </label>
                </div>
              )}

              {error && <div style={{ marginTop: 14, background: '#fee2e2', color: '#b91c1c', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>{error}</div>}

              <button type="submit" className="btn btn-primary" disabled={submitting} style={{ marginTop: 18, width: '100%' }}>
                {submitting ? 'Submitting…' : payload.schema.requiresSignature ? 'Sign & Submit' : 'Submit'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
