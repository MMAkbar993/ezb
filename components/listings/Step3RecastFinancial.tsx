'use client'

import { completeStep } from '@/lib/workflow'
import { StepShell } from '@/components/listings/StepShell'
import ListingGenerationPanel from '@/components/listings/ListingGenerationPanel'

// ---------------------------------------------------------------------------
// Step 3 — Recast Financials. Runs the real Recast -> BOV -> CIM -> BLI
// pipeline (Claude-backed document extraction, same engine as the
// standalone Financial tab) against whatever was uploaded in Step 2 or here.
// ---------------------------------------------------------------------------

export default function Step3RecastFinancial({ listingId, onNext }: { listingId: string; onNext: () => void }) {
  return (
    <StepShell
      step={3} title="Recast Financials"
      description="Generate a normalized recast from the uploaded financial documents — add-backs and a clean SDE/EBITDA are computed automatically."
      status="draft" onNext={async () => { await completeStep(listingId, 3); onNext() }} nextLabel="Step 3 complete →"
    >
      <ListingGenerationPanel listingId={listingId} />
    </StepShell>
  )
}
