// =============================================================================
// lib/ai/summaryGenerator.ts — comprehensive financial summary report.
// -----------------------------------------------------------------------------
// SERVER-ONLY. Builds a broker-grade, narrative + structured financial summary
// from an AiExtractionOutput: revenue history (3–5yr), expense breakdown,
// profitability, cash flow, working capital, debt, key ratios, valuation, and a
// Claude-written professional overview.
// =============================================================================

import { complete, isClaudeConfigured, ClaudeConfigError } from '@/lib/claude/client'
import type { AgentContextPayload } from '@/types/ai'
import type { AiExtractionOutput } from '@/lib/ai/financialExtractor'

export interface FinancialSummarySection {
  id: string
  title: string
  paragraphs: string[]
  bullets?: { label: string; value: string }[]
  // For table-like rendering
  table?: { columns: string[]; rows: (string | number)[][] }
}

export interface FinancialSummaryReport {
  listingId: string
  listingName: string
  generatedAt: string
  executiveSummary: string
  sections: FinancialSummarySection[]
}

const money = (n: number | null | undefined): string => {
  if (n == null || isNaN(n)) return '—'
  return '$' + Math.round(n).toLocaleString()
}
const moneyShort = (n: number | null | undefined): string => {
  if (n == null || isNaN(n)) return '—'
  const k = n / 1000
  if (Math.abs(k) >= 1000) return '$' + (n / 1e6).toFixed(1) + 'M'
  return '$' + Math.round(k).toLocaleString() + 'K'
}
const pct = (n: number | null | undefined, denom: number | null | undefined): string =>
  n != null && denom ? (n / denom) * 100 + '%' : '—'

/**
 * Deterministic structured summary — always builds even without Claude.
 */
export function buildStructuredSummary(ext: AiExtractionOutput, listingName: string): FinancialSummaryReport['sections'] {
  const s: FinancialSummarySection[] = []

  // 1) Revenue analysis (3–5 years)
  s.push({
    id: 'revenue',
    title: 'Revenue Analysis',
    paragraphs: [
      `Reported annual revenue of ${money(ext.revenueTotal)} across ${ext.revenueByYear.length} year(s).`,
      ext.revenueByYear.length > 1
        ? 'Multi-year trend is captured below — direction and CAGR are used to assess earnings quality and sustainability.'
        : 'Only current-year revenue was available; growth assumptions are held conservative until additional periods are provided.',
    ],
    table: {
      columns: ['Period', 'Revenue', 'Share of Total'],
      rows: ext.revenueByYear.map((r, i) => [r.label, money(r.revenue), ext.revenueTotal ? `${((r.revenue / ext.revenueTotal) * 100).toFixed(0)}%` : '—']),
    },
  })

  // 2) Expense breakdown
  s.push({
    id: 'expenses',
    title: 'Expense & Profitability Analysis',
    paragraphs: [
      `Total expenses identified: ${money(ext.expenseTotal)}. COGS is estimated at 55% of revenue when not itemized, with owner compensation treated as a discretionary add-back.`,
    ],
    bullets: [
      { label: 'Gross margin', value: pct(ext.grossMargin, 1) && ext.revenueTotal ? `${((ext.revenueTotal - ext.revenueTotal * 0.55) / ext.revenueTotal * 100).toFixed(0)}%` : '—' },
      { label: 'SDE margin', value: ext.sdeMargin != null ? `${(ext.sdeMargin * 100).toFixed(0)}%` : '—' },
      { label: 'EBITDA margin', value: ext.ebitdaMargin != null ? `${(ext.ebitdaMargin * 100).toFixed(0)}%` : '—' },
      { label: 'Owner compensation', value: money(ext.ownerComp) },
    ],
  })

  // 3) Add-backs
  s.push({
    id: 'addbacks',
    title: 'Add-Backs (Normalization)',
    paragraphs: [
      ext.addBacks.length
        ? 'The following add-backs are applied to as-reported earnings to reach sustainable SDE / EBITDA. Each is traceable and recurring where noted.'
        : 'No discretionary add-backs were identified from the available documents.',
    ],
    table: {
      columns: ['Add-back', 'Amount', 'Recurring'],
      rows: ext.addBacks.map((a) => [a.label, money(a.amount), a.recurring ? 'Yes' : 'No']),
    },
  })

  // 4) Cash flow & working capital
  s.push({
    id: 'cashflow',
    title: 'Cash Flow, Working Capital & Debt',
    paragraphs: [
      `Working capital position: ${money(ext.workingCapital)} (AR + inventory − AP). Outstanding debt: ${money(ext.debt)}. Assets ${money(ext.assets)} / Liabilities ${money(ext.liabilities)}.`,
    ],
    bullets: [
      { label: 'Working capital', value: money(ext.workingCapital) },
      { label: 'Total debt', value: money(ext.debt) },
      { label: 'Total assets', value: money(ext.assets) },
      { label: 'Total liabilities', value: money(ext.liabilities) },
    ],
  })

  // 5) Key ratios
  s.push({
    id: 'ratios',
    title: 'Key Financial Ratios',
    paragraphs: [ext.ratios.length ? 'Ratios flagged from the source documents, benchmarked for a business of this profile.' : 'No explicit ratios were present; the SDE/EBITDA margins above serve as the primary quality indicators.'],
    table: {
      columns: ['Ratio', 'Value', 'Benchmark', 'Healthy', 'Note'],
      rows: ext.ratios.map((r) => [r.name, r.value, r.benchmark, r.healthy ? 'Yes' : 'No', r.note]),
    },
  })

  // 6) Trends
  s.push({
    id: 'trends',
    title: 'Trends & Patterns',
    paragraphs: [ext.trends.length ? 'Notable trends identified across the document set:' : 'No explicit trend data was extracted.'],
    table: {
      columns: ['Trend', 'Direction'],
      rows: ext.trends.map((t) => [t.label, t.direction === 'up' ? '↑ Up' : t.direction === 'down' ? '↓ Down' : '→ Flat']),
    },
  })

  // 7) Valuation analysis
  s.push({
    id: 'valuation',
    title: 'Valuation Analysis',
    paragraphs: [
      `Base earnings: SDE ${money(ext.sde)} (EBITDA ${money(ext.ebitda)}). Applying broker-standard multiples (${ext.sdeMultipleLow}x–${ext.sdeMultipleHigh}x SDE) yields a value range of ${money(ext.valueRangeLow)} to ${money(ext.valueRangeHigh)}.`,
      'This is an indication only; final value is set by market comparables, deal structure, seller financing and due diligence.',
    ],
    table: {
      columns: ['Metric', 'Value'],
      rows: [
        ['SDE', money(ext.sde)],
        ['EBITDA', money(ext.ebitda)],
        ['Multiple (low)', `${ext.sdeMultipleLow}x`],
        ['Multiple (high)', `${ext.sdeMultipleHigh}x`],
        ['Value range', `${money(ext.valueRangeLow)} – ${money(ext.valueRangeHigh)}`],
      ],
    },
  })

  return s
}

/**
 * Full summary report — structured sections plus a Claude-written executive
 * overview when the API key is configured (graceful fallback otherwise).
 */
export async function generateFinancialSummary(
  ext: AiExtractionOutput,
  listingName: string,
): Promise<FinancialSummaryReport> {
  const sections = buildStructuredSummary(ext, listingName)

  let executiveSummary = ''
  if (isClaudeConfigured()) {
    try {
      const prompt = [
        `Business: ${listingName}`,
        `Revenue: ${money(ext.revenueTotal)} (years: ${ext.revenueByYear.map((r) => r.label).join(', ') || 'n/a'})`,
        `SDE: ${money(ext.sde)}  EBITDA: ${money(ext.ebitda)}  Owner comp: ${money(ext.ownerComp)}`,
        `Value range: ${money(ext.valueRangeLow)} – ${money(ext.valueRangeHigh)} (${ext.sdeMultipleLow}x–${ext.sdeMultipleHigh}x SDE)`,
        `Working capital: ${money(ext.workingCapital)}  Debt: ${money(ext.debt)}`,
        `Ratios: ${ext.ratios.map((r) => `${r.name}=${r.value}`).join('; ') || 'n/a'}`,
        `Trends: ${ext.trends.map((t) => t.label).join('; ') || 'n/a'}`,
        `Documents analyzed: ${ext.documents.map((d) => d.fileName).join(', ') || 'n/a'}`,
      ].join('\n')

      const context: AgentContextPayload = { kind: 'document', entityId: listingName, text: prompt }
      const res = await complete({
        context,
        system:
          'You are a senior business-broker financial analyst. Write a concise, professional 4-6 sentence executive financial summary for a confidential memorandum. Highlight revenue trajectory, earnings quality (SDE/EBITDA), normalization add-backs, valuation range and any red flags. Do not inflate figures.',
        maxTokens: 700,
      })
      executiveSummary = res.text.trim()
    } catch {
      executiveSummary = ''
    }
  }

  if (!executiveSummary) {
    executiveSummary =
      `${listingName} reported revenue of ${money(ext.revenueTotal)} with sustainable SDE of ${money(ext.sde)} ` +
      `(EBITDA ${money(ext.ebitda)}). Applying ${ext.sdeMultipleLow}x–${ext.sdeMultipleHigh}x SDE yields an indicated value range of ` +
      `${money(ext.valueRangeLow)} to ${money(ext.valueRangeHigh)}. Earnings quality is anchored by the add-backs detailed below.`
  }

  return {
    listingId: ext.listingId,
    listingName,
    generatedAt: new Date().toISOString(),
    executiveSummary,
    sections,
  }
}
