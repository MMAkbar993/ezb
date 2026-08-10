import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { FF_BUCKET } from '@/lib/financialFiles'
import { analyzeDocumentText, detectUniversalDocType } from '@/lib/ai/documentAnalyzer'
import { extractDocumentText, isPlainTextType } from '@/lib/ai/textExtract'
import { mergeAnalyses, type AiExtractionOutput } from '@/lib/ai/financialExtractor'
import { generateFinancialSummary, type FinancialSummaryReport } from '@/lib/ai/summaryGenerator'
import type { FinancialIntelligence, DocumentAnalysis } from '@/lib/ai/types'

export const runtime = 'nodejs'

const schema = z.object({ listingId: z.string().uuid() })

function bearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  return m ? m[1] : null
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  if (!supabase) return NextResponse.json({ ok: false, error: 'Server client not configured.' }, { status: 500 })

  const token = bearerToken(req)
  if (!token) return NextResponse.json({ ok: false, error: 'Missing authorization header.' }, { status: 401 })
  const { data: auth, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !auth?.user) return NextResponse.json({ ok: false, error: 'Invalid or expired session.' }, { status: 401 })

  let parsed: z.infer<typeof schema>
  try {
    parsed = schema.parse(await req.json())
  } catch {
    return NextResponse.json({ ok: false, error: 'Validation failed: listingId (uuid) required.' }, { status: 422 })
  }
  const { listingId } = parsed

  // 1) Load listing
  const { data: listing, error: lErr } = await supabase
    .from('listings').select('id, business_name, asking_price, annual_revenue, sde, ebitda').eq('id', listingId).maybeSingle()
  if (lErr || !listing) {
    return NextResponse.json({ ok: false, error: 'Listing not found.' }, { status: 404 })
  }
  const name = listing.business_name || 'Business'

  // 2) Load source financial documents
  const { data: docs, error: dErr } = await supabase
    .from('financial_documents')
    .select('*')
    .eq('listing_id', listingId)
    .neq('category', 'generated_document')
    .limit(30)
  if (dErr) return NextResponse.json({ ok: false, error: 'Failed to load documents.' }, { status: 500 })
  const sourceDocs = (docs || []) as any[]

  // 3) Download + extract text for each
  const analyses: DocumentAnalysis[] = []
  for (const doc of sourceDocs) {
    const storagePath = doc.storage_path || doc.file_url
    if (!storagePath || storagePath.startsWith('http')) {
      // Already public URL with no storage path — skip, or note.
      const fallback = await analyzeFileNameOnly(doc.file_name)
      if (fallback) analyses.push(fallback)
      continue
    }
    const { data: blob, error: dlErr } = await supabase.storage
      .from(FF_BUCKET)
      .download(storagePath)
    if (dlErr || !blob) continue

    const buf = Buffer.from(await blob.arrayBuffer())
    const extracted = await extractDocumentText({
      fileName: doc.file_name,
      mime: doc.mime_type,
      data: buf,
    })

    if (extracted.text.trim()) {
      try {
        const analysis = await analyzeDocumentText({
          fileName: doc.file_name,
          text: extracted.text,
          hints: { guessedType: detectUniversalDocType(doc.file_name) },
        })
        analyses.push(analysis)
        continue
      } catch {
        // Claude unavailable/failed → fall through to heuristic analysis
      }
    }
    const fallback = await analyzeFileNameOnly(doc.file_name)
    if (fallback) analyses.push(fallback)
  }

  // 4) Merge into broker-grade extraction
  const ext: AiExtractionOutput = mergeAnalyses({
    listingId,
    listingName: name,
    analyses,
    askingPrice: listing.asking_price || 0,
  })

  // 5) Generate comprehensive financial summary
  const report: FinancialSummaryReport = await generateFinancialSummary(ext, name)

  // 6) Assemble the intelligence bundle
  const intelligence: FinancialIntelligence = {
    listingId,
    listingName: name,
    documents: ext.documents,
    revenueByYear: ext.revenueByYear,
    expenses: {},
    sde: ext.sde,
    ebitda: ext.ebitda,
    addBacks: ext.addBacks,
    sdeMultipleLow: ext.sdeMultipleLow,
    sdeMultipleHigh: ext.sdeMultipleHigh,
    valueRangeLow: ext.valueRangeLow,
    valueRangeHigh: ext.valueRangeHigh,
    ratios: ext.ratios,
    trends: ext.trends,
    workingCapital: ext.workingCapital,
    debt: ext.debt,
    summary: report.executiveSummary,
    generatedAt: report.generatedAt,
  }

  return NextResponse.json({
    ok: true,
    listingId,
    listingName: name,
    extraction: ext,
    report,
    intelligence,
  })
}

/**
 * Heuristic, Claude-free analysis for a doc where no text could be read
 * (binary/office/image) — still yields type detection + smart tags.
 */
async function analyzeFileNameOnly(fileName: string): Promise<DocumentAnalysis | null> {
  if (!fileName) return null
  const type = detectUniversalDocType(fileName)
  const yearMatch = fileName.match(/(19|20)\d{2}/)
  return {
    fileName,
    type,
    typeLabel: type,
    confidence: 0.5,
    revenueTotal: 0,
    expenseTotal: 0,
    assets: 0,
    liabilities: 0,
    sde: 0,
    ebitda: 0,
    years: [],
    balances: [],
    ratios: [],
    trends: [],
    tags: [type.replace(/_/g, ' '), 'no-parseable-text', yearMatch ? `FY ${yearMatch[0]}` : ''].filter(Boolean),
    keyMetrics: { parsed: 'no' },
    summary: `Document "${fileName}" could not be text-extracted server-side (likely a scanned/Office file). Type inferred from filename.`,
    raw: '',
  }
}
