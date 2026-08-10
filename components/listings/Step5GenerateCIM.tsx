'use client'

import { useEffect, useState } from 'react'
import { StepShell, stepBtn, stepField, stepLabel } from '@/components/listings/StepShell'
import { generateCIM, fetchVersions, finalizeVersion, completeStep, fetchRecast, fetchFinancials } from '@/lib/workflow'
import { fetchListing, fmtMoney } from '@/lib/listings'

// ---------------------------------------------------------------------------
// Step 5 — Generate CIM (auto-generates after Recast complete).
// ---------------------------------------------------------------------------

export default function Step5GenerateCIM({ listingId, onNext }: { listingId: string; onNext: () => void }) {
  const [versions, setVersions] = useState<any[]>([])
  const [listing, setListing] = useState<any>(null)
  const [recast, setRecast] = useState<any>(null)
  const [fin, setFin] = useState<any>(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const [v, l, r, f] = await Promise.all([
      fetchVersions(listingId, 'cim_versions'), fetchListing(listingId), fetchRecast(listingId), fetchFinancials(listingId),
    ])
    setVersions(v); setListing(l); setRecast(r); setFin(f)
  }
  useEffect(() => { load() }, [listingId])

  const gen = async () => { setBusy(true); await generateCIM(listingId); await load(); setBusy(false) }
  const current = versions[0]
  const recastedSde = recast?.recasted_sde

  return (
    <StepShell step={5} title="Generate CIM" description="The Confidential Information Memorandum auto-generates from the recast financials."
      status="draft" onNext={async () => { await completeStep(listingId, 5); onNext() }} nextLabel="Step 5 complete →">
      <button onClick={gen} disabled={busy} style={{ ...stepBtn(true), marginBottom: 18 }}>{busy ? 'Generating…' : (current ? '↻ Regenerate CIM' : 'Generate CIM')}</button>

      {current ? (
        <div style={{ padding: '20px 22px', border: '1px solid var(--line)', borderRadius: 10, background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--gold-dark)', fontWeight: 700 }}>Confidential Information Memorandum</div>
              <div style={{ fontSize: 21, fontWeight: 700, fontFamily: 'Georgia, serif', color: 'var(--navy)', marginTop: 4 }}>
                {listing?.business_name || 'Business opportunity'}
              </div>
            </div>
            <span style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--paper)', padding: '5px 12px', borderRadius: 16, border: '1px solid var(--line)', textTransform: 'capitalize' }}>{current.status}</span>
          </div>
          <div style={{ height: 1, background: 'var(--line)', margin: '14px 0' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, fontSize: 13 }}>
            <div><div style={kvLabel}>Recasted SDE</div><div style={{ fontWeight: 700 }}>{fmtMoney(recastedSde)}</div></div>
            <div><div style={kvLabel}>Asking Price</div><div style={{ fontWeight: 700 }}>{fmtMoney(listing?.asking_price)}</div></div>
            <div><div style={kvLabel}>Industry</div><div style={{ fontWeight: 700 }}>{listing?.industry || '—'}</div></div>
          </div>
        </div>
      ) : (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>No CIM generated yet. Complete Step 3 (Recast) then click “Generate CIM”.</div>
      )}

      {/* Status setter */}
      {current && (
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Mark as:</span>
          {['draft', 'review', 'final'].map((s) => (
            <button key={s} onClick={async () => { await finalizeVersion('cim_versions', current.id, s); await load() }} style={{ ...stepBtn(false), padding: '7px 14px', fontSize: 12.5, background: current.status === s ? 'var(--navy)' : 'transparent', color: current.status === s ? '#fff' : 'var(--navy)' }}>
              {s}
            </button>
          ))}
        </div>
      )}
    </StepShell>
  )
}

const kvLabel: React.CSSProperties = { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--muted)', marginBottom: 2 }
