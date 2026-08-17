'use client'

// ---------------------------------------------------------------------------
// /dashboard/listings/[id]/workflow — Guided Listing Workflow view.
// Shows the 10-step tracker + the active step's editor. Navigating steps is
// allowed for completed/current steps.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import WorkflowDashboard from '@/components/listings/WorkflowDashboard'
import Step1LegalDocs from '@/components/listings/Step1LegalDocs'
import Step2FinancialDetails from '@/components/listings/Step2FinancialDetails'
import Step7SBAQualification from '@/components/listings/Step7SBAQualification'
import Step8ListBusiness from '@/components/listings/Step8ListBusiness'
import Step9BuyerManagement from '@/components/listings/Step9BuyerManagement'
import Step10DealClosing from '@/components/listings/Step10DealClosing'
import StatusBadge from '@/components/listings/StatusBadge'
import SBABadge from '@/components/listings/SBABadge'
import { getWorkflow, startWorkflow, completeStep } from '@/lib/workflow'
import { fetchListing, fmtMoney } from '@/lib/listings'

export default function WorkflowPage() {
  return (
    <AppShell active="Listings">
      <ToastProvider>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <WorkflowBody />
        </div>
      </ToastProvider>
    </AppShell>
  )
}

function WorkflowBody() {
  const params = useParams()
  const router = useRouter()
  const listingId = String(params.id || '')
  const toast = useToast()

  const [listing, setListing] = useState<any>(null)
  const [workflow, setWorkflow] = useState<any>(null)
  const [activeStep, setActiveStep] = useState(1)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const l = await fetchListing(listingId)
    const w = (await getWorkflow(listingId)) || (await startWorkflow(listingId))
    setListing(l); setWorkflow(w); setActiveStep(w?.current_step || 1); setLoading(false)
  }, [listingId])

  useEffect(() => { load() }, [load])

  // Steps 3-6 (Recast, Generate BOV, Generate CIM, Generate BLI) are retired
  // from the guided workflow — brokers were having to re-upload the same
  // financial documents at each of these steps individually. Recast/BOV/CIM/
  // BLI all now live in one place, the Financial tab (/dashboard/financial),
  // which already uploads once and generates all four documents together via
  // the same underlying pipeline these steps used to call one at a time.
  // Rather than renumbering steps 7-10 (which would corrupt
  // current_step/completed_steps for listings already mid-workflow in
  // production), steps 3-6 auto-complete themselves in sequence and advance
  // straight to step 7 without ever rendering.
  useEffect(() => {
    if (activeStep >= 3 && activeStep <= 6 && !loading) {
      completeStep(listingId, activeStep).then(() => {
        setActiveStep(activeStep + 1)
        getWorkflow(listingId).then(setWorkflow)
      })
    }
  }, [activeStep, loading, listingId])

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>Loading workflow…</div>
  if (!listing) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>Listing not found.</div>

  const refresh = async () => {
    const w = await getWorkflow(listingId)
    setWorkflow(w)
    const l = await fetchListing(listingId)
    setListing(l)
  }

  const goNext = () => {
    const next = Math.min(10, activeStep + 1)
    setActiveStep(next)
    refresh()
  }
  const goStep = (s: number) => setActiveStep(s)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={() => router.push('/listings')} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: 'var(--navy)' }}>←</button>
            <h1 style={{ margin: 0, fontSize: 24, fontFamily: 'Georgia, serif', color: 'var(--navy)' }}>{listing?.business_name}</h1>
            <StatusBadge status={listing?.status} />
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--muted)' }}>
            {listing?.industry} · {listing?.location_general} · {listing?.asking_price ? fmtMoney(listing.asking_price) : 'price TBD'}
          </p>
        </div>
        <button onClick={() => router.push(`/dashboard/listings/${listingId}/edit`)} style={{ padding: '9px 16px', background: 'transparent', color: 'var(--navy)', border: '1px solid var(--gold)', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
          Edit details
        </button>
      </div>

      {/* Workflow tracker */}
      <div style={{ marginBottom: 18 }}>
        <WorkflowDashboard currentStep={workflow?.current_step || activeStep} completedSteps={workflow?.completed_steps} onNavigate={goStep} listingId={listingId} />
      </div>

      {/* Active step component */}
      {activeStep === 1 && <Step1LegalDocs listingId={listingId} onNext={goNext} />}
      {activeStep === 2 && <Step2FinancialDetails listingId={listingId} onNext={goNext} />}
      {activeStep >= 3 && activeStep <= 6 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Advancing…</div>}
      {activeStep === 7 && <Step7SBAQualification listingId={listingId} onNext={goNext} />}
      {activeStep === 8 && <Step8ListBusiness listingId={listingId} onNext={goNext} />}
      {activeStep === 9 && <Step9BuyerManagement listingId={listingId} onNext={goNext} onAgreementChange={refresh} />}
      {activeStep === 10 && <Step10DealClosing listingId={listingId} onNext={goNext} />}
    </div>
  )
}
