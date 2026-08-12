'use client'

import { useState } from 'react'
import { Listing, LISTING_STATUSES } from '@/lib/listings'
import ListingPhotoUpload from './ListingPhotoUpload'

interface ListingFormModalProps {
  listing: Listing | null
  onClose: () => void
  onSubmit: (input: Partial<Listing>) => Promise<void>
}

interface FormState {
  business_name: string
  headline: string
  industry: string
  business_type: string
  sub_industry: string
  location_general: string
  description: string
  asking_price: string
  annual_revenue: string
  sde: string
  ebitda: string
  reason_for_sale: string
  status: string
  num_employees: string
  num_owners: string
  business_square_footage: string
  year_established: string
  hours_of_operation: string
  furniture_and_equipment_included: boolean
  inventory_included: boolean
  growth_potential: string
  competition: string
  market_position: string
  real_estate_included: boolean
  lease_years_remaining: string
  monthly_rent: string
  property_value: string
  property_description: string
  property_type: string
  real_estate_asking_price: string
  square_footage: string
  land_acres: string
  year_built: string
  property_address: string
  property_city: string
  property_state: string
  property_zip: string
}

const PROPERTY_TYPES = ['', 'Industrial', 'Retail', 'Office', 'Mixed Use', 'Land', 'Other']

const numOrNull = (s: string): number | null => (s === '' ? null : Number(s))

export default function ListingFormModal({ listing, onClose, onSubmit }: ListingFormModalProps) {
  const [form, setForm] = useState<FormState>({
    business_name: listing?.business_name || '',
    headline: listing?.headline || '',
    industry: listing?.industry || '',
    business_type: listing?.business_type || '',
    sub_industry: listing?.sub_industry || '',
    location_general: listing?.location_general || '',
    description: listing?.description || '',
    asking_price: listing?.asking_price ? String(listing.asking_price) : '',
    annual_revenue: listing?.annual_revenue ? String(listing.annual_revenue) : '',
    sde: listing?.sde ? String(listing.sde) : '',
    ebitda: listing?.ebitda ? String(listing.ebitda) : '',
    reason_for_sale: listing?.reason_for_sale || '',
    status: listing?.status || 'active',
    num_employees: listing?.num_employees != null ? String(listing.num_employees) : '',
    num_owners: listing?.num_owners != null ? String(listing.num_owners) : '',
    business_square_footage: listing?.business_square_footage != null ? String(listing.business_square_footage) : '',
    year_established: listing?.year_established != null ? String(listing.year_established) : '',
    hours_of_operation: listing?.hours_of_operation || '',
    furniture_and_equipment_included: listing?.furniture_and_equipment_included || false,
    inventory_included: listing?.inventory_included || false,
    growth_potential: listing?.growth_potential || '',
    competition: listing?.competition || '',
    market_position: listing?.market_position || '',
    real_estate_included: listing?.real_estate_included || false,
    lease_years_remaining: listing?.lease_years_remaining != null ? String(listing.lease_years_remaining) : '',
    monthly_rent: listing?.monthly_rent != null ? String(listing.monthly_rent) : '',
    property_value: listing?.property_value ? String(listing.property_value) : '',
    property_description: listing?.property_description || '',
    property_type: listing?.property_type || '',
    real_estate_asking_price: listing?.real_estate_asking_price ? String(listing.real_estate_asking_price) : '',
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
  const [imageUrls, setImageUrls] = useState<string[]>(listing?.image_urls || [])
  const [primaryImageUrl, setPrimaryImageUrl] = useState<string | null>(listing?.primary_image_url || null)

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.business_name.trim()) { setError('Business name is required'); return }
    setSubmitting(true)
    setError('')
    try {
      // headline is a required (not-null) column live — auto-derive a sensible
      // default from industry + location if the broker leaves it blank, rather
      // than force a required field the form never marked as required.
      const fallbackHeadline = [form.industry, form.location_general].filter(Boolean).join(' — ') || form.business_name
      await onSubmit({
        business_name: form.business_name,
        headline: form.headline.trim() || fallbackHeadline,
        industry: form.industry || null,
        business_type: form.business_type || null,
        sub_industry: form.sub_industry || null,
        location_general: form.location_general || null,
        description: form.description || null,
        asking_price: numOrNull(form.asking_price),
        annual_revenue: numOrNull(form.annual_revenue),
        sde: numOrNull(form.sde),
        ebitda: numOrNull(form.ebitda),
        reason_for_sale: form.reason_for_sale || null,
        status: form.status,
        num_employees: numOrNull(form.num_employees),
        num_owners: numOrNull(form.num_owners),
        business_square_footage: numOrNull(form.business_square_footage),
        year_established: form.year_established ? Number(form.year_established) : null,
        hours_of_operation: form.hours_of_operation.trim() || null,
        furniture_and_equipment_included: form.furniture_and_equipment_included,
        inventory_included: form.inventory_included,
        growth_potential: form.growth_potential.trim() || null,
        competition: form.competition.trim() || null,
        market_position: form.market_position.trim() || null,
        real_estate_included: form.real_estate_included,
        lease_years_remaining: !form.real_estate_included ? numOrNull(form.lease_years_remaining) : null,
        monthly_rent: !form.real_estate_included ? numOrNull(form.monthly_rent) : null,
        property_value: form.real_estate_included ? numOrNull(form.property_value) : null,
        property_description: form.real_estate_included ? form.property_description.trim() || null : null,
        property_type: form.real_estate_included ? form.property_type || null : null,
        real_estate_asking_price: form.real_estate_included ? numOrNull(form.real_estate_asking_price) : null,
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
          {listing ? (
            <ListingPhotoUpload
              listingId={listing.id}
              imageUrls={imageUrls}
              primaryImageUrl={primaryImageUrl}
              onChange={(next) => { setImageUrls(next.image_urls); setPrimaryImageUrl(next.primary_image_url) }}
            />
          ) : (
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14, padding: '10px 12px', background: 'var(--cream)', borderRadius: 8 }}>
              📷 Save the listing first, then reopen it to add photos.
            </div>
          )}

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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label className="label">Business Type (broad category)</label>
              <input className="input" value={form.business_type} onChange={(e) => set('business_type', e.target.value)} placeholder="e.g. Retail, Restaurants & Food" />
            </div>
            <div>
              <label className="label">Sub-Industry</label>
              <input className="input" value={form.sub_industry} onChange={(e) => set('sub_industry', e.target.value)} placeholder="Finer-grained classification" />
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

          <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--gold-dark)', fontWeight: 700, marginBottom: 12 }}>Business Operations</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label className="label">Employees</label>
                <input className="input" type="number" min="0" value={form.num_employees} onChange={(e) => set('num_employees', e.target.value)} placeholder="Not incl. owners" />
              </div>
              <div>
                <label className="label">Owners Working in Business</label>
                <input className="input" type="number" min="0" value={form.num_owners} onChange={(e) => set('num_owners', e.target.value)} />
              </div>
              <div>
                <label className="label">Business Square Footage</label>
                <input className="input" type="number" min="0" value={form.business_square_footage} onChange={(e) => set('business_square_footage', e.target.value)} placeholder="Leased or owned" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label className="label">Year Established</label>
                <input className="input" type="number" value={form.year_established} onChange={(e) => set('year_established', e.target.value)} placeholder="e.g. 1998" />
              </div>
              <div>
                <label className="label">Hours of Operation</label>
                <input className="input" value={form.hours_of_operation} onChange={(e) => set('hours_of_operation', e.target.value)} placeholder="e.g. Mon-Fri 9am-5pm" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text)' }}>
                <input type="checkbox" checked={form.furniture_and_equipment_included} onChange={(e) => set('furniture_and_equipment_included', e.target.checked)} />
                Furniture & Equipment Included
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text)' }}>
                <input type="checkbox" checked={form.inventory_included} onChange={(e) => set('inventory_included', e.target.checked)} />
                Inventory Included
              </label>
            </div>
          </div>

          <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--gold-dark)', fontWeight: 700, marginBottom: 12 }}>Marketing Detail</div>
            <div style={{ marginBottom: 12 }}>
              <label className="label">Growth & Expansion Potential</label>
              <textarea className="textarea" rows={2} value={form.growth_potential} onChange={(e) => set('growth_potential', e.target.value)} placeholder="Opportunities for a new owner to grow the business" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="label">Competition</label>
              <textarea className="textarea" rows={2} value={form.competition} onChange={(e) => set('competition', e.target.value)} placeholder="Competitive landscape" />
            </div>
            <div>
              <label className="label">Market Position</label>
              <textarea className="textarea" rows={2} value={form.market_position} onChange={(e) => set('market_position', e.target.value)} placeholder="Positioning relative to competitors" />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: form.real_estate_included ? 20 : 12 }}>
            <input type="checkbox" checked={form.real_estate_included} onChange={(e) => set('real_estate_included', e.target.checked)} />
            <label style={{ fontSize: 14, color: 'var(--text)' }}>Real estate is owned and included in the sale</label>
          </div>

          {!form.real_estate_included && (
            <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 16, marginBottom: 20, background: 'var(--cream)' }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--gold-dark)', fontWeight: 700, marginBottom: 12 }}>Lease Terms</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label">Years Remaining on Lease</label>
                  <input className="input" type="number" step="0.5" min="0" value={form.lease_years_remaining} onChange={(e) => set('lease_years_remaining', e.target.value)} />
                </div>
                <div>
                  <label className="label">Monthly Rent</label>
                  <input className="input" type="number" min="0" value={form.monthly_rent} onChange={(e) => set('monthly_rent', e.target.value)} placeholder="$" />
                </div>
              </div>
            </div>
          )}

          {form.real_estate_included && (
            <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 16, marginBottom: 20, background: 'var(--cream)' }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--gold-dark)', fontWeight: 700, marginBottom: 12 }}>Property Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label className="label">Property Type</label>
                  <select className="select" value={form.property_type} onChange={(e) => set('property_type', e.target.value)}>
                    {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t || 'Select...'}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Real Estate Asking Price</label>
                  <input className="input" type="number" value={form.real_estate_asking_price} onChange={(e) => set('real_estate_asking_price', e.target.value)} placeholder="If priced separately" />
                </div>
              </div>
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
