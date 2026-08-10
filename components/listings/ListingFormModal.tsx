'use client'

import { useState } from 'react'
import { Listing, LISTING_STATUSES } from '@/lib/listings'

interface ListingFormModalProps {
  listing: Listing | null
  onClose: () => void
  onSubmit: (input: Partial<Listing>) => Promise<void>
}

interface FormState {
  business_name: string
  headline: string
  industry: string
  location_general: string
  description: string
  asking_price: string
  annual_revenue: string
  sde: string
  ebitda: string
  reason_for_sale: string
  status: string
  real_estate_included: boolean
  property_value: string
  property_description: string
  square_footage: string
  land_acres: string
  year_built: string
  property_address: string
  property_city: string
  property_state: string
  property_zip: string
}

const numOrNull = (s: string): number | null => (s === '' ? null : Number(s))

export default function ListingFormModal({ listing, onClose, onSubmit }: ListingFormModalProps) {
  const [form, setForm] = useState<FormState>({
    business_name: listing?.business_name || '',
    headline: listing?.headline || '',
    industry: listing?.industry || '',
    location_general: listing?.location_general || '',
    description: listing?.description || '',
    asking_price: listing?.asking_price ? String(listing.asking_price) : '',
    annual_revenue: listing?.annual_revenue ? String(listing.annual_revenue) : '',
    sde: listing?.sde ? String(listing.sde) : '',
    ebitda: listing?.ebitda ? String(listing.ebitda) : '',
    reason_for_sale: listing?.reason_for_sale || '',
    status: listing?.status || 'active',
    real_estate_included: listing?.real_estate_included || false,
    property_value: listing?.property_value ? String(listing.property_value) : '',
    property_description: listing?.property_description || '',
    square_footage: listing?.square_footage ? String(listing.square_footage) : '',
    land_acres: listing?.land_acres ? String(listing.land_acres) : '',
    year_built: listing?.year_built ? String(listing.year_built) : '',
    property_address: listing?.property_address || '',
    property_city: listing?.property_city || '',
    property_state: listing?.property_state || '',
    property_zip: listing?.property_zip || '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.business_name.trim()) { setError('Business name is required'); return }
    setSubmitting(true)
    setError('')
    try {
      await onSubmit({
        business_name: form.business_name,
        headline: form.headline || null,
        industry: form.industry || null,
        location_general: form.location_general || null,
        description: form.description || null,
        asking_price: numOrNull(form.asking_price),
        annual_revenue: numOrNull(form.annual_revenue),
        sde: numOrNull(form.sde),
        ebitda: numOrNull(form.ebitda),
        reason_for_sale: form.reason_for_sale || null,
        status: form.status,
        real_estate_included: form.real_estate_included,
        property_value: form.real_estate_included ? numOrNull(form.property_value) : null,
        property_description: form.real_estate_included ? form.property_description.trim() || null : null,
        square_footage: form.real_estate_included ? numOrNull(form.square_footage) : null,
        land_acres: form.real_estate_included ? numOrNull(form.land_acres) : null,
        year_built: form.real_estate_included && form.year_built ? Number(form.year_built) : null,
        property_address: form.real_estate_included ? form.property_address.trim() || null : null,
        property_city: form.real_estate_included ? form.property_city.trim() || null : null,
        property_state: form.real_estate_included ? form.property_state.trim().toUpperCase() || null : null,
        property_zip: form.real_estate_included ? form.property_zip.trim() || null : null,
      })
    } catch (err: any) {
      setError(err.message || 'Failed to save listing')
      setSubmitting(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.55)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '30px 16px', overflowY: 'auto' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, maxWidth: 640, width: '100%', padding: 26, maxHeight: '92vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: 'var(--navy)' }}>{listing ? 'Edit Listing' : 'New Listing'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
        </div>

        {error && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label className="label">Business Name *</label>
              <input className="input" value={form.business_name} onChange={(e) => set('business_name', e.target.value)} />
            </div>
            <div>
              <label className="label">Industry</label>
              <input className="input" value={form.industry} onChange={(e) => set('industry', e.target.value)} placeholder="e.g. Business Services" />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label className="label">Headline</label>
            <input className="input" value={form.headline} onChange={(e) => set('headline', e.target.value)} placeholder="Short confidential headline" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label className="label">Location</label>
              <input className="input" value={form.location_general} onChange={(e) => set('location_general', e.target.value)} placeholder="e.g. Charlotte, NC" />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="select" value={form.status} onChange={(e) => set('status', e.target.value)}>
                {LISTING_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label className="label">Description</label>
            <textarea className="textarea" rows={4} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Business overview for the CIM executive summary..." />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label className="label">Asking Price</label>
              <input className="input" type="number" value={form.asking_price} onChange={(e) => set('asking_price', e.target.value)} />
            </div>
            <div>
              <label className="label">Revenue</label>
              <input className="input" type="number" value={form.annual_revenue} onChange={(e) => set('annual_revenue', e.target.value)} />
            </div>
            <div>
              <label className="label">SDE</label>
              <input className="input" type="number" value={form.sde} onChange={(e) => set('sde', e.target.value)} />
            </div>
            <div>
              <label className="label">EBITDA</label>
              <input className="input" type="number" value={form.ebitda} onChange={(e) => set('ebitda', e.target.value)} />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label className="label">Reason for Sale</label>
            <input className="input" value={form.reason_for_sale} onChange={(e) => set('reason_for_sale', e.target.value)} placeholder="e.g. Owner retirement" />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <input type="checkbox" checked={form.real_estate_included} onChange={(e) => set('real_estate_included', e.target.checked)} />
            <label style={{ fontSize: 14, color: 'var(--text)' }}>Real estate included in sale</label>
          </div>

          {form.real_estate_included && (
            <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 16, marginBottom: 20, background: 'var(--cream)' }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--gold-dark)', fontWeight: 700, marginBottom: 12 }}>Property Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label className="label">Property Value</label>
                  <input className="input" type="number" value={form.property_value} onChange={(e) => set('property_value', e.target.value)} />
                </div>
                <div>
                  <label className="label">Square Footage</label>
                  <input className="input" type="number" value={form.square_footage} onChange={(e) => set('square_footage', e.target.value)} />
                </div>
                <div>
                  <label className="label">Land (acres)</label>
                  <input className="input" type="number" step="0.01" value={form.land_acres} onChange={(e) => set('land_acres', e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label className="label">Year Built</label>
                  <input className="input" type="number" value={form.year_built} onChange={(e) => set('year_built', e.target.value)} />
                </div>
                <div>
                  <label className="label">Address</label>
                  <input className="input" value={form.property_address} onChange={(e) => set('property_address', e.target.value)} placeholder="Street address" />
                </div>
                <div>
                  <label className="label">City</label>
                  <input className="input" value={form.property_city} onChange={(e) => set('property_city', e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label className="label">State</label>
                  <input className="input" value={form.property_state} onChange={(e) => set('property_state', e.target.value)} maxLength={2} placeholder="NC" />
                </div>
                <div>
                  <label className="label">ZIP</label>
                  <input className="input" value={form.property_zip} onChange={(e) => set('property_zip', e.target.value)} maxLength={10} />
                </div>
                <div>
                  <label className="label">Property Description</label>
                  <input className="input" value={form.property_description} onChange={(e) => set('property_description', e.target.value)} placeholder="e.g. 12,000 sq ft warehouse on 2 acres" />
                </div>
              </div>
              <div style={{ padding: 10, borderRadius: 8, background: 'var(--navy)', color: '#fff', fontSize: 14 }}>
                <strong>Auto Total Value:</strong>{' '}
                {(numOrNull(form.asking_price) || 0) + (numOrNull(form.property_value) || 0) > 0
                  ? `$${((numOrNull(form.asking_price) || 0) + (numOrNull(form.property_value) || 0)).toLocaleString()}`
                  : '$0 — enter a price or property value'
                }
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : listing ? 'Save Changes' : 'Create Listing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
