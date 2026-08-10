// =============================================================================
// lib/ai/documentAnalyzer.ts — reads and understands ANY financial document.
// -----------------------------------------------------------------------------
// SERVER-ONLY. Imports the Claude client — never import from a client bundle.
//
// Responsibilities:
//   1. Detect the universal document type (heuristic filename match + optional
//      Claude confirmation from content).
//   2. Run Claude over the extracted document text to pull structured financial
//      data (revenue, expenses, assets, liabilities), trends, patterns, ratios,
//      tags and a professional summary, for ANY of the 15 supported types.
// =============================================================================

import { complete, isClaudeConfigured, ClaudeConfigError } from '@/lib/claude/client'
import type { AgentContextPayload } from '@/types/ai'
import {
  UNIVERSAL_DOC_TYPE_INFO,
  type UniversalDocType,
  type DocumentAnalysis,
  type AnalyzedYearFinancials,
  type BalanceSnapshot,
  type FinancialRatio,
  type FinancialTrend,
} from '@/lib/ai/types'

// ---------------------------------------------------------------------------
// 1) Universal type detection — heuristic filename rules (fast, offline)
// ---------------------------------------------------------------------------
const TYPE_RULES: { type: UniversalDocType; re: RegExp }[] = [
  { type: 'tax_return_1040', re: /1040|form\s*1040|individual\s*tax/i },
  { type: 'tax_return_1120', re: /1120|form\s*1120|corporate\s*tax|1120s|c-corp\s*tax/i },
  { type: 'tax_return_1065', re: /1065|form\s*1065|partnership\s*tax|llc\s*tax/i },
  { type: 'tax_return_k1', re: /k-?1|schedule\s*k-?1|partner(?:\'|\u2019)?s\s*k-?1/i },
  { type: 'payroll_report', re: /payroll|941|w-?2|941-x/i },
  { type: 'inventory_report', re: /inventory|stock\s*count|sku/i },
  { type: 'balance_sheet', re: /balance\s*sheet|statement\s*of\s*financial\s*position/i },
  { type: 'cash_flow', re: /cash\s*flow|statement\s*of\s*cash/i },
  { type: 'bank_statement', re: /bank\s*stmnt|bank\s*statement|statement\s*of\s*account|\.qfx|\.ofx/i },
  { type: 'sales_report', re: /sales\s*report|revenue\s*report|sales\s*by\s*/i },
  { type: 'ap_report', re: /accounts?\s*payable|ap\s*aging|ap\s*report|payables|ap\s*overview/i },
  { type: 'ar_report', re: /accounts?\s*receivable|ar\s*report|receivables|aging/i },
  { type: 'financial_projections', re: /projection|pro\s*forma|financial\s*projection/i },
  { type: 'budget_report', re: /budget/i },
  { type: 'forecast_report', re: /forecast/i },
  { type: 'business_plan', re: /business\s*plan/i },
  { type: 'executive_summary', re: /executive\s*summary|overview\s*sheet/i },
  { type: 'pnl', re: /pnl|p&l|profit\s*(and|&)\s*loss|income\s*statement|trial\s*balance/i },
]

/**
 * Heuristic filename detection of the universal document type. Returns the
 * best-match type (or 'pnl' fallback → 'other' if nothing matches).
 */
export function detectUniversalDocType(fileName: string): UniversalDocType {
  const n = fileName.toLowerCase()
  for (const rule of TYPE_RULES) {
    if (rule.re.test(n)) return rule.type
  }
  // Tax returns often named by year only
  if (/tax|return/i.test(n)) return 'tax_return_1120'
  // Nothing matched — default to the generic income-statement bucket.
  return 'pnl'
}

export function universalDocLabel(type: UniversalDocType): string {
  return UNIVERSAL_DOC_TYPE_INFO[type].label
}

// ---------------------------------------------------------------------------
// 2) Raw text extraction from common container formats (server-side)
// ---------------------------------------------------------------------------
const PDF_HEADER_RE = /(?:%PDF-|1\.pdf$|\.pdf$)/i

// Heuristic: keep the raw text window we send to Claude bounded but useful.
const MAX_DOC_CHARS = 20_000

export function truncateForClaude(text: string): { text: string; truncated: boolean } {
  const truncated = text.length > MAX_DOC_CHARS
  const slice = truncated
    ? // Keep the head (usually headers), a middle ring, and the tail (balances/summary).
      text.slice(0, 9000) + '\n[...truncated ' + (text.length - MAX_DOC_CHARS) + ' chars...]\n' + text.slice(-9000)
    : text
  return { text: slice, truncated }
}

// If the file is a plain text/CSV (mime text/* or extension .txt/.csv), read
// directly. PDFs and Office files are out of scope for pure text extraction —
// we handle via API-route-provided text or skip with a note.
export function isPlainTextType(mime: string | null, fileName: string): boolean {
  const m = mime || ''
  const n = fileName.toLowerCase()
  return (
    m.startsWith('text/') ||
    /\.(txt|csv|tsv|log|json|xml|html|htm)$/.test(n)
  )
}

// ---------------------------------------------------------------------------
// 3) Claude analysis — build the extraction prompt for ANY doc type
// ---------------------------------------------------------------------------
const NORMALIZED_TYPES: UniversalDocType[] = [
  'tax_return_1040', 'tax_return_1120', 'tax_return_1065', 'tax_return_k1',
  'pnl', 'balance_sheet', 'cash_flow', 'bank_statement', 'sales_report',
  'ap_report', 'ar_report', 'payroll_report', 'inventory_report',
  'financial_projections', 'business_plan', 'executive_summary',
  'budget_report', 'forecast_report',
]

function typeHintsFor(docType: UniversalDocType): string {
  const labels = NORMALIZED_TYPES.map((t) => UNIVERSAL_DOC_TYPE_INFO[t].label).join('\n- ')
  return `Detected type: "${UNIVERSAL_DOC_TYPE_INFO[docType].label}".\nAll supported types:\n- ${labels}`
}

/**
 * Runs Claude over a document's text, producing a structured analysis that maps
 * into the shared DocumentAnalysis shape (numeric, broker-grade).
 */
export async function analyzeDocumentText({
  fileName,
  text,
  hints = {},
}: {
  fileName: string
  text: string
  hints?: { guessedType?: UniversalDocType }
}): Promise<DocumentAnalysis> {
  if (!isClaudeConfigured()) {
    throw new ClaudeConfigError()
  }

  const guess = hints?.guessedType || detectUniversalDocType(fileName)
  const { text: bounded, truncated } = truncateForClaude(text || '')

  const system = [
    'You are a senior business-broker financial analyst. Extract structured financial data from the supplied document text with high precision and conservative, defensible judgment.',
    'Return ONLY valid JSON matching the exact schema below. Never invent figures that are not present in the document — leave a field null when the value is not present in the text.',
    'Numbers must be plain integers (no commas, no currency symbols). Convert to the document currency if unambiguous, otherwise assume USD.',
    'Sum the clearest "total revenue / gross sales / receipts" line for revenueTotal; total expenses including COGS+opex for expenseTotal; explicit asset and liability totals where the document states them.',
    typeHintsFor(guess),
    'Use the FILENAME and first ~600 chars of content to set "tags" and "keyMetrics" (e.g. periods covered, entity, fiscal year).',
  ].join('\n\n')

  const prompt = `Document file: ${fileName}\n\nFirst 600 chars of the document:\n${bounded.slice(0, 600)}\n\nFULL DOCUMENT TEXT:\n${bounded}\n\nReturn JSON:\n{\n "type": "<UniversalDocType from the supported list; confirm or correct the detected type>",\n "confidence": 0-1,\n "revenueTotal": int|null,\n "expenseTotal": int|null,\n "assets": int|null,\n "liabilities": int|null,\n "years": [ { "year": int, "label": string|null, "revenue": int|null, "cogs": int|null, "grossProfit": int|null, "operatingExpenses": int|null, "ownerComp": int|null, "depreciation": int|null, "interest": int|null, "otherExpenses": int|null, "netIncome": int|null } ],\n "balances": [ { "asOf": string, "cash": int|null, "accountsReceivable": int|null, "inventory": int|null, "totalAssets": int|null, "accountsPayable": int|null, "debt": int|null, "totalLiabilities": int|null, "equity": int|null } ],\n "ratios": [ { "name": string, "value": string, "benchmark": string, "healthy": bool, "note": string } ],\n "trends": [ { "label": string, "value": string, "direction": "up"|"down"|"flat", "note": string } ],\n "tags": [string],\n "keyMetrics": { string: string|number },\n "summary": "2-3 sentence professional summary"}`

  const context: AgentContextPayload = { kind: 'document', entityId: fileName, text: prompt }

  const res = await complete({
    context,
    system,
    jsonMode: true,
    maxTokens: 2400,
  })

  const d = (res.data || {}) as Record<string, unknown>

  const type = isValidUniversalType(d.type as string) ? (d.type as UniversalDocType) : guess
  const ratios = normalizeRatios(d.ratios)
  const trends = normalizeTrends(d.trends)

  // Derived metrics: SDE & EBITDA from the best year (or annualized totals).
  const rawD = d as Record<string, unknown>
  const sde = computeDerivedSde(d.years, d.expenses, typeof rawD.revenueTotal === 'number' ? rawD.revenueTotal : null)
  const ebitda = computeDerivedEbitda(d.years, typeof rawD.sde === 'number' ? rawD.sde : undefined, d.expenses)

  return {
    fileName,
    type,
    typeLabel: UNIVERSAL_DOC_TYPE_INFO[type].label,
    confidence: clamp01(num(d.confidence, 0.7)),
    revenueTotal: intOrNull(d.revenueTotal),
    expenseTotal: intOrNull(d.expenseTotal),
    assets: intOrNull(d.assets),
    liabilities: intOrNull(d.liabilities),
    sde,
    ebitda,
    years: normalizeYears(d.years),
    balances: normalizeBalances(d.balances),
    ratios,
    trends,
    tags: (Array.isArray(d.tags) ? d.tags : []).map(String).slice(0, 12),
    keyMetrics: (d.keyMetrics && typeof d.keyMetrics === 'object' ? d.keyMetrics as Record<string, string | number> : {}),
    summary: typeof d.summary === 'string' ? d.summary : '',
    raw: bounded.slice(-600),
  }
}

// -- normalization helpers ----------------------------------------------------
function isValidUniversalType(v: unknown): v is UniversalDocType {
  return typeof v === 'string' && (NORMALIZED_TYPES as string[]).includes(v)
}
const num = (v: unknown, fb = 0): number => (typeof v === 'number' && isFinite(v) ? v : fb)
const intOrNull = (v: unknown): number | null => {
  const n = Number(v)
  return (v !== null && v !== undefined && !isNaN(n) && isFinite(n)) ? Math.round(n) : null
}
const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

function normalizeYears(v: unknown): AnalyzedYearFinancials[] {
  if (!Array.isArray(v)) return []
  return v.slice(0, 8).map((r: any) => ({
    year: num(r?.year, 0),
    label: r?.label != null ? String(r.label) : undefined,
    revenue: intOrNull(r?.revenue),
    cogs: intOrNull(r?.cogs),
    grossProfit: intOrNull(r?.grossProfit),
    operatingExpenses: intOrNull(r?.operatingExpenses),
    ownerComp: intOrNull(r?.ownerComp),
    depreciation: intOrNull(r?.depreciation),
    interest: intOrNull(r?.interest),
    otherExpenses: intOrNull(r?.otherExpenses),
    netIncome: intOrNull(r?.netIncome),
  })).filter((y) => y.year > 1980)
}

function normalizeBalances(v: unknown): BalanceSnapshot[] {
  if (!Array.isArray(v)) return []
  return v.slice(0, 4).map((r: any) => ({
    asOf: r?.asOf ? String(r.asOf) : '',
    cash: intOrNull(r?.cash),
    accountsReceivable: intOrNull(r?.accountsReceivable),
    inventory: intOrNull(r?.inventory),
    totalAssets: intOrNull(r?.totalAssets),
    accountsPayable: intOrNull(r?.accountsPayable),
    debt: intOrNull(r?.debt),
    totalLiabilities: intOrNull(r?.totalLiabilities),
    equity: intOrNull(r?.equity),
    workingCapital: (r?.accountsReceivable != null && r?.inventory != null && r?.accountsPayable != null)
      ? intOrNull(null) : undefined,
  }))
}

function normalizeRatios(v: unknown): FinancialRatio[] {
  if (!Array.isArray(v)) return []
  return v.slice(0, 12).map((r: any) => ({
    name: r?.name ? String(r.name) : '',
    value: r?.value ? String(r.value) : '',
    benchmark: r?.benchmark ? String(r.benchmark) : '',
    healthy: Boolean(r?.healthy),
    note: r?.note ? String(r.note) : '',
  })).filter((r) => r.name)
}

function normalizeTrends(v: unknown): FinancialTrend[] {
  if (!Array.isArray(v)) return []
  return v.slice(0, 10).map((r: any) => ({
    label: r?.label ? String(r.label) : '',
    value: r?.value ? String(r.value) : '',
    direction: (r?.direction === 'up' || r?.direction === 'down') ? r.direction : 'flat',
    note: r?.note ? String(r.note) : '',
  })).filter((r) => r.label)
}

// Broker-grade derived SDE from the richest year: net income + owner comp +
// depreciation + interest, falling back to revenue-margin proxy.
function computeDerivedSde(years: unknown, _expenses: unknown, revenueTotal: number | null): number {
  const ys = normalizeYears(years)
  const best = ys.slice().sort((a, b) => (b.netIncome ?? 0) - (a.netIncome ?? 0))[0]
  if (best && best.netIncome != null) {
    return Math.max(0,
      best.netIncome + (best.ownerComp ?? 0) + (best.depreciation ?? 0) + (best.interest ?? 0))
  }
  if (revenueTotal) return Math.round(revenueTotal * 0.20) // conservative default margin
  return 0
}

function computeDerivedEbitda(years: unknown, sde: number | undefined, _expenses: unknown): number {
  const ys = normalizeYears(years)
  const best = ys.slice().sort((a, b) => (b.netIncome ?? 0) - (a.netIncome ?? 0))[0]
  if (best && best.netIncome != null) {
    return Math.max(0,
      best.netIncome + (best.depreciation ?? 0) + (best.interest ?? 0))
  }
  if (sde != null) return Math.max(0, sde) // owner comp already folded
  return 0
}
