'use client'

import { useState } from 'react'
import { LeadKind, LeadStatus, UnifiedLead, LEAD_STATUSES, BUSINESS_TYPES } from '@/lib/leads2'
import { createBuyerLead, updateBuyerLead } from '@/lib/leads2'

interface BuyerInput {
  desired_business_type?: string; budget_range?: string; funds_available?: number
  financing_method?: string; preferred_location?: string; notes?: string
}

interface LeadFormModalProps {
  lead: UnifiedLead | null
  mode: LeadKind
  onClose: () => void
  onSubmit: (input: { kind: LeadKind; business_name?: string; email?: string; phone?: string; status?: LeadStatus } & BuyerInput) => Promise<void>
}

const FINANCING_OPTIONS = ['Cash', 'SBA Loan', 'Bank Financing', 'Private Investor', 'Seller Financing', 'Combination']
const BUDGET_RANGES = ['Under $250K', '$250K–$500K', '$500K–$1M', '$1M–$2M', '$2M–$5M', '$5M+']

export default function LeadFormModal({ lead, mode: initialMode, onClose, onSubmit }: LeadFormModalProps) {
  const [kind, setKind] = useState<LeadKind>(lead?.kind || initialMode)
  const [businessName, setBusinessName] = useState(lead?.business_name || '')
  const [email, setEmail] = useState(lead?.email || '')
  const [phone, setPhone] = useState(lead?.phone || '')
  const [status, setStatus] = useState<LeadStatus>((lead?.status as LeadStatus) || 'new')

  // Buyer-only fields
  const [desiredType, setDesiredType] = useState(lead?.desired_business_type || '')
  const [customType, setCustomType] = useState('')
  const [budget, setBudget] = useState(lead?.budget_range || '')
  const [funds, setFunds] = useState(lead?.funds_available != null ? String(lead.funds_available) : '')
  const [financing, setFinancing] = useState(lead?.financing_method || '')
  const [location, setLocation] = useState(lead?.preferred_location || '')
  const [notes, setNotes] = useState(lead?.notes || '')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isBuyer = kind === 'buyer'
  const effectiveType = desiredType === 'Other' ? customType : desiredType

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (kind === 'seller' && !businessName.trim()) { setError('Business name is required for seller leads'); return }
    if (isBuyer && !effectiveType.trim()) { setError('Business type is required for buyer leads'); return }
    setSubmitting(true)
    setError('')
    try {
      if (isBuyer && lead) {
        // Route buyer edits to the enriched buyer path so new fields persist.
        await updateBuyerLead(lead.id, {
          email, phone, status,
          desired_business_type: effectiveType.trim() || null,
          budget_range: budget || null,
          funds_available: funds === '' ? null : Number(funds),
          financing_method: financing || null,
          preferred_location: location || null,
          notes: notes || null,
        })
        await onSubmit({
          kind, email, phone, status,
          desired_business_type: effectiveType.trim() || undefined,
          budget_range: budget || undefined,
          funds_available: funds === '' ? undefined : Number(funds),
          financing_method: financing || undefined,
          preferred_location: location || undefined,
          notes: notes || undefined,
        })
        return
      }
      if (isBuyer && !lead) {
        const created = await createBuyerLead({
          email, phone, status,
          desired_business_type: effectiveType.trim() || null,
          budget_range: budget || null,
          funds_available: funds === '' ? null : Number(funds),
          financing_method: financing || null,
          preferred_location: location || null,
          notes: notes || null,
        })
        // Let the parent refresh via its own create path; pass input through.
        await onSubmit({
          kind, email, phone, status,
          ...(created.id ? {} : {}),
          desired_business_type: effectiveType.trim() || undefined,
          budget_range: budget || undefined,
          funds_available: funds === '' ? undefined : Number(funds),
          financing_method: financing || undefined,
          preferred_location: location || undefined,
          notes: notes || undefined,
        })
        return
      }
      await onSubmit({
        kind,
        business_name: kind === 'seller' ? businessName : undefined,
        email, phone, status,
      })
    } catch (err: any) {
      setError(err.message || 'Failed to save lead')
      setSubmitting(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.55)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, maxWidth: 540, width: '100%', boxShadow: '0 20px 60px rgba(26,26,46,0.35)', padding: 26 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: 'var(--navy)' }}>{lead ? 'Edit Lead' : 'Add Lead'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
        </div>

        {error && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Kind */}
          <div style={{ marginBottom: 16 }}>
            <label className="label">Lead Type</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['seller', 'buyer'] as LeadKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  style={{
                    flex: 1, padding: '11px', borderRadius: 8, cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 700,
                    border: kind === k ? '2px solid var(--gold-dark)' : '1px solid var(--line)',
                    background: kind === k ? 'rgba(201,168,76,0.15)' : '#fff',
                    color: kind === k ? 'var(--gold-dark)' : 'var(--muted)',
                  }}
                >
                  {k === 'seller' ? '🏢 Seller' : '👤 Buyer'}
                </button>
              ))}
            </div>
          </div>

          {kind === 'seller' && (
            <div style={{ marginBottom: 16 }}>
              <label className="label">Business Name *</label>
              <input className="input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Acme Services" />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" />
            </div>
          </div>

          {/* ----- Buyer-only: what they want + how they pay ----- */}
          {isBuyer && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label className="label">Type of business they want to purchase *</label>
                <select className="select" value={desiredType} onChange={(e) => setDesiredType(e.target.value)} style={{ width: '100%' }}>
                  <option value="">Select a business type...</option>
                  {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                {desiredType === 'Other' && (
                  <input className="input" value={customType} onChange={(e) => setCustomType(e.target.value)} placeholder="Describe business type" style={{ marginTop: 8 }} />
                )}
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="label">Budget range</label>
                <select className="select" value={budget} onChange={(e) => setBudget(e.target.value)} style={{ width: '100%' }}>
                  <option value="">Select range...</option>
                  {BUDGET_RANGES.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label className="label">Funds available ($)</label>
                  <input className="input" type="number" value={funds} onChange={(e) => setFunds(e.target.value)} placeholder="e.g. 750000" />
                </div>
                <div>
                  <label className="label">Financing method</label>
                  <select className="select" value={financing} onChange={(e) => setFinancing(e.target.value)} style={{ width: '100%' }}>
                    <option value="">Select...</option>
                    {FINANCING_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="label">Preferred location (optional)</label>
                <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Central PA, York, Harrisburg" />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label className="label">Notes</label>
                <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Additional requirements..." />
              </div>
            </>
          )}

          <div style={{ marginBottom: 20 }}>
            <label className="label">Status</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {LEAD_STATUSES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStatus(s.id)}
                  style={{
                    padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: 12.5, fontWeight: 600,
                    border: status === s.id ? `2px solid ${s.color}` : '1px solid var(--line)',
                    background: status === s.id ? s.color + '1a' : '#fff',
                    color: status === s.id ? s.color : 'var(--muted)',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : lead ? 'Save Changes' : 'Add Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
