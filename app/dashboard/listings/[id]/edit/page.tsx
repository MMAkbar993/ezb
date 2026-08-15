'use client'

// ---------------------------------------------------------------------------
// /dashboard/listings/[id]/edit — Edit a listing's core details.
// Uses the same shared field set as the Listings page's quick add/edit modal
// and the New Listing page (components/listings/ListingFields.tsx) — this
// used to be its own thin, separate form (missing most fields, including a
// "real estate included" checkbox that revealed no property fields at all).
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { fetchListing, updateListing } from '@/lib/listings'
import ListingFields, { ListingFormState, buildInitialFormState, buildListingPayload, validateListingForm } from '@/components/listings/ListingFields'

export default function EditListingPage() {
  return (
    <AppShell active="Listings">
      <ToastProvider>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <EditForm />
        </div>
      </ToastProvider>
    </AppShell>
  )
}

function EditForm() {
  const params = useParams()
  const router = useRouter()
  const toast = useToast()
  const listingId = String(params.id || '')
  const [form, setForm] = useState<ListingFormState | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetchListing(listingId).then((l) => {
      if (l) setForm(buildInitialFormState(l))
    })
  }, [listingId])

  if (!form) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>

  const set = <K extends keyof ListingFormState>(k: K, v: ListingFormState[K]) => setForm((f) => (f ? { ...f, [k]: v } : f))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validateListingForm(form)
    if (validationError) { toast(validationError, 'error'); return }
    setBusy(true)
    try {
      await updateListing(listingId, buildListingPayload(form))
      toast('Listing saved')
      router.push(`/dashboard/listings/${listingId}/workflow`)
    } catch (err: any) { toast(err.message || 'Save failed', 'error'); setBusy(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <button onClick={() => router.push(`/dashboard/listings/${listingId}/workflow`)} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: 'var(--navy)' }}>←</button>
        <h1 style={{ margin: 0, fontSize: 24, fontFamily: 'Georgia, serif', color: 'var(--navy)' }}>Edit Listing</h1>
      </div>
      <p style={{ color: 'var(--muted)', marginBottom: 20 }}>Update the listing's details. Financial recasting lives in the workflow.</p>

      <form onSubmit={save}>
        <div style={{ padding: '24px 28px', background: '#fff', border: '1px solid var(--line)', borderRadius: 14 }}>
          <ListingFields form={form} set={set} />
        </div>

        <button type="submit" disabled={busy} style={{ marginTop: 20, padding: '13px 26px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  )
}
