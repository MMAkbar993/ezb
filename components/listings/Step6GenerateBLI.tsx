'use client'

import { useEffect, useState } from 'react'
import { StepShell, stepBtn } from '@/components/listings/StepShell'
import { generateBLI, fetchVersions, finalizeVersion, completeStep } from '@/lib/workflow'
import { fetchListing, fmtMoney } from '@/lib/listings'

// ---------------------------------------------------------------------------
// Step 6 — Generate BLI (auto-generates after CIM complete).
// ---------------------------------------------------------------------------

export default function Step6GenerateBLI({ listingId, onNext }: { listingId: string; onNext: () => void }) {
  const [versions, setVersions] = useState<any[]>([])
  const [listing, setListing] = useState<any>(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const [v, l] = await Promise.all([fetchVersions(listingId, 'bli_versions'), fetchListing(listingId)])
    setVersions(v); setListing(l)
  }
  useEffect(() => { load() }, [listingId])

  const gen = async () => { setBusy(true); await generateBLI(listingId); await load(); setBusy(false) }
  const current = versions[0]

  return (
    <StepShell step={6} title="Generate BLI" description="The Business Listing Information summary auto-generates for marketplace syndication."
      status="draft" onNext={async () => { await completeStep(listingId, 6); onNext() }} nextLabel="Step 6 complete →">
      <button onClick={gen} disabled={busy} style={{ ...stepBtn(true), marginBottom: 18 }}>{busy ? 'Generating…' : (current ? '↻ Regenerate BLI' : 'Generate BLI')}</button>

      {current ? (
        <div style={{ padding: '20px 22px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--paper)' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--gold-dark)', fontWeight: 700 }}>Business Listing Information</div>
          <div style={{ fontSize: 21, fontWeight: 700, fontFamily: 'Georgia, serif', color: 'var(--navy)', marginTop: 4 }}>{listing?.business_name}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14, fontSize: 13 }}>
            <div><div style={kv}>Asking Price</div><div style={{ fontWeight: 700 }}>{fmtMoney(listing?.asking_price)}</div></div>
            <div><div style={kv}>Industry</div><div style={{ fontWeight: 700 }}>{listing?.industry || '—'}</div></div>
            <div><div style={kv}>Location</div><div style={{ fontWeight: 700 }}>{listing?.location_general || '—'}</div></div>
            <div><div style={kv}>Status</div><div style={{ fontWeight: 700, textTransform: 'capitalize' }}>{listing?.status || 'draft'}</div></div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            {['draft', 'review', 'final'].map((s) => (
              <button key={s} onClick={async () => { await finalizeVersion('bli_versions', current.id, s); await load() }} style={{ ...stepBtn(false), padding: '7px 14px', fontSize: 12.5, background: current.status === s ? 'var(--navy)' : 'transparent', color: current.status === s ? '#fff' : 'var(--navy)' }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>No BLI generated yet. Complete Step 5 (CIM) then click “Generate BLI”.</div>
      )}
    </StepShell>
  )
}

const kv: React.CSSProperties = { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--muted)', marginBottom: 2 }
