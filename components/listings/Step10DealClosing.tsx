'use client'

import { useEffect, useState } from 'react'
import { StepShell, stepField, stepLabel, stepBtn } from '@/components/listings/StepShell'
import { getAgreement, recordLOI, recordPurchaseAgreement, recordClosing, fetchClosingDetails, completeStep, fetchBuyers } from '@/lib/workflow'
import { fetchListing } from '@/lib/listings'
import StatusBadge from '@/components/listings/StatusBadge'

// ---------------------------------------------------------------------------
// Step 10 — Deal Closing: LOI → Purchase Agreement → Closing.
// Status auto-updates at each stage via updateStatusFromAgreement().
// ---------------------------------------------------------------------------

export default function Step10DealClosing({ listingId, onNext }: { listingId: string; onNext: () => void }) {
  const [agreement, setAgreement] = useState<any>(null)
  const [buyers, setBuyers] = useState<any[]>([])
  const [selectedBuyer, setSelectedBuyer] = useState('')
  const [closing, setClosing] = useState<any>(null)
  const [closingDate, setClosingDate] = useState('')
  const [finalPrice, setFinalPrice] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const [ag, by, cl, l] = await Promise.all([getAgreement(listingId), fetchBuyers(listingId), fetchClosingDetails(listingId), fetchListing(listingId)])
    setAgreement(ag); setBuyers(by); setClosing(cl); setStatus(l?.status || '')
    if (ag?.buyer_id) setSelectedBuyer(ag.buyer_id)
    if (cl) { setClosingDate(cl.closing_date || ''); setFinalPrice(cl.final_purchase_price ?? '') }
  }
  useEffect(() => { load() }, [listingId])

  const stage = agreement?.status || (status === 'closed' ? 'closing' : 'loi')
  const stageIdx = stage === 'loi' ? 1 : stage === 'under_contract' ? 2 : 3

  const doLOI = async () => { setBusy(true); await recordLOI(listingId, selectedBuyer || null); await load(); setBusy(false) }
  const doPurchase = async () => { setBusy(true); await recordPurchaseAgreement(listingId, selectedBuyer || null); await load(); setBusy(false) }
  const doClose = async () => { setBusy(true); await recordClosing(listingId, { closing_date: closingDate || null, final_purchase_price: Number(finalPrice) || null }); await load(); setBusy(false) }

  const stages = [
    { label: 'LOI signed', hint: 'Moves listing to Under LOI', done: stageIdx >= 1, action: doLOI, btnLabel: 'Record signed LOI' },
    { label: 'Purchase agreement', hint: 'Keeps listing Under LOI', done: stageIdx >= 2, action: doPurchase, btnLabel: 'Record signed purchase agreement' },
    { label: 'Closing', hint: 'Moves listing to Closed', done: stageIdx >= 3, action: doClose, btnLabel: 'Record closing', hasInputs: true },
  ]

  return (
    <StepShell step={10} title="Deal Closing" description="Advance the deal through LOI, purchase agreement, and closing. The listing status updates automatically at each stage."
      status="draft" onNext={async () => { await completeStep(listingId, 10); onNext() }} nextLabel="Finish workflow">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Current listing status:</span>
        <StatusBadge status={status} />
      </div>

      {/* Stage selector */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {stages.map((s, i) => (
          <div key={s.label} style={{ flex: 1, padding: '14px 16px', borderRadius: 10, border: `2px solid ${s.done ? '#22c55e' : i + 1 === stageIdx ? 'var(--gold)' : 'var(--line)'}`, background: s.done ? '#e8f7ee' : i + 1 === stageIdx ? 'rgba(201,168,76,0.08)' : '#fafafc', textAlign: 'center' }}>
            <div style={{ fontSize: 18 }}>{s.done ? '✓' : i + 1 === stageIdx ? '●' : String(i + 1)}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginTop: 4 }}>{s.label}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.hint}</div>
          </div>
        ))}
      </div>

      {/* Buyer select */}
      <label style={stepLabel}>Primary buyer
        <select value={selectedBuyer} onChange={(e) => setSelectedBuyer(e.target.value)} style={stepField}>
          <option value="">Select buyer…</option>
          {buyers.map((b) => <option key={b.id} value={b.id}>{b.buyer_name}{b.is_primary_buyer ? ' (primary)' : ''}</option>)}
          {agreement?.buyer_id && !buyers.some((b) => b.id === agreement.buyer_id) && <option value={agreement.buyer_id}>Current buyer</option>}
        </select>
      </label>

      {stage === 'closing' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <label style={stepLabel}>Closing date<input type="date" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} style={stepField} /></label>
          <label style={stepLabel}>Final purchase price<input type="number" value={finalPrice} onChange={(e) => setFinalPrice(e.target.value)} placeholder="0" style={stepField} /></label>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {stages.map((s) => !s.done && (
          <button key={s.label} onClick={s.action} disabled={busy} style={stepBtn(true)}>{busy ? '…' : s.btnLabel}</button>
        ))}
        {stageIdx >= 3 && closing && (
          <div style={{ padding: '12px 16px', background: '#e8f7ee', borderRadius: 8, fontSize: 13, color: '#15803d', width: '100%' }}>
            ✓ Deal closed. {closing.final_purchase_price ? 'Final price: $' + Math.round(closing.final_purchase_price).toLocaleString() : ''}
          </div>
        )}
      </div>
    </StepShell>
  )
}
