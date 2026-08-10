// =============================================================================
// lib/autoGenerate.ts — auto-generation pipeline for financial documents.
// -----------------------------------------------------------------------------
// SERVER-ONLY. Given a listing (and optionally a deal), this runs the full
// One-Click pipeline:
//
//   source files -> detect types -> extract financials
//                 -> Recast  (recasted P&L PDF)
//                 -> BOV     (10+ page Broker Opinion of Value PDF)
//                 -> CIM     (25+ section Confidential Info Memorandum PDF)
//                 -> BLI     (one-page Business Listing Information PDF)
//
// Each generated artifact is rendered to a PDF (via lib/pdfExport), uploaded to
// the 'documents' storage bucket, and recorded in financial_documents with
// category = 'generated_document' and status advancing up the pipeline
// (recast_done -> bov_done -> cim_done -> bli_done). Source files are marked
// 'processed'. Always import from a Route Handler / Server Component only —
// this module touches the service-role key and the Claude client.
//
// DEPS: reuse the deterministic generators (recast/bov/cim/bli) already built.
// Claude is used ONLY to enrich financial data extraction when financial files
// are present — the heavy document generation stays deterministic so it is
// reliable, cheap and auditable (matching the platform's established style).
// =============================================================================

import { createServerClient } from '@/lib/supabase/server'
import type { Listing } from '@/lib/listings'
import { recastFinancials, type RecastResult, type RecastInput, type YearFinancials } from '@/lib/recast'
import { generateBovContent } from '@/lib/bov'
import { generateCimContent } from '@/lib/cim'
import { generateBliContent } from '@/lib/bli'
import { exportRecastToPdf, exportBovToPdf, exportCimToPdf, exportBliToPdf } from '@/lib/pdfExport'
import {
  buildFinancialHistory,
  computeFinancialMetrics,
  extractFinancialCsv,
  groupUploadedDocs,
  type ExtractedFinancialRow,
} from '@/lib/financialExtractor'
import { FF_BUCKET, type FinancialStatus, type FinancialDoc } from '@/lib/financialFiles'
import { complete, isClaudeConfigured } from '@/lib/claude/client'
import type {
  PipelineStage,
  GeneratedArtifact,
  AutoGenerateResult,
} from '@/lib/autoGenerateTypes'

// Re-export shared types so existing imports from '@/lib/autoGenerate' keep
// working without pulling the server-only Claude/SDK path into client bundles.
export type { PipelineStage, GeneratedArtifact, AutoGenerateResult }

// Static pipeline steps live in the client-safe types module.
export { PIPELINE_STEPS } from '@/lib/autoGenerateTypes'

function statusLabel(s: FinancialStatus): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function slugify(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'business'
}

// ---------------------------------------------------------------------------
// Financial extraction — Claude-backed when configured, else heuristic/CSV.
// ---------------------------------------------------------------------------
interface ExtractedData {
  rows: ExtractedFinancialRow[]
  notes: string
}

async function extractFinancials(
  listing: Listing,
  docs: FinancialDoc[],
): Promise<ExtractedData> {
  const notes: string[] = []
  const rows: ExtractedFinancialRow[] = []

  // 1) Try CSV/TSV parsing from any source docs we can fetch as text.
  //    (In practice source uploads are PDFs/Excel; CSV is the parseable case.)
  const csv = docs.find((d) => /\.(csv|tsv)$/i.test(d.file_name || ''))
  if (csv?.file_url) {
    try {
      const res = await fetch(csv.file_url, { signal: AbortSignal.timeout(8000) })
      if (res.ok) {
        const text = await res.text()
        const parsed = extractFinancialCsv(text, new Date().getFullYear() - 1)
        if (parsed.length) {
          rows.push(...parsed)
          notes.push(`Extracted ${parsed.length} fiscal year row(s) from ${csv.file_name}.`)
        }
      }
    } catch {
      /* non-fatal */
    }
  }

  // 2) Claude-backed extraction — asks the model to produce a tight JSON
  //    summary of the listing earnings (+ any financial file names present).
  //    Deterministic generators still build the documents; this only enriches.
  if (isClaudeConfigured() && !rows.length) {
    const fileList = docs
      .filter((d) => d.category !== 'generated_document')
      .map((d) => d.file_name)
    try {
      const contextText = [
        `Listing: ${listing.business_name || 'Business'}`, 
        `Industry: ${listing.industry || 'unknown'}`, 
        `Annual revenue: ${listing.annual_revenue ?? 'unknown'}`, 
        `SDE: ${listing.sde ?? 'unknown'}`, 
        `EBITDA: ${listing.ebitda ?? 'unknown'}`, 
        `Uploaded financial files: ${fileList.length ? fileList.join(', ') : 'none'}`,
      ].join('\n')
      const { data } = await complete({
        context: { kind: 'document', entityId: listing.id, text: contextText },
        system:
          'You extract normalized owner-earnings data from brokerage financial files. ' +
          'Return ONLY a compact JSON object with an optional "years" array ' +
          '[{year, revenue, sde, ebitda}] and an optional "notes" string. ' +
          'Do not fabricate numbers that are not provided.',
        jsonMode: true,
        maxTokens: 700,
      })
      const years = (data?.years as { year: number; revenue?: number; sde?: number; ebitda?: number }[] | undefined) || []
      if (years.length) {
        rows.push(...years.map((y) => ({ year: y.year, revenue: y.revenue, netIncome: y.sde ?? y.ebitda })))
        notes.push('Claude-assisted earnings extraction applied.')
      }
    } catch {
      /* non-fatal */
    }
  }

  if (!rows.length) {
    notes.push('No parseable financial detail found — derived a conservative 3-year history from listing figures.')
  }

  return { rows, notes: notes.join(' ') }
}

// ---------------------------------------------------------------------------
// Persistence: upload PDF bytes to storage + insert generated_document row.
// ---------------------------------------------------------------------------
async function saveGeneratedDoc(step: {
  listingId: string
  dealId: string | null
  stage: PipelineStage
  title: string
  bytes: Uint8Array
  status: FinancialStatus
}): Promise<GeneratedArtifact> {
  const supabase = createServerClient()
  if (!supabase) throw new Error('Supabase server client not configured')

  const safeName = slugify(step.title)
  const stamp = Date.now()
  const storagePath = `financial-files/${step.listingId}/${stamp}-${safeName}.pdf`

  const { error: upErr } = await supabase.storage
    .from(FF_BUCKET)
    .upload(storagePath, Buffer.from(step.bytes), {
      contentType: 'application/pdf',
      upsert: false,
    })
  if (upErr) throw new Error(`Storage upload failed (${step.stage}): ${upErr.message}`)

  const { data: urlData } = supabase.storage.from(FF_BUCKET).getPublicUrl(storagePath)
  const publicUrl = urlData?.publicUrl || ''

  const fileName = `${safeName}.pdf`
  const { data, error } = await supabase
    .from('financial_documents')
    .insert({
      deal_id: step.dealId,
      listing_id: step.listingId,
      file_name: fileName,
      file_url: publicUrl,
      storage_path: storagePath,
      file_size: step.bytes.byteLength,
      mime_type: 'application/pdf',
      file_kind: 'pdf',
      category: 'generated_document',
      status: step.status,
      notes: `Auto-generated ${step.title} (${step.stage.toUpperCase()})`,
    })
    .select()
    .single()

  if (error) throw new Error(`DB insert failed (${step.stage}): ${error.message}`)

  return {
    stage: step.stage,
    title: step.title,
    fileName,
    storagePath,
    publicUrl,
    docId: data.id as string,
    status: step.status,
    statusLabel: statusLabel(step.status),
  }
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------
export async function runAutoGeneration(input: {
  listingId: string
  dealId?: string | null
}): Promise<AutoGenerateResult> {
  const supabase = createServerClient()
  if (!supabase) {
    return { ok: false, listingId: input.listingId, listingName: '', error: 'Supabase server client not configured', artifacts: [], notes: [] }
  }

  // 1) Load the listing
  const { data: listing, error: listingErr } = await supabase
    .from('listings')
    .select('*')
    .eq('id', input.listingId)
    .single()
  if (listingErr || !listing) {
    return { ok: false, listingId: input.listingId, listingName: '', error: `Listing not found: ${listingErr?.message || input.listingId}`, artifacts: [], notes: [] }
  }
  const L = listing as Listing
  const dealId = input.dealId ?? null
  const artifacts: GeneratedArtifact[] = []
  const notes: string[] = []

  // 2) Load existing source financial docs for this listing
  const { data: sourceDocs } = await supabase
    .from('financial_documents')
    .select('*')
    .or(`listing_id.eq.${input.listingId},deal_id.eq.${dealId ?? 'none'}`)
  const sources = ((sourceDocs as FinancialDoc[] | null) || []).filter((d) => d.category !== 'generated_document')
  const grouped = groupUploadedDocs(sources)

  // 3) Extract financial data (Claude / CSV / heuristic)
  const extraction = await extractFinancials(L, sources)
  if (extraction.notes) notes.push(extraction.notes)

  // 4) Build 3-year financial history from listing + extracted rows
  const history: YearFinancials[] = buildFinancialHistory(L, extraction.rows)

  // 5) RECAST
  try {
    const recastInput: RecastInput = {
      listingId: L.id,
      businessName: L.business_name || 'Business',
      entityType: 'llc',
      currency: '$',
      years: history,
      addBacks: [], // auto recast uses the built-in add-back modeling in SDE/EBITDA
    }
    const recast = recastFinancials(recastInput)
    const bytes = exportRecastToPdf(recast, { returnBytes: true })
    if (bytes) {
      const art = await saveGeneratedDoc({
        listingId: L.id,
        dealId,
        stage: 'recast',
        title: `${L.business_name || 'Business'} — Recast Report`,
        bytes,
        status: 'recast_done',
      })
      artifacts.push(art)
    }
  } catch (e: any) {
    notes.push(`Recast failed: ${e?.message || 'unknown'}`)
  }

  // 6) BOV
  try {
    const bov = generateBovContent(L)
    const bytes = exportBovToPdf(bov, { returnBytes: true })
    if (bytes) {
      const art = await saveGeneratedDoc({
        listingId: L.id,
        dealId,
        stage: 'bov',
        title: `${L.business_name || 'Business'} — Broker Opinion of Value`,
        bytes,
        status: 'bov_done',
      })
      artifacts.push(art)
    }
  } catch (e: any) {
    notes.push(`BOV failed: ${e?.message || 'unknown'}`)
  }

  // 7) CIM
  try {
    const cim = generateCimContent(L)
    const bytes = exportCimToPdf(cim, { returnBytes: true })
    if (bytes) {
      const art = await saveGeneratedDoc({
        listingId: L.id,
        dealId,
        stage: 'cim',
        title: `${L.business_name || 'Business'} — Confidential Information Memorandum`,
        bytes,
        status: 'cim_done',
      })
      artifacts.push(art)
    }
  } catch (e: any) {
    notes.push(`CIM failed: ${e?.message || 'unknown'}`)
  }

  // 8) BLI
  try {
    const bli = generateBliContent(L)
    const bytes = exportBliToPdf(bli, { returnBytes: true })
    if (bytes) {
      const art = await saveGeneratedDoc({
        listingId: L.id,
        dealId,
        stage: 'bli',
        title: `${L.business_name || 'Business'} — Business Listing Information`,
        bytes,
        status: 'bli_done',
      })
      artifacts.push(art)
    }
  } catch (e: any) {
    notes.push(`BLI failed: ${e?.message || 'unknown'}`)
  }

  // 9) Mark all source docs as processed
  if (sources.length) {
    await supabase
      .from('financial_documents')
      .update({ status: 'processed' })
      .eq('listing_id', L.id)
      .eq('category', 'other') // only leftover 'other' source docs
  }
  await supabase
    .from('financial_documents')
    .update({ status: 'processed' })
    .in('category', ['tax_return', 'financial_statement', 'bank_statement'])
    .eq('listing_id', L.id)

  return {
    ok: true,
    listingId: L.id,
    listingName: L.business_name || 'Business',
    artifacts,
    notes,
  }
}
