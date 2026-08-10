'use client'

import { useEffect, useState } from 'react'
import { StepShell, stepField, stepLabel, stepBtn } from '@/components/listings/StepShell'
import { publishListing, completeStep } from '@/lib/workflow'
import { fetchListing } from '@/lib/listings'
import {
  fetchPublicListingSettings, submitForReview, approveListing, revertToDraft,
  publishToWebsite, unpublishFromWebsite, PublicListingSettings, ReviewStage,
} from '@/lib/publicListing'
import StatusBadge from '@/components/listings/StatusBadge'

// ---------------------------------------------------------------------------
// Step 8 — List Business: publish + push to marketplaces (BizBuySell), plus
// the separate public-website review/approval/publish workflow.
// ---------------------------------------------------------------------------

const STAGE_LABEL: Record<ReviewStage, string> = {
  draft: 'Draft',
  internal_review: 'Internal Review',
  approved: 'Approved',
}
const STAGE_ORDER: ReviewStage[] = ['draft', 'internal_review', 'approved']

export default function Step8ListBusiness({ listingId, onNext }: { listingId: string; onNext: () => void }) {
  const [listing, setListing] = useState<any>(null)
  const [pushResult, setPushResult] = useState<string>('')
  const [busy, setBusy] = useState(false)

  const [pub, setPub] = useState<PublicListingSettings | null>(null)
  const [pubBusy, setPubBusy] = useState(false)
  const [pubMsg, setPubMsg] = useState('')
  const [form, setForm] = useState({ isConfidential: false, publicTitle: '', showFinancials: false, showExactLocation: false, isFeatured: false })

  const load = async () => setListing(await fetchListing(listingId))
  const loadPublic = async () => {
    const s = await fetchPublicListingSettings(listingId)
    setPub(s)
    setForm({
      isConfidential: s.isConfidential, publicTitle: s.publicTitle || '',
      showFinancials: s.showFinancials, showExactLocation: s.showExactLocation, isFeatured: s.isFeatured,
    })
  }
  useEffect(() => { load(); loadPublic() }, [listingId])

  const publish = async () => {
    setBusy(true)
    const ok = await publishListing(listingId)
    setPushResult(ok ? 'Listing active + pushed to BizBuySell ✓' : 'Publish failed')
    await load()
    setBusy(false)
  }

  const isActive = listing?.status === 'active'
  const stage = pub?.reviewStage || 'draft'
  const stageIndex = STAGE_ORDER.indexOf(stage)

  const advanceStage = async (fn: (id: string) => Promise<boolean>, label: string) => {
    setPubBusy(true)
    setPubMsg('')
    const ok = await fn(listingId)
    setPubMsg(ok ? `${label} ✓` : `${label} failed`)
    await loadPublic()
    setPubBusy(false)
  }

  const doPublishToWebsite = async () => {
    setPubBusy(true)
    setPubMsg('')
    const res = await publishToWebsite(listingId, {
      isConfidential: form.isConfidential,
      publicTitle: form.publicTitle || null,
      showFinancials: form.showFinancials,
      showExactLocation: form.showExactLocation,
      isFeatured: form.isFeatured,
    })
    setPubMsg(res.ok ? 'Published to public website ✓' : res.error || 'Publish failed')
    await loadPublic()
    setPubBusy(false)
  }

  const doUnpublish = async () => {
    setPubBusy(true)
    setPubMsg('')
    const ok = await unpublishFromWebsite(listingId)
    setPubMsg(ok ? 'Removed from public website' : 'Unpublish failed')
    await loadPublic()
    setPubBusy(false)
  }

  return (
    <StepShell step={8} title="List Business" description="Publish the listing to the marketplace and push it to BizBuySell (and optional social auto-post)."
      status="draft" onNext={async () => { await completeStep(listingId, 8); onNext() }} nextLabel="Step 8 complete →">
      {/* Preview card */}
      <div style={{ padding: '18px 20px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--paper)', marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Georgia, serif', color: 'var(--navy)' }}>{listing?.business_name}</span>
          <StatusBadge status={listing?.status} />
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>{listing?.industry} · {listing?.location_general}</div>
        <div style={{ marginTop: 8, fontSize: 20, fontWeight: 700, color: 'var(--navy)' }}>{listing?.asking_price ? '$' + Math.round(listing.asking_price).toLocaleString() : '—'}</div>
      </div>

      {!isActive ? (
        <button onClick={publish} disabled={busy} style={stepBtn(true)}>{busy ? 'Publishing…' : '🌐 Publish to marketplace + push to BizBuySell'}</button>
      ) : (
        <div style={{ fontSize: 14, color: '#16a34a', fontWeight: 600 }}>✓ Listing is live. It has been pushed to marketplaces.</div>
      )}

      {pushResult && <div style={{ marginTop: 10, fontSize: 13, color: pushResult.includes('failed') ? '#dc2626' : '#16a34a' }}>{pushResult}</div>}

      <div style={{ marginTop: 16, fontSize: 12.5, color: 'var(--muted)' }}>
        Publishing sets the listing status to <strong>Active</strong> and pushes it to BizBuySell. Once a buyer signs a letter of intent, the status will automatically advance to Pending Sale.
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Public website — internal review + publish, separate from BizBuySell */}
      {/* ------------------------------------------------------------------ */}
      <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid var(--line)' }}>
        <h4 style={{ margin: '0 0 4px', fontSize: 16, fontFamily: 'Georgia, serif', color: 'var(--navy)' }}>Public Website</h4>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--muted)' }}>
          Controls whether — and how — this listing appears on the public marketplace. Independent of the BizBuySell push above.
        </p>

        {/* Review stage progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {STAGE_ORDER.map((s, i) => (
            <span key={s} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600,
              color: i <= stageIndex ? 'var(--navy)' : 'var(--muted)',
            }}>
              <span style={{
                width: 20, height: 20, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, background: i <= stageIndex ? 'var(--gold)' : 'var(--line)', color: i <= stageIndex ? 'var(--navy)' : 'var(--muted)',
              }}>{i < stageIndex ? '✓' : i + 1}</span>
              {STAGE_LABEL[s]}
              {i < STAGE_ORDER.length - 1 && <span style={{ color: 'var(--line)', margin: '0 2px' }}>→</span>}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          {stage === 'draft' && (
            <button onClick={() => advanceStage(submitForReview, 'Submitted for internal review')} disabled={pubBusy} style={stepBtn(true)}>
              Submit for Internal Review
            </button>
          )}
          {stage === 'internal_review' && (
            <>
              <button onClick={() => advanceStage(approveListing, 'Approved')} disabled={pubBusy} style={stepBtn(true)}>
                ✓ Approve for Publishing
              </button>
              <button onClick={() => advanceStage(revertToDraft, 'Reverted to draft')} disabled={pubBusy} style={stepBtn(false)}>
                Send Back to Draft
              </button>
            </>
          )}
          {stage === 'approved' && !pub?.published && (
            <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center' }}>✓ Approved — ready to publish below</div>
          )}
        </div>

        {/* Confidentiality / display controls — only relevant once approved */}
        <fieldset disabled={stage !== 'approved' || pubBusy} style={{ border: 'none', padding: 0, margin: 0, opacity: stage !== 'approved' ? 0.55 : 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 14 }}>
            <label style={stepLabel}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400 }}>
                <input type="checkbox" checked={form.isConfidential} onChange={(e) => setForm({ ...form, isConfidential: e.target.checked })} />
                List anonymously (hide business name)
              </span>
            </label>
            <label style={stepLabel}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400 }}>
                <input type="checkbox" checked={form.showFinancials} onChange={(e) => setForm({ ...form, showFinancials: e.target.checked })} />
                Show revenue / SDE / EBITDA publicly
              </span>
            </label>
            <label style={stepLabel}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400 }}>
                <input type="checkbox" checked={form.showExactLocation} onChange={(e) => setForm({ ...form, showExactLocation: e.target.checked })} />
                Show exact address publicly
              </span>
            </label>
            <label style={stepLabel}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400 }}>
                <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} />
                Feature on homepage
              </span>
            </label>
          </div>
          {form.isConfidential && (
            <label style={stepLabel}>
              Public title (shown instead of the business name)
              <input
                style={stepField}
                placeholder='e.g. "Established Profitable Restaurant — Southern California"'
                value={form.publicTitle}
                onChange={(e) => setForm({ ...form, publicTitle: e.target.value })}
              />
            </label>
          )}
        </fieldset>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}>
          {stage === 'approved' && (
            pub?.published ? (
              <button onClick={doUnpublish} disabled={pubBusy} style={stepBtn(false)}>Unpublish from Website</button>
            ) : null
          )}
          {stage === 'approved' && (
            <button onClick={doPublishToWebsite} disabled={pubBusy} style={stepBtn(true)}>
              {pub?.published ? '↻ Update Public Website' : '🌐 Publish to Public Website'}
            </button>
          )}
        </div>

        {pub?.published && (
          <div style={{ marginTop: 10, fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
            ✓ Live on the public website{form.isConfidential ? ' (anonymous listing)' : ''}.
          </div>
        )}
        {pubMsg && <div style={{ marginTop: 8, fontSize: 13, color: /fail/i.test(pubMsg) ? '#dc2626' : '#16a34a' }}>{pubMsg}</div>}
      </div>
    </StepShell>
  )
}
