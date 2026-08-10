'use client'

import { useState } from 'react'
import Link from 'next/link'
import { capturePublicLead } from '@/lib/marketplace'
import { ToastProvider, useToast } from '@/components/ui/Toast'

export default function SellPage() {
  return (
    <ToastProvider>
      <SellContent />
    </ToastProvider>
  )
}

function SellContent() {
  const toast = useToast()
  const [form, setForm] = useState({ name: '', email: '', phone: '', businessName: '', annualRevenue: '', askingPrice: '', message: '' })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) { toast('Name and email are required', 'error'); return }
    setSubmitting(true)
    const res = await capturePublicLead({
      kind: 'seller', name: form.name, email: form.email, phone: form.phone || undefined,
      source: 'sell_page', message: `Business: ${form.businessName || 'N/A'} | Revenue: ${form.annualRevenue || 'N/A'} | ${form.message || ''}`,
    })
    setSubmitting(false)
    if (res.ok) {
      setDone(true)
      toast('Valuation request received — a broker will contact you confidentially.', 'success')
    } else {
      toast(res.error || 'Submission failed', 'error')
    }
  }

  if (done) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '100px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 60, marginBottom: 20 }}>🎉</div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 34, color: '#1a1a2e', margin: '0 0 12px' }}>Thank You</h1>
        <p style={{ color: '#666', fontSize: 16, lineHeight: 1.6, maxWidth: 520, margin: '0 auto' }}>
          Your request has been received. A Concord broker will reach out within one business day to arrange a confidential valuation consultation.
        </p>
        <Link href="/" style={{ display: 'inline-block', marginTop: 24, color: '#c9a84c', fontWeight: 700, fontFamily: 'Georgia, serif' }}>← Back to home</Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'start' }}>
      {/* LEFT copy */}
      <div>
        <div style={{ color: '#c9a84c', fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700 }}>Sell Your Business</div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 40, color: '#1a1a2e', margin: '12px 0 16px', lineHeight: 1.15 }}>
          Get a Confidential <span style={{ color: '#c9a84c' }}>Business Valuation</span> — Free
        </h1>
        <p style={{ color: '#666', fontSize: 16, lineHeight: 1.7, marginBottom: 28 }}>
          Discover what your business is truly worth. Our brokers prepare a professional valuation and, when you're ready,
          market your business confidentially to qualified buyers.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            ['📊', 'Professional Valuation', 'A broker-grade opinion of value using SDE/EBITDA multiples and market comparables.'],
            ['🤫', 'Absolute Confidentiality', 'Your business is never publicly exposed without your consent.'],
            ['🤝', 'Qualified Buyers Only', 'We match you with serious, pre-qualified buyers who match your criteria.'],
            ['⚖️', 'Maximize Value', 'We prepare a comprehensive CIM and negotiate on your behalf to maximize proceeds.'],
          ].map(([icon, t, b]) => (
            <div key={t} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: 18, background: '#fff', border: '1px solid #ece8dc', borderRadius: 12 }}>
              <span style={{ fontSize: 26 }}>{icon}</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', fontFamily: 'Georgia, serif' }}>{t}</div>
                <div style={{ fontSize: 13.5, color: '#666', marginTop: 4, lineHeight: 1.5 }}>{b}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT form */}
      <div style={{ background: '#fff', border: '1px solid #ece8dc', borderRadius: 14, padding: 32, boxShadow: '0 8px 40px rgba(26,26,46,0.1)', position: 'sticky', top: 88 }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#1a1a2e', margin: '0 0 4px' }}>Request a Free Valuation</h2>
        <p style={{ fontSize: 13, color: '#888', margin: '0 0 20px' }}>100% confidential. No obligation.</p>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Full Name *"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
          <Field label="Email *"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
          <Field label="Phone"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Business Name"><input className="input" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} /></Field>
            <Field label="Annual Revenue"><input className="input" type="number" value={form.annualRevenue} onChange={(e) => setForm({ ...form, annualRevenue: e.target.value })} /></Field>
          </div>
          <Field label="Thinking of Asking"><input className="input" type="number" value={form.askingPrice} onChange={(e) => setForm({ ...form, askingPrice: e.target.value })} /></Field>
          <Field label="Anything else?"><textarea className="textarea" rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></Field>
          <button type="submit" className="btn btn-primary" disabled={submitting} style={{ marginTop: 6 }}>
            {submitting ? 'Sending...' : 'Request Confidential Valuation'}
          </button>
          <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center' }}>
            By submitting, you agree to our privacy policy. Your information is kept strictly confidential.
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  )
}
