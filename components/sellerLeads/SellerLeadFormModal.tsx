'use client'

import { useState } from 'react'
import { SellerLead, SellerLeadInput, LEAD_STATUSES } from '@/lib/sellerLeads'

interface SellerLeadFormModalProps {
  lead: SellerLead | null   // null = create mode, else edit
  onClose: () => void
  onSubmit: (input: SellerLeadInput) => Promise<void>
}

export default function SellerLeadFormModal({ lead, onClose, onSubmit }: SellerLeadFormModalProps) {
  const [form, setForm] = useState<SellerLeadInput>({
    business_name: lead?.business_name || '',
    email: lead?.email || '',
    phone: lead?.phone || '',
    status: (lead?.status as SellerLeadInput['status']) || 'new',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const set = <K extends keyof SellerLeadInput>(key: K, value: SellerLeadInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.business_name.trim()) {
      setError('Business name is required')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await onSubmit(form)
    } catch (err: any) {
      setError(err.message || 'Failed to save seller lead')
      setSubmitting(false)
    }
  }

  const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#334155' }
  const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: '16px', maxWidth: '500px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', padding: '24px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>
            {lead ? 'Edit Seller Lead' : 'Add Seller Lead'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Business Name *</label>
            <input
              style={inputStyle}
              value={form.business_name}
              onChange={(e) => set('business_name', e.target.value)}
              placeholder="e.g. Acme Cleaning Services"
              required
            />
          </div>

          <div className="grid-2" style={{ gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="seller@example.com" />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input style={inputStyle} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(555) 123-4567" />
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Status</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {LEAD_STATUSES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => set('status', s.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '999px',
                    border: form.status === s.id ? `2px solid ${s.color}` : '1px solid #e2e8f0',
                    background: form.status === s.id ? s.color + '1a' : '#fff',
                    color: form.status === s.id ? s.color : '#64748b',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 18px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', color: '#475569' }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{ padding: '10px 18px', background: submitting ? '#94a3b8' : '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 600 }}
            >
              {submitting ? 'Saving...' : lead ? 'Save Changes' : 'Add Seller Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
