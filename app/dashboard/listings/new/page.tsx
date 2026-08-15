'use client'

// ---------------------------------------------------------------------------
// /dashboard/listings/new — Create a new listing and begin the guided workflow.
// Creates the listing (draft) + a listing_workflows row, then forwards to the
// 10-step workflow. Uses the same shared field set as the Listings page's
// quick add/edit modal (components/listings/ListingFields.tsx) — this used
// to be a completely different, much thinner form, so an agent filling this
// out was missing two-thirds of what the other form asked for.
// ---------------------------------------------------------------------------

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { createListing, type Listing } from '@/lib/listings'
import { startWorkflow } from '@/lib/workflow'
import { matchBuyerLeads, UnifiedLead } from '@/lib/leads2'
import MatchedBuyersModal from '@/components/leads/MatchedBuyersModal'
import MultiFileDropzone from '@/components/financial/MultiFileDropzone'
import ListingFields, { ListingFormState, buildInitialFormState, buildListingPayload, validateListingForm } from '@/components/listings/ListingFields'

export default function NewListingPage() {
  return (
    <AppShell active="Listings">
      <ToastProvider>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <NewListingForm />
        </div>
      </ToastProvider>
    </AppShell>
  )
}

function NewListingForm() {
  const router = useRouter()
  const toast = useToast()
  const [form, setForm] = useState<ListingFormState>(buildInitialFormState(null))
  const [busy, setBusy] = useState(false)
  const [matched, setMatched] = useState<UnifiedLead[] | null>(null)
  const [justCreated, setJustCreated] = useState<Listing | null>(null)
  const [stage, setStage] = useState<'form' | 'financials'>('form')

  const set = <K extends keyof ListingFormState>(k: K, v: ListingFormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validateListingForm(form)
    if (validationError) { toast(validationError, 'error'); return }
    setBusy(true)
    try {
      // A new listing always starts as 'draft' regardless of the (hidden)
      // Status field default — it's published later via the workflow's own
      // Step 8, not chosen up front here.
      const listing = await createListing({ ...buildListingPayload(form), status: 'draft' })
      // Auto-match buyer leads to this listing's industry/business type.
      const matches = await matchBuyerLeads(form.industry || null)
      setJustCreated(listing)
      if (matches.length > 0) {
        setMatched(matches)
        return // hold: show the popup before moving to the financials step
      }
      setBusy(false)
      setStage('financials')
    } catch (err: any) {
      toast(err.message || 'Failed to create listing', 'error')
      setBusy(false)
    }
  }

  const handleMatchesDone = (goToWorkflow: boolean) => {
    setMatched(null)
    setBusy(false)
    if (goToWorkflow) {
      setStage('financials')
    } else {
      toast('Listing created')
      router.push('/listings')
    }
  }

  const continueToWorkflow = async () => {
    if (!justCreated) return
    setBusy(true)
    try { await startWorkflow(justCreated.id) } catch {}
    toast('Listing created — starting workflow')
    router.push(`/dashboard/listings/${justCreated.id}/workflow`)
  }

  if (stage === 'financials' && justCreated) {
    return (
      <div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: 'var(--navy)', marginBottom: 6 }}>Add Financial Documents</h1>
        <p style={{ color: 'var(--muted)', marginBottom: 24 }}>
          Optional — attach whatever you already have for "{justCreated.business_name}" (tax returns, P&amp;L, bank statements). Anything you drop
          here is picked up automatically later when you generate Recast/BOV/CIM/BLI. Don't have documents yet? Skip this and add them anytime from the Financial tab.
        </p>

        <div style={{ padding: '28px 32px', background: '#fff', border: '1px solid var(--line)', borderRadius: 14 }}>
          <MultiFileDropzone
            parentId={justCreated.id}
            dealId={null}
            listingId={justCreated.id}
            onUploaded={() => {}}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
          <button onClick={continueToWorkflow} disabled={busy} className="btn btn-ghost">
            Skip for now
          </button>
          <button onClick={continueToWorkflow} disabled={busy} style={{ padding: '12px 22px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Starting…' : 'Continue to workflow →'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: 'var(--navy)', marginBottom: 6 }}>New Listing</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 24 }}>Create a listing to begin the guided 10-step workflow. You can add financials and documents as you go.</p>

      <form onSubmit={submit}>
        <div style={{ padding: '28px 32px', background: '#fff', border: '1px solid var(--line)', borderRadius: 14 }}>
          <ListingFields form={form} set={set} showStatus={false} />
        </div>

        <button type="submit" disabled={busy} style={{ width: '100%', marginTop: 20, padding: '14px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Creating…' : 'Create listing & start workflow →'}
        </button>
      </form>

      {/* Auto-matched buyer leads popup */}
      {matched && justCreated && (
        <MatchedBuyersModal
          matches={matched}
          listingIndustry={form.industry}
          onDone={handleMatchesDone}
        />
      )}
    </div>
  )
}
