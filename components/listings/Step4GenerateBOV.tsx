'use client'

import { completeStep } from '@/lib/workflow'
import { StepShell } from '@/components/listings/StepShell'
import ListingGenerationPanel from '@/components/listings/ListingGenerationPanel'

// ---------------------------------------------------------------------------
// Step 4 — Generate BOV. Same real pipeline as Step 3 (Recast) — BOV is one
// of the four documents produced together, using an industry-specific
// SDE/EBITDA multiple (lib/industryMultiples.ts) rather than a flat 3x.
// ---------------------------------------------------------------------------

export default function Step4GenerateBOV({ listingId, onNext }: { listingId: string; onNext: () => void }) {
  return (
    <StepShell
      step={4} title="Generate BOV"
      description="The Broker Opinion of Value generates from the uploaded financials using an industry-specific multiple."
      status="draft" onNext={async () => { await completeStep(listingId, 4); onNext() }} nextLabel="Step 4 complete →"
    >
      <ListingGenerationPanel listingId={listingId} />
    </StepShell>
  )
}
