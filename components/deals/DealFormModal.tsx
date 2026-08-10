'use client'

import { useState } from 'react'
import { PIPELINE_STAGES, PipelineItem } from '@/lib/pipeline'
import { Listing } from '@/lib/listings'

interface DealFormModalProps {
  deal: PipelineItem | null          // null = create
  listings: Listing[]
  onClose: () => void
  onSubmit: (input: { listing_id?: string; purchase_price?: number | null; status?: string }) => Promise<void>
}

export default function DealFormModal({ deal, listings, onClose, onSubmit }: DealFormModalProps) {
  const [listingId, setListingId] = useState(deal?.listing_id || listings[0]?.id || '')
  const [price, setPrice] = useState(deal?.purchase_price ? String(deal.purchase_price) : '')
  const [status, setStatus] = useState(deal?.stage || 'letter_of_intent')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!listingId) { setError('Please select a listing'); return }
    setSubmitting(true)
    setError('')
    try {
      await onSubmit({
        listing_id: listingId,
        purchase_price: price ? Number(price) : null,
        status,
      })
    } catch (err: any) {
      setError(err.message || 'Failed to save deal')
      setSubmitting(false)
    }
  }

  const modalStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.55)', zIndex: 1000,
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto',
  }
  const boxStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 12, maxWidth: 520, width: '100%',
    boxShadow: '0 20px 60px rgba(26,26,46,0.35)', padding: 26,
  }

  return (
    <div style={modalStyle} onClick={onClose}>
      <div style={boxStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: 'var(--navy)' }}>
            {deal ? 'Edit Deal' : 'New Deal'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label className="label">Linked Listing *</label>
            <select className="select" value={listingId} onChange={(e) => setListingId(e.target.value)}>
              <option value="">— Select a listing —</option>
              {listings.map((l) => (
                <option key={l.id} value={l.id}>{l.business_name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="label">Purchase Price ($)</label>
            <input
              className="input"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 1500000"
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label className="label">Stage</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PIPELINE_STAGES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStatus(s.id)}
                  style={{
                    padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: 13, fontWeight: 600,
                    border: status === s.id ? '2px solid var(--gold-dark)' : '1px solid var(--line)',
                    background: status === s.id ? 'rgba(201,168,76,0.15)' : '#fff',
                    color: status === s.id ? 'var(--gold-dark)' : 'var(--muted)',
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
              {submitting ? 'Saving...' : deal ? 'Save Changes' : 'Create Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
