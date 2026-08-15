'use client'

import { useState } from 'react'
import { Listing } from '@/lib/listings'
import ListingPhotoUpload from './ListingPhotoUpload'
import ListingFields, { ListingFormState, buildInitialFormState, buildListingPayload, validateListingForm } from './ListingFields'

interface ListingFormModalProps {
  listing: Listing | null
  onClose: () => void
  onSubmit: (input: Partial<Listing>) => Promise<void>
}

export default function ListingFormModal({ listing, onClose, onSubmit }: ListingFormModalProps) {
  const [form, setForm] = useState<ListingFormState>(buildInitialFormState(listing))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [imageUrls, setImageUrls] = useState<string[]>(listing?.image_urls || [])
  const [primaryImageUrl, setPrimaryImageUrl] = useState<string | null>(listing?.primary_image_url || null)

  const set = <K extends keyof ListingFormState>(k: K, v: ListingFormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validateListingForm(form)
    if (validationError) { setError(validationError); return }
    setSubmitting(true)
    setError('')
    try {
      await onSubmit(buildListingPayload(form))
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

          <ListingFields form={form} set={set} />

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
