'use client'

// ---------------------------------------------------------------------------
// /dashboard/listings/new — Create a new listing and begin the guided workflow.
// Creates the listing (draft) + a listing_workflows row, then forwards to the
// 10-step workflow.
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

const numOrNull = (s: string): number | null => (s === '' ? null : Number(s))

export default function NewListingPage() {
  return (
    <AppShell active="Listings">
      <ToastProvider>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <NewListingForm />
        </div>
      </ToastProvider>
    </AppShell>
  )
}

function NewListingForm() {
  const router = useRouter()
  const toast = useToast()
  const [form, setForm] = useState({
    business_name: '', headline: '', industry: '', location_general: '', description: '',
    asking_price: '', annual_revenue: '', sde: '', ebitda: '', reason_for_sale: '',
  })
  const [busy, setBusy] = useState(false)
  const [matched, setMatched] = useState<UnifiedLead[] | null>(null)
  const [justCreated, setJustCreated] = useState<Listing | null>(null)
  const [stage, setStage] = useState<'form' | 'financials'>('form')

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.business_name.trim()) { toast('Business name is required', 'error'); return }
    if (!form.asking_price.trim() && !form.sde.trim() && !form.ebitda.trim()) {
      toast('Enter at least one of Asking Price, SDE, or EBITDA', 'error')
      return
    }
    setBusy(true)
    try {
      const listing = await createListing({
        business_name: form.business_name.trim(),
        headline: form.headline || null,
        industry: form.industry || null,
        location_general: form.location_general || null,
        description: form.description || null,
        asking_price: numOrNull(form.asking_price),
        annual_revenue: numOrNull(form.annual_revenue),
        sde: numOrNull(form.sde),
        ebitda: numOrNull(form.ebitda),
        reason_for_sale: form.reason_for_sale || null,
        status: 'draft',
      })
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
      router.push('/dashboard/listings')
    }
  }

  const continueToWorkflow = async () => {
    if (!justCreated) return
    setBusy(true)
    try { await startWorkflow(justCreated.id) } catch {}
    toast('Listing created — starting workflow')
    router.push(`/dashboard/listings/${justCreated.id}/workflow`)
  }

  const input = (k: keyof typeof form, placeholder: string, label: string, multiline = false) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 14 }}>
      {label}
      {multiline ? (
        <textarea value={form[k]} onChange={(e) => set(k, e.target.value)} placeholder={placeholder} rows={3} style={fieldStyle} />
      ) : (
        <input value={form[k]} onChange={(e) => set(k, e.target.value)} placeholder={placeholder} style={fieldStyle} />
      )}
    </label>
  )

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

      <div style={{ padding: '28px 32px', background: '#fff', border: '1px solid var(--line)', borderRadius: 14 }}>
        <div className="wf-grid-2" style={{ gap: '0 18px' }}>
          <div style={{ gridColumn: '1 / -1' }}>{input('business_name', 'e.g. Acme Landscaping LLC', 'Business name *')}</div>
          {input('headline', 'Short marketing headline', 'Headline')}
          {input('industry', 'e.g. Landscaping', 'Industry')}
          {input('location_general', 'e.g. Charlotte, NC', 'Location')}
          <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Enter at least one of Asking Price, SDE, or EBITDA.</div>
          <label style={{ marginBottom: 14, position: 'relative' }}>
            <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 }}>Asking price ($)</span>
            <input type="number" value={form.asking_price} onChange={(e) => set('asking_price', e.target.value)} placeholder="0" style={fieldStyle} />
          </label>
          {input('annual_revenue', 'Annual revenue ($)', 'Annual revenue ($)')}
          {input('sde', 'SDE ($)', 'SDE ($)')}
          {input('ebitda', 'EBITDA ($)', 'EBITDA ($)')}
          {input('reason_for_sale', 'Reason for sale', 'Reason for sale')}
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          {input('description', 'Describe the business…', 'Description', true)}
        </div>

        <button onClick={submit} disabled={busy} style={{ width: '100%', padding: '14px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Creating…' : 'Create listing & start workflow →'}
        </button>
      </div>

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

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '11px 12px', borderRadius: 8, border: '1px solid var(--line)',
  fontSize: 14, fontFamily: 'inherit', background: '#fff', color: 'var(--ink)', boxSizing: 'border-box',
}
