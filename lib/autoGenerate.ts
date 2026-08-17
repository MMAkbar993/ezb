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
  groupUploadedDocs,
} from '@/lib/financialExtractor'
import type { FinancialStatus, FinancialDoc } from '@/lib/financialFiles'
// Imported from the boundary-neutral constants module, not from
// lib/financialFiles.ts (which is 'use client') — see lib/storageBuckets.ts
// for why that distinction matters for a server-only module like this one.
import { FF_BUCKET } from '@/lib/storageBuckets'
import { analyzeDocumentText, detectUniversalDocType } from '@/lib/ai/documentAnalyzer'
import { extractDocumentText } from '@/lib/ai/textExtract'
import { mergeAnalyses, aiYearsToRecastInput, type AiExtractionOutput } from '@/lib/ai/financialExtractor'
import type { DocumentAnalysis } from '@/lib/ai/types'
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
// Financial extraction — reads the ACTUAL content of every uploaded source
// document (tax returns, P&L / financial statements, balance sheets, bank
// statements): download from storage, extract text, have Claude analyze
// each one, then combine them into a single broker-grade figure set (same
// merge used by the Universal Financial Intelligence route). This is what
// "P&L and balance sheets need to be recast... with all those financial
// combined" means in practice — every uploaded document folds into one
// normalized history instead of being ignored in favor of guesswork.
// Falls back to nothing (caller uses the listing's own manually entered
// figures) when no document could be read — never fabricates numbers.
// ---------------------------------------------------------------------------
async function extractFromDocuments(
  supabase: NonNullable<ReturnType<typeof createServerClient>>,
  listing: Listing,
  docs: FinancialDoc[],
): Promise<{ ext: AiExtractionOutput | null; notes: string }> {
  const analyses: DocumentAnalysis[] = []

  for (const doc of docs) {
    if (!doc.storage_path) continue
    try {
      const { data: blob, error: dlErr } = await supabase.storage.from(FF_BUCKET).download(doc.storage_path)
      if (dlErr || !blob) continue
      const buf = Buffer.from(await blob.arrayBuffer())
      const extracted = await extractDocumentText({ fileName: doc.file_name, mime: doc.mime_type, data: buf })
      if (!extracted.text.trim()) continue
      const analysis = await analyzeDocumentText({
        fileName: doc.file_name,
        text: extracted.text,
        hints: { guessedType: detectUniversalDocType(doc.file_name) },
      })
      analyses.push(analysis)
    } catch {
      /* unreadable/failed doc — skip it, non-fatal */
    }
  }

  if (!analyses.length) {
    return { ext: null, notes: 'No financial document content could be read — used the listing’s own figures.' }
  }

  const ext = mergeAnalyses({
    listingId: listing.id,
    listingName: listing.business_name || 'Business',
    analyses,
    askingPrice: listing.asking_price || 0,
    industry: listing.industry || null,
  })
  return { ext, notes: `Extracted and combined ${analyses.length} source document(s) (P&L, balance sheet, tax return, bank statements) into the recast.` }
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
  // Only the BOV and CIM are meant for buyer eyes ("we only share financial,
  // CIM and BOV to buyer") — Recast and the BLI stay broker/seller-internal
  // by default. The broker can still flip visibility manually afterward.
  const visibleToBuyer = step.stage === 'bov' || step.stage === 'cim'
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
      visible_to_buyer: visibleToBuyer,
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
// ---------------------------------------------------------------------------
// Read-only preview: the same real-document extraction runAutoGeneration
// uses (steps 1-4 below), with no generation and no writes. Lets the
// standalone Recast tool (components/recast/RecastStudio.tsx) start from a
// listing's actual uploaded financials instead of a blank form — previously
// it had no way to see what the AI pipeline actually extracted, so its
// numbers could legitimately disagree with the BOV/CIM the pipeline produced.
// ---------------------------------------------------------------------------
export async function getRecastPreview(listingId: string): Promise<{ ok: boolean; error?: string; businessName?: string; history?: YearFinancials[] }> {
  const supabase = createServerClient()
  if (!supabase) return { ok: false, error: 'Supabase server client not configured' }

  const { data: listing, error: listingErr } = await supabase.from('listings').select('*').eq('id', listingId).single()
  if (listingErr || !listing) return { ok: false, error: `Listing not found: ${listingErr?.message || listingId}` }
  const L = listing as Listing

  const { data: sourceDocs, error: sourceErr } = await supabase
    .from('financial_documents')
    .select('*')
    .eq('listing_id', listingId)
  if (sourceErr) return { ok: false, error: sourceErr.message }
  const sources = ((sourceDocs as FinancialDoc[] | null) || []).filter((d) => d.category !== 'generated_document')

  const { ext } = await extractFromDocuments(supabase, L, sources)
  const history: YearFinancials[] = ext && ext.revenueByYear.length ? aiYearsToRecastInput(ext) : buildFinancialHistory(L, [])

  return { ok: true, businessName: L.business_name || '', history }
}

// ---------------------------------------------------------------------------
// Resolve the preparing agent's display name + brokerage name for BOV/CIM
// attribution. Prefers the agent's own public profile (broker_profiles),
// falls back to their account name; brokerage comes from broker_profiles'
// agency link. Never throws — a listing with no agent, or an agent with no
// profile/agency set up yet, just gets undefined (export functions fall
// back to today's defaults).
// ---------------------------------------------------------------------------
async function resolvePreparedBy(
  supabase: NonNullable<ReturnType<typeof createServerClient>>,
  agentId: string | null,
): Promise<{ preparedByName?: string; preparedByBrokerage?: string }> {
  if (!agentId) return {}
  try {
    const [{ data: profile }, { data: brokerProfile }] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', agentId).maybeSingle(),
      supabase.from('broker_profiles').select('public_name, agency_id').eq('profile_id', agentId).maybeSingle(),
    ])
    const preparedByName = brokerProfile?.public_name || profile?.full_name || undefined
    let preparedByBrokerage: string | undefined
    if (brokerProfile?.agency_id) {
      const { data: agency } = await supabase.from('agencies').select('name').eq('id', brokerProfile.agency_id).maybeSingle()
      preparedByBrokerage = agency?.name || undefined
    }
    return { preparedByName, preparedByBrokerage }
  } catch {
    return {}
  }
}

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

  // 1b) Resolve who's preparing this document — "Prepared by [Agent] —
  //     [Brokerage]" on the BOV/CIM cover/footer. Falls back to the current
  //     defaults (handled by the export functions themselves) when the
  //     listing has no agent, or the agent has no public profile/agency yet.
  const attribution = await resolvePreparedBy(supabase, L.agent_id)

  // 2) Load existing source financial docs for this listing. `deal_id` is a
  //    uuid column — only add the deal_id.eq clause when we actually have one
  //    (a literal 'none' fallback previously caused a Postgres uuid-cast
  //    error, 22P02, which silently emptied `sourceDocs` since the query
  //    error wasn't checked — every real upload was being ignored).
  const sourceFilter = dealId
    ? `listing_id.eq.${input.listingId},deal_id.eq.${dealId}`
    : `listing_id.eq.${input.listingId}`
  const { data: sourceDocs, error: sourceErr } = await supabase
    .from('financial_documents')
    .select('*')
    .or(sourceFilter)
  if (sourceErr) notes.push(`Could not load source documents: ${sourceErr.message}`)
  const sources = ((sourceDocs as FinancialDoc[] | null) || []).filter((d) => d.category !== 'generated_document')
  const grouped = groupUploadedDocs(sources)

  // ROOT-CAUSE FIX: previously, generation always proceeded even with zero
  // uploaded documents AND zero manually-entered figures — buildFinancialHistory
  // (financialExtractor.ts) and bov.ts's buildHistory would both fabricate a
  // full 3-4 year revenue/SDE/EBITDA trend from nothing, and generation would
  // "succeed" with entirely invented numbers. Hard-stop here instead: if there
  // is no real source (no uploaded financial documents and no manually
  // entered revenue/SDE/EBITDA on the listing), refuse to generate rather
  // than inventing figures.
  const hasManualFigures = !!(L.annual_revenue || L.sde || L.ebitda)
  if (sources.length === 0 && !hasManualFigures) {
    return {
      ok: false,
      listingId: input.listingId,
      listingName: L.business_name || '',
      error: 'No financial data available for this listing. Upload financial documents (tax returns, P&L, bank statements) or enter Revenue/SDE/EBITDA on the listing before generating Recast/BOV/CIM/BLI.',
      artifacts: [],
      notes: ['Generation was not attempted — no uploaded financial documents and no manually entered financial figures were found.'],
    }
  }

  // 3) Extract financial data from the actual content of every uploaded
  //    source document (P&L, balance sheet, tax return, bank statements),
  //    combined into one figure set.
  const { ext, notes: extractNotes } = await extractFromDocuments(supabase, L, sources)
  if (extractNotes) notes.push(extractNotes)

  // 4) Build 3-year financial history: prefer the real extracted figures;
  //    fall back to the listing's own manually entered numbers only when
  //    nothing could be read from the uploaded documents.
  const history: YearFinancials[] = ext && ext.revenueByYear.length
    ? aiYearsToRecastInput(ext)
    : buildFinancialHistory(L, [])

  // Enrich the listing snapshot fed into BOV/CIM/BLI with the extracted
  // figures wherever the listing itself has no manually entered value — so
  // a business whose revenue/SDE/EBITDA were never typed into the listing
  // (e.g. uploaded via "New business, not listed yet") still produces
  // documents grounded in its real uploaded financials.
  const L2: Listing = ext
    ? {
        ...L,
        annual_revenue: L.annual_revenue ?? (ext.revenueTotal || null),
        sde: L.sde ?? (ext.sde || null),
        ebitda: L.ebitda ?? (ext.ebitda || null),
      }
    : L

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
    const bov = generateBovContent(L2, attribution)
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
    const cim = generateCimContent(L2, attribution)
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
    const bli = generateBliContent(L2)
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
