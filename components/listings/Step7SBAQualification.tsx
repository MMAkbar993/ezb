'use client'

import { useEffect, useState } from 'react'
import { StepShell, stepField, stepLabel, stepBtn } from '@/components/listings/StepShell'
import { saveSBA, fetchSBA, completeStep } from '@/lib/workflow'

// ---------------------------------------------------------------------------
// Step 7 — SBA Qualification (OPTIONAL).
// The spec: SBA qualification is optional. Agent can skip or complete it.
// ---------------------------------------------------------------------------

export default function Step7SBAQualification({ listingId, onNext }: { listingId: string; onNext: () => void }) {
  const [eligible, setEligible] = useState<boolean | null>(null)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    (async () => {
      const sba = await fetchSBA(listingId)
      if (sba) {
        setEligible(sba.is_sba_eligible ?? null)
        setReason(sba.sba_reason || '')
        setNotes(sba.sba_notes || '')
      }
    })()
  }, [listingId])

  const save = async (skip = false) => {
    setBusy(true)
    if (!skip) {
      await saveSBA(listingId, {
        is_sba_eligible: eligible, sba_reason: reason, sba_notes: notes,
        reviewed_at: new Date().toISOString(), is_optional: true,
      })
    }
    await completeStep(listingId, 7)
    setBusy(false)
    onNext()
  }

  const eligibleBtn = (val: boolean): React.CSSProperties => ({
    padding: '12px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
    background: eligible === val ? (val ? '#e8f7ee' : '#fdeaea') : '#fff',
    color: eligible === val ? (val ? '#16a34a' : '#dc2626') : 'var(--muted)',
    border: `2px solid ${eligible === val ? (val ? '#22c55e' : '#ef4444') : 'var(--line)'}`,
  })

  return (
    <StepShell step={7} title="SBA Qualification" description="OPTIONAL — assess whether the business qualifies for SBA 7(a)/504 financing. This step can be skipped."
      status="draft"
      onBack={undefined} onNext={() => save(false)} nextLabel={busy ? 'Saving…' : 'Save & continue →'} nextDisabled={eligible === null}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}>Is the business SBA-eligible?</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => setEligible(true)} style={eligibleBtn(true)}>✓ Yes — eligible</button>
          <button onClick={() => setEligible(false)} style={eligibleBtn(false)}>✕ No — not eligible</button>
        </div>
      </div>

      {eligible !== null && (
        <>
          <label style={stepLabel}>Reason
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. meets size standards, good credit, business assets…" style={stepField} />
          </label>
          <label style={stepLabel}>SBA notes
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes for the file…" style={{ ...stepField, resize: 'vertical' }} />
          </label>
        </>
      )}

      <div style={{ marginTop: 16, padding: '14px 16px', background: '#fdf3e3', border: '1px solid #fcd34d', borderRadius: 8, fontSize: 13, color: '#92400e' }}>
        <strong>SBA is optional.</strong> If you don't need SBA financing for this deal, use the button below to skip this step and continue.
      </div>

      <div style={{ marginTop: 14 }}>
        <button onClick={() => save(true)} style={stepBtn(false)}>Skip SBA (optional) & continue →</button>
      </div>
    </StepShell>
  )
}
