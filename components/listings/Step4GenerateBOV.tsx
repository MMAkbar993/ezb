'use client'

import { useEffect, useState } from 'react'
import { StepShell, stepBtn } from '@/components/listings/StepShell'
import { generateBOV, fetchVersions, finalizeVersion, completeStep } from '@/lib/workflow'
import { fmtMoney, fetchListing } from '@/lib/listings'

// ---------------------------------------------------------------------------
// Step 4 — Generate BOV (auto-generates once financials are entered).
// ---------------------------------------------------------------------------

export default function Step4GenerateBOV({ listingId, onNext }: { listingId: string; onNext: () => void }) {
  const [versions, setVersions] = useState<any[]>([])
  const [listing, setListing] = useState<any>(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setVersions(await fetchVersions(listingId, 'bov_versions'))
    setListing(await fetchListing(listingId))
  }
  useEffect(() => { load() }, [listingId])

  const gen = async () => { setBusy(true); await generateBOV(listingId); await load(); setBusy(false) }

  const current = versions[0]
  const sde = listing?.sde || 0
  const multiple = current?.valuation_multiple || 3.0

  return (
    <StepShell step={4} title="Generate BOV" description="The Broker Opinion of Value auto-generates from your financials using an industry multiple."
      status="draft" onNext={async () => { await completeStep(listingId, 4); onNext() }} nextLabel="Step 4 complete →">
      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <button onClick={gen} disabled={busy} style={stepBtn(true)}>{busy ? 'Generating…' : (current ? '↻ Regenerate BOV' : 'Generate BOV')}</button>
        {versions.map((v, i) => (
          <select key={v.id} value={v.id} onChange={async (e) => { await finalizeVersion('bov_versions', e.target.value, e.target.value === v.id ? 'final' : 'draft') }} style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--line)', fontFamily: 'inherit' }}>
            <option value={v.id}>v{v.version_number} · {v.status}</option>
          </select>
        ))}
      </div>

      {current ? (
        <div style={{ padding: '22px 24px', background: 'var(--paper)', borderRadius: 10, border: '1px solid var(--gold)', position: 'relative' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--gold-dark)', fontWeight: 700, marginBottom: 6 }}>Broker Opinion of Value</div>
          <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'Georgia, serif', color: 'var(--navy)' }}>{fmtMoney(current.valuation_amount ?? sde * multiple)}</div>
          <div style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 4 }}>
            Based on SDE of {fmtMoney(sde)} × {multiple}x multiple
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 13, color: 'var(--muted)' }}>
            <span>SDE: {fmtMoney(sde)}</span>
            <span>Multiple: {multiple}x</span>
          </div>
        </div>
      ) : (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>No BOV generated yet. Complete Step 2 then click “Generate BOV”.</div>
      )}
    </StepShell>
  )
}
