// =============================================================================
// lib/autoGenerateTypes.ts — SHARED TYPES for the auto-generation pipeline.
// -----------------------------------------------------------------------------
// CLIENT-SAFE. Contains only types + static config (no server imports, no
// @anthropic-ai/sdk, no supabase service-role). Both the server pipeline
// (lib/autoGenerate.ts) and the browser components import from here so the
// client never pulls the Anthropic SDK / node:path into the bundle.
// =============================================================================

import type { FinancialStatus } from '@/lib/financialFiles'
import type { RecastResult } from '@/lib/recast'

export type PipelineStage = 'recast' | 'bov' | 'cim' | 'bli'

export interface GeneratedArtifact {
  stage: PipelineStage
  title: string
  fileName: string
  storagePath: string
  publicUrl: string
  docId: string
  status: FinancialStatus
  statusLabel: string
}

export interface AutoGenerateResult {
  ok: boolean
  listingId: string
  listingName: string
  error?: string
  artifacts: GeneratedArtifact[]
  recast?: RecastResult
  notes: string[]
}

export const PIPELINE_STEPS: { stage: PipelineStage; label: string; icon: string; status: FinancialStatus }[] = [
  { stage: 'recast', label: 'Recast (normalized P&L)', icon: '🔄', status: 'recast_done' },
  { stage: 'bov', label: 'BOV (Broker Opinion of Value)', icon: '⚖️', status: 'bov_done' },
  { stage: 'cim', label: 'CIM (Confidential Memo)', icon: '📑', status: 'cim_done' },
  { stage: 'bli', label: 'BLI (Listing Summary)', icon: '📋', status: 'bli_done' },
]
