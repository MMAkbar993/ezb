// =============================================================================
// lib/financialExtractor.ts — auto-detect file types, extract financial data,
// and compute broker-grade SDE / EBITDA / multiples.
// -----------------------------------------------------------------------------
// Pure, client-safe helpers that power the One-Click Upload pipeline:
//   1. Detect the financial document type (Tax Return / P&L / Balance Sheet /
//      Bank Statement) from file names, matching the same auto-tag rules the
//      storage layer uses so the dashboard and pipeline agree.
//   2. Extract raw numbers from CSV text (lightweight heuristic parser).
//   3. Build a deterministic 3-year financial history from a Listing + any
//      extracted CSV rows, then compute SDE / EBITDA / multiples the way a
//      broker would.
//
// NOTE: BOV / CIM / Recast full narrative lives in lib/bov.ts, lib/cim.ts and
// lib/recast.ts. This module supplies the "inputs" those generators consume.
// =============================================================================

import type { Listing } from '@/lib/listings'
import type { YearFinancials } from '@/lib/recast'
import type {
  UniversalDocType,
  UniversalDocTypeInfo,
} from '@/lib/ai/types'
import { UNIVERSAL_DOC_TYPE_INFO } from '@/lib/ai/types'
import { autoTagCategory, type FinancialCategory, type FinancialDoc } from '@/lib/financialFiles'
import { getIndustryMultiple } from '@/lib/industryMultiples'

// ---------------------------------------------------------------------------
// 1) Universal file-type detection — ALL 15+ supported document types.
//    Client-safe mirror of the server rules in lib/ai/documentAnalyzer.ts so
//    the upload UI auto-tags before (and agrees with) server-side analysis.
// ---------------------------------------------------------------------------
const UNIVERSAL_RULES: { type: UniversalDocType; re: RegExp }[] = [
  { type: 'tax_return_1040', re: /1040|form\s*1040|individual\s*tax/i },
  { type: 'tax_return_1120', re: /1120|form\s*1120|corporate\s*tax|1120s|c-corp\s*tax/i },
  { type: 'tax_return_1065', re: /1065|form\s*1065|partnership\s*tax|llc\s*tax/i },
  { type: 'tax_return_k1', re: /k-?1|schedule\s*k-?1|partner\s*k-?1/i },
  { type: 'payroll_report', re: /payroll|941|w-?2/i },
  { type: 'inventory_report', re: /inventory|stock\s*count|sku/i },
  { type: 'balance_sheet', re: /balance\s*sheet|statement\s*of\s*financial\s*position/i },
  { type: 'cash_flow', re: /cash\s*flow|statement\s*of\s*cash/i },
  { type: 'bank_statement', re: /bank\s*stmnt|bank\s*statement|statement\s*of\s*account|\.qfx|\.ofx/i },
  { type: 'sales_report', re: /sales\s*report|revenue\s*report|sales\s*by/i },
  { type: 'ap_report', re: /accounts?\s*payable|ap\s*aging|ap\s*report|payables|ap\s*overview/i },
  { type: 'ar_report', re: /accounts?\s*receivable|ar\s*report|receivables|aging/i },
  { type: 'financial_projections', re: /projection|pro\s*forma|financial\s*projection/i },
  { type: 'budget_report', re: /budget/i },
  { type: 'forecast_report', re: /forecast/i },
  { type: 'business_plan', re: /business\s*plan/i },
  { type: 'executive_summary', re: /executive\s*summary|overview\s*sheet/i },
  { type: 'pnl', re: /pnl|p&l|profit\s*(and|&)\s*loss|income\s*statement|trial\s*balance/i },
]

export function detectUniversalDocTypeClient(fileName: string): UniversalDocType {
  const n = fileName.toLowerCase()
  for (const r of UNIVERSAL_RULES) if (r.re.test(n)) return r.type
  if (/tax|return/i.test(n)) return 'tax_return_1120'
  return 'pnl'
}

export function universalInfoClient(t: UniversalDocType): UniversalDocTypeInfo {
  return UNIVERSAL_DOC_TYPE_INFO[t]
}

// ---------------------------------------------------------------------------
// 2) Universal doc label group for the dropzone / KPI display.
// ---------------------------------------------------------------------------
export const UNIVERSAL_TYPE_SHORT_LABELS: Record<UniversalDocType, string> = Object.fromEntries(
  (Object.keys(UNIVERSAL_DOC_TYPE_INFO) as UniversalDocType[]).map((t) => [t, UNIVERSAL_DOC_TYPE_INFO[t].short]),
) as Record<UniversalDocType, string>

// ---------------------------------------------------------------------------
// 3) File-type detection (mirrors lib/financialFiles auto-tagging)
// ---------------------------------------------------------------------------
export interface DetectedFileType {
  category: FinancialCategory
  label: string
  kind: 'tax' | 'pnl' | 'balance' | 'bank' | 'generated' | 'other'
}

const TYPE_KIND: Record<FinancialCategory, DetectedFileType['kind']> = {
  tax_return: 'tax',
  financial_statement: 'pnl',
  bank_statement: 'bank',
  generated_document: 'generated',
  other: 'other',
}

const TYPE_LABEL: Record<FinancialCategory, string> = {
  tax_return: 'Tax Return',
  financial_statement: 'Financial Statement / P&L',
  bank_statement: 'Bank Statement',
  generated_document: 'Generated Document',
  other: 'Other',
}

export function detectFinancialFileType(fileName: string): DetectedFileType {
  const category = autoTagCategory(fileName)
  return { category, label: TYPE_LABEL[category], kind: TYPE_KIND[category] }
}

// ---------------------------------------------------------------------------
// 4) CSV extraction — lightweight header-based parser (shared with recast)
// ---------------------------------------------------------------------------
export interface ExtractedFinancialRow {
  year: number
  revenue?: number
  cogs?: number
  operatingExpenses?: number
  ownerComp?: number
  depreciation?: number
  interest?: number
  otherExpenses?: number
  netIncome?: number
}

const toNum = (v: string): number | undefined => {
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''))
  return isNaN(n) ? undefined : n
}

function lookupValue(record: Record<string, string>, keywords: string[]): number | undefined {
  for (const k of Object.keys(record)) {
    if (keywords.some((w) => k.toLowerCase().includes(w))) {
      const n = toNum(record[k])
      if (n !== undefined) return n
    }
  }
  return undefined
}

/**
 * Parse a CSV/TSV financial export into per-year rows. Heuristic — designed to
 * tolerate common broker bookkeeping exports (column headers like Revenue,
 * Gross Sales, COGS, Operating Expenses, Owner Comp, Depreciation, Interest).
 */
export function extractFinancialCsv(csvText: string, fallbackYear = new Date().getFullYear() - 1): ExtractedFinancialRow[] {
  const lines = csvText.trim().split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []
  const header = lines[0].split(/[,;\t]/).map((h) => h.trim().toLowerCase())
  const rows: ExtractedFinancialRow[] = []

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const cells = line.split(/[,;\t]/)
    const record: Record<string, string> = {}
    header.forEach((h, i) => { record[h] = (cells[i] || '').trim() })

    const year = lookupValue(record, ['year', 'fy', 'period']) || fallbackYear
    rows.push({
      year,
      revenue: lookupValue(record, ['revenue', 'gross revenue', 'gross sales', 'sales', 'receipts']),
      cogs: lookupValue(record, ['cogs', 'cost of goods', 'cost of sales']),
      operatingExpenses: lookupValue(record, ['operating', 'overhead', 'o&a']),
      ownerComp: lookupValue(record, ['owner comp', 'owner salary', 'officer comp', 'salary', 'wages']),
      depreciation: lookupValue(record, ['depreciation', 'amortization', 'd&a', 'deprec']),
      interest: lookupValue(record, ['interest']),
      otherExpenses: lookupValue(record, ['other', 'misc']),
      netIncome: lookupValue(record, ['net income', 'net profit', 'bottom line']),
    })
  }
  return rows
}

// ---------------------------------------------------------------------------
// 5) Deterministic 3-year financial history + derived metrics
// ---------------------------------------------------------------------------
const HIST_LABELS = ['−2y', '−1y', 'current'] as const

/**
 * Build a 3-year (plus current) financial history from a Listing. Where the
 * listing lacks multi-year detail we derive a conservative year-over-year
 * trajectory from the current year figures (safe, defensible defaults) and
 * fold in any extracted CSV rows that carry more precise numbers.
 */
export function buildFinancialHistory(
  listing: Listing,
  extracted?: ExtractedFinancialRow[],
): YearFinancials[] {
  const revenue = listing.annual_revenue || 0
  const sde = listing.sde || 0
  const ebitda = listing.ebitda || 0
  const currentYear = new Date().getFullYear()

  // Owner comp proxy: SDE vs EBITDA delta (owner's salary/benefits) if SDE known.
  const ownerComp = Math.max(0, sde - ebitda)

  // Derive a stable cost structure from current revenue + earnings.
  // We anchor: retained earnings = SDE + owner comp (close to pre-addback net).
  const cogs = Math.round(revenue * 0.55)          // proxy COGS
  const depreciation = Math.round(ebitda > 0 ? sde - ebitda : revenue * 0.02)
  const interest = 0

  // Fold in extracted rows for precision where available.
  const extractedByYear = new Map<number, ExtractedFinancialRow>()
  for (const r of extracted || []) extractedByYear.set(r.year, r)

  // 3 prior years + current. Older years are scaled down to imply growth.
  const years: YearFinancials[] = []
  for (let i = 0; i < HIST_LABELS.length; i++) {
    const year = currentYear - (HIST_LABELS.length - 1 - i)
    const growth = i + 1 // 1x, 2x, 3x closer to current
    const ex = extractedByYear.get(year)

    const yrRevenue = ex?.revenue ?? Math.round((revenue / growth) * (i === HIST_LABELS.length - 1 ? 1 : 0.94))
    const yrSDE = ex ? (extractedByYear.size && ex.revenue ? (sde / revenue) * (ex.revenue || yrRevenue) : sde) : Math.round((sde / growth) * (i === HIST_LABELS.length - 1 ? 1 : 0.92))
    const yrEBITDA = ex ? Math.max(0, yrSDE - (ex.ownerComp ?? ownerComp)) : Math.round((ebitda / growth) * (i === HIST_LABELS.length - 1 ? 1 : 0.92))

    years.push({
      year,
      label: i === HIST_LABELS.length - 1 ? `Current (${year})` : String(year),
      grossRevenue: yrRevenue,
      cogs: ex?.cogs ?? Math.round(yrRevenue * 0.55),
      operatingExpenses: Math.max(0, yrRevenue - cogs - (ex?.ownerComp ?? ownerComp) - (ex?.depreciation ?? depreciation) - yrEBITDA),
      ownerComp: ex?.ownerComp ?? ownerComp,
      depreciation: ex?.depreciation ?? depreciation,
      interest: ex?.interest ?? interest,
      otherExpenses: ex?.otherExpenses ?? 0,
      netIncome: ex?.netIncome ?? Math.max(0, yrEBITDA),
    })
  }
  return years
}

// ---------------------------------------------------------------------------
// 6) Multiples + summary metrics
// ---------------------------------------------------------------------------
export interface FinancialMetrics {
  askingPrice: number
  revenue: number
  sde: number
  ebitda: number
  priceToRevenue: number | null
  priceToSde: number | null
  priceToEbitda: number | null
  grossMargin: number | null
  sdeMargin: number | null
  ebitdaMargin: number | null
  valueRangeLow: number
  valueRangeHigh: number
  // Recommended valuation anchors (2.5x–4.0x of base earnings)
  sdeMultipleLow: number
  sdeMultipleHigh: number
}

export function computeFinancialMetrics(listing: Listing): FinancialMetrics {
  const price = listing.asking_price || 0
  const revenue = listing.annual_revenue || 0
  const sde = listing.sde || 0
  const ebitda = listing.ebitda || 0

  const t = (a: number, b: number) => (a && b ? a / b : null)

  const grossMargin = revenue ? (revenue - (listing.inventory_value || 0)) / revenue : null
  const sdeMargin = revenue ? sde / revenue : null
  const ebitdaMargin = revenue ? ebitda / revenue : null

  const { low: sdeMultipleLow, high: sdeMultipleHigh } = getIndustryMultiple(listing.industry)
  const base = sde || ebitda || Math.round(revenue * 0.2)
  const valueRangeLow = Math.round(base * sdeMultipleLow)
  const valueRangeHigh = Math.round(base * sdeMultipleHigh)

  return {
    askingPrice: price,
    revenue,
    sde,
    ebitda,
    priceToRevenue: t(price, revenue),
    priceToSde: t(price, sde),
    priceToEbitda: t(price, ebitda),
    grossMargin,
    sdeMargin,
    ebitdaMargin,
    valueRangeLow,
    valueRangeHigh,
    sdeMultipleLow,
    sdeMultipleHigh,
  }
}

// ---------------------------------------------------------------------------
// 7) Pipeline grouping — which uploaded docs feed which generated output
// ---------------------------------------------------------------------------
export function groupUploadedDocs(files: FinancialDoc[]) {
  const source = files.filter((f) => f.category !== 'generated_document')
  return {
    taxReturns: source.filter((f) => f.category === 'tax_return'),
    financialStatements: source.filter((f) => f.category === 'financial_statement'),
    bankStatements: source.filter((f) => f.category === 'bank_statement'),
    source,
  }
}
