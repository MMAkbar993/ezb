'use client'

import { useEffect, useState } from 'react'
import { completeStep } from '@/lib/workflow'
import { StepShell } from '@/components/listings/StepShell'
import ListingGenerationPanel from '@/components/listings/ListingGenerationPanel'
import { fetchListing, updateListing } from '@/lib/listings'

// ---------------------------------------------------------------------------
// Step 6 — Generate BLI. Same real pipeline as Steps 3-5. BLI is often
// shared more broadly than the CIM, so brokers can anonymize the business
// name here — the CIM/BOV always show the real name (only released to
// NDA'd buyers).
// ---------------------------------------------------------------------------

export default function Step6GenerateBLI({ listingId, onNext }: { listingId: string; onNext: () => void }) {
  const [anonymize, setAnonymize] = useState(false)
  const [headline, setHeadline] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchListing(listingId).then((l) => {
      if (!l) return
      setAnonymize(!!l.bli_anonymize)
      setHeadline(l.headline || '')
    })
  }, [listingId])

  const toggle = async (checked: boolean) => {
    setAnonymize(checked)
    setSaving(true)
    try { await updateListing(listingId, { bli_anonymize: checked }) } finally { setSaving(false) }
  }

  return (
    <StepShell
      step={6} title="Generate BLI"
      description="The Business Listing Information summary generates from the same recast financials, for marketplace syndication."
      status="draft" onNext={async () => { await completeStep(listingId, 6); onNext() }} nextLabel="Step 6 complete →"
    >
      <div style={{ marginBottom: 20, padding: 14, background: 'var(--paper)', borderRadius: 10, border: '1px solid var(--line)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--text)', cursor: 'pointer' }}>
          <input type="checkbox" checked={anonymize} onChange={(e) => toggle(e.target.checked)} disabled={saving} />
          Hide the business name in the BLI — show the confidential headline instead
        </label>
        {anonymize && (
          <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--muted)' }}>
            BLI will show: <strong style={{ color: 'var(--navy)' }}>{headline || 'the industry (no headline set — add one when editing the listing)'}</strong>
            {' '}instead of the business name. The CIM and BOV are unaffected — they always show the real name, since they're only released after a buyer signs the NDA.
          </div>
        )}
      </div>

      <ListingGenerationPanel listingId={listingId} />
    </StepShell>
  )
}
