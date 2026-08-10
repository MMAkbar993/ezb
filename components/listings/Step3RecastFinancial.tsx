'use client'

import { useEffect, useState } from 'react'
import { StepShell, stepField, stepLabel, stepBtn } from '@/components/listings/StepShell'
import { saveRecast, fetchRecast, completeStep, fetchFinancials } from '@/lib/workflow'

// ---------------------------------------------------------------------------
// Step 3 — Recast Financials: normalize owner financials with add-backs.
// ---------------------------------------------------------------------------

const EMPTY_BACK = { id: Date.now(), label: '', amount: '' }

export default function Step3RecastFinancial({ listingId, onNext }: { listingId: string; onNext: () => void }) {
  const [originalSde, setOriginalSde] = useState('')
  const [originalEbitda, setOriginalEbitda] = useState('')
  const [recastedSde, setRecastedSde] = useState('')
  const [recastedEbitda, setRecastedEbitda] = useState('')
  const [addBacks, setAddBacks] = useState<{ id: number; label: string; amount: string }[]>([{ ...EMPTY_BACK, id: Date.now() + 1 }])
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    (async () => {
      const [rec, fin] = await Promise.all([fetchRecast(listingId), fetchFinancials(listingId)])
      if (rec) {
        setOriginalSde(rec.original_sde ?? ''); setOriginalEbitda(rec.original_ebitda ?? '')
        setRecastedSde(rec.recasted_sde ?? ''); setRecastedEbitda(rec.recasted_ebitda ?? '')
        const backs = (rec.add_backs || []).map((b: any, i: number) => ({ id: i, label: b.label || '', amount: b.amount ?? '' }))
        setAddBacks(backs.length ? backs : [{ ...EMPTY_BACK, id: 1 }])
        setNotes(rec.notes || '')
      } else if (fin) {
        setOriginalSde(fin.sde?.amount ?? ''); setOriginalEbitda(fin.ebitda?.amount ?? '')
      }
    })()
  }, [listingId])

  const totalAddBacks = addBacks.reduce((s, b) => s + (Number(b.amount) || 0), 0)
  const sdeVal = (Number(originalSde) || 0) + totalAddBacks

  const save = async () => {
    setBusy(true)
    await saveRecast(listingId, {
      original_sde: Number(originalSde) || null, recasted_sde: sdeVal,
      original_ebitda: Number(originalEbitda) || null, recasted_ebitda: Number(recastedEbitda) || null,
      add_backs: addBacks.map((b) => ({ label: b.label, amount: Number(b.amount) || 0 })),
      notes,
    })
    await completeStep(listingId, 3)
    setBusy(false)
    onNext()
  }

  const update: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }
  const inputStyle: React.CSSProperties = { ...stepField, padding: '10px 12px' }

  return (
    <StepShell step={3} title="Recast Financials" description="Normalize owner financials by adding back discretionary expenses to arrive at a sustainable SDE/EBITDA."
      status="draft" onNext={save} nextDisabled={!sdeVal} nextLabel={busy ? 'Saving…' : 'Step 3 complete →'}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        <label style={stepLabel}>Original SDE<input type="number" value={originalSde} onChange={(e) => setOriginalSde(e.target.value)} style={inputStyle} /></label>
        <label style={stepLabel}>Original EBITDA<input type="number" value={originalEbitda} onChange={(e) => setOriginalEbitda(e.target.value)} style={inputStyle} /></label>
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>Add-backs</div>
      {addBacks.map((b) => (
        <div key={b.id} style={update}>
          <input value={b.label} onChange={(e) => setAddBacks(addBacks.map((x) => x.id === b.id ? { ...x, label: e.target.value } : x))} placeholder="Add-back description (e.g. owner salary, personal vehicle)" style={{ ...inputStyle, flex: 1 }} />
          <input type="number" value={b.amount} onChange={(e) => setAddBacks(addBacks.map((x) => x.id === b.id ? { ...x, amount: e.target.value } : x))} placeholder="$ amount" style={{ ...inputStyle, width: 150 }} />
          <button onClick={() => setAddBacks(addBacks.filter((x) => x.id !== b.id))} style={stepBtn(false)}>✕</button>
        </div>
      ))}
      <button onClick={() => setAddBacks([...addBacks, { ...EMPTY_BACK, id: Date.now() }])} style={{ ...stepBtn(false), marginBottom: 16 }}>+ Add add-back</button>

      <div style={{ padding: '14px 18px', background: 'var(--paper)', borderRadius: 8, border: '1px solid var(--line)', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, color: 'var(--muted)' }}>Recasted SDE (auto-calculated)</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--navy)', fontFamily: 'Georgia, serif' }}>${sdeVal.toLocaleString()}</span>
        </div>
      </div>

      <label style={stepLabel}>Recasted EBITDA
        <input type="number" value={recastedEbitda} onChange={(e) => setRecastedEbitda(e.target.value)} placeholder="Manual if available" style={inputStyle} />
      </label>
      <label style={stepLabel}>Notes
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Recast assumptions and rationale…" style={{ ...inputStyle, resize: 'vertical' }} />
      </label>
    </StepShell>
  )
}
