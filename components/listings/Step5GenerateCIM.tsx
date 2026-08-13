'use client'

import { completeStep } from '@/lib/workflow'
import { StepShell } from '@/components/listings/StepShell'
import ListingGenerationPanel from '@/components/listings/ListingGenerationPanel'

// ---------------------------------------------------------------------------
// Step 5 — Generate CIM. Same real pipeline as Steps 3-4 — the Confidential
// Information Memorandum is written from the Claude-extracted financials +
// recast, not a static stub summary.
// ---------------------------------------------------------------------------

export default function Step5GenerateCIM({ listingId, onNext }: { listingId: string; onNext: () => void }) {
  return (
    <StepShell
      step={5} title="Generate CIM"
      description="The Confidential Information Memorandum generates from the recast financials, enriched by AI reading the uploaded documents."
      status="draft" onNext={async () => { await completeStep(listingId, 5); onNext() }} nextLabel="Step 5 complete →"
    >
      <ListingGenerationPanel listingId={listingId} />
    </StepShell>
  )
}
