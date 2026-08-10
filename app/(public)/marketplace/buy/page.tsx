'use client'

import { useState } from 'react'
import Link from 'next/link'
import { capturePublicLead } from '@/lib/marketplace'
import { ToastProvider, useToast } from '@/components/ui/Toast'

export default function BuyPage() {
  return (
    <ToastProvider>
      <BuyContent />
    </ToastProvider>
  )
}

function BuyContent() {
  const toast = useToast()
  const [form, setForm] = useState({ name: '', email: '', phone: '', budget: '', industries: '', timeline: '', message: '' })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) { toast('Name and email are required', 'error'); return }
    setSubmitting(true)
    const res = await capturePublicLead({
      kind: 'buyer', name: form.name, email: form.email, phone: form.phone || undefined,
      source: 'buy_page', message: `Budget: ${form.budget || 'N/A'} | Industries: ${form.industries || 'N/A'} | Timeline: ${form.timeline || 'N/A'} | ${form.message || ''}`,
    })
    setSubmitting(false)
    if (res.ok) {
      setDone(true)
      toast('Request received — a broker will contact you with matching opportunities.', 'success')
    } else {
      toast(res.error || 'Submission failed', 'error')
    }
  }

  if (done) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '100px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 60, marginBottom: 20 }}>🤝</div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 34, color: '#1a1a2e', margin: '0 0 12px' }}>Thank You</h1>
        <p style={{ color: '#666', fontSize: 16, lineHeight: 1.6, maxWidth: 520, margin: '0 auto' }}>
          A Concord broker will contact you with confidential opportunities matching your criteria.
        </p>
        <Link href="/marketplace/listings" style={{ display: 'inline-block', marginTop: 24, color: '#c9a84c', fontWeight: 700, fontFamily: 'Georgia, serif' }}>Browse listings now →</Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'start' }}>
      <div>
        <div style={{ color: '#c9a84c', fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700 }}>Buy a Business</div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 40, color: '#1a1a2e', margin: '12px 0 16px', lineHeight: 1.15 }}>
          Acquire an Established, <span style={{ color: '#c9a84c' }}>Profitable Business</span>
        </h1>
        <p style={{ color: '#666', fontSize: 16, lineHeight: 1.7, marginBottom: 28 }}>
          Access confidential opportunities vetted by our brokers. Tell us what you're looking for and we'll connect you
          with businesses that match your criteria, budget, and goals.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            ['🔍', 'Vetted Opportunities', 'Every listing is pre-screened by a licensed broker with verified financials.'],
            ['🤫', 'Confidential Access', 'Off-market and exclusive opportunities not available to the general public.'],
            ['👔', 'Dedicated Broker', 'Work one-on-one with an advisor who negotiates on your behalf.'],
            ['📋', 'Full Due Diligence', 'Complete financials, CIM, and broker support through closing.'],
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

      <div style={{ background: '#fff', border: '1px solid #ece8dc', borderRadius: 14, padding: 32, boxShadow: '0 8px 40px rgba(26,26,46,0.1)', position: 'sticky', top: 88 }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#1a1a2e', margin: '0 0 4px' }}>Tell Us What You're Looking For</h2>
        <p style={{ fontSize: 13, color: '#888', margin: '0 0 20px' }}>Confidential. No obligation.</p>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Full Name *"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
          <Field label="Email *"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
          <Field label="Phone"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Target Budget ($)"><input className="input" type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></Field>
          <Field label="Target Industries"><input className="input" value={form.industries} onChange={(e) => setForm({ ...form, industries: e.target.value })} placeholder="e.g. Business services, restaurants, manufacturing" /></Field>
          <Field label="Timeline"><select className="select" value={form.timeline} onChange={(e) => setForm({ ...form, timeline: e.target.value })}>
            <option value="">Select timeline…</option>
            <option value="0-3 months">ASAP — within 3 months</option>
            <option value="3-6 months">3–6 months</option>
            <option value="6-12 months">6–12 months</option>
            <option value="12+ months">Just exploring</option>
          </select></Field>
          <Field label="Anything else?"><textarea className="textarea" rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Acquisition goals, financing, locations…" /></Field>
          <button type="submit" className="btn btn-primary" disabled={submitting} style={{ marginTop: 6 }}>
            {submitting ? 'Sending...' : 'Get Matched with Businesses'}
          </button>
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
