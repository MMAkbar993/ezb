// =============================================================================
// lib/ai/types.ts — SHARED TYPES for the Financial Intelligence System.
// -----------------------------------------------------------------------------
// CLIENT-SAFE: types + static config only — no server imports, so components
// can pull types here without dragging the Anthropic SDK / node:path into the
// browser bundle (same pattern as lib/autoGenerateTypes.ts).
// =============================================================================

import type { FinancialCategory } from '@/lib/financialFiles'

// ---------------------------------------------------------------------------
// 1) The 15 supported financial document types
// ---------------------------------------------------------------------------
export const UNIVERSAL_DOC_TYPES = [
  'tax_return_1040',
  'tax_return_1120',
  'tax_return_1065',
  'tax_return_k1',
  'pnl',
  'balance_sheet',
  'cash_flow',
  'bank_statement',
  'sales_report',
  'ap_report',
  'ar_report',
  'payroll_report',
  'inventory_report',
  'financial_projections',
  'business_plan',
  'executive_summary',
  'budget_report',
  'forecast_report',
] as const

export type UniversalDocType = (typeof UNIVERSAL_DOC_TYPES)[number]

export interface UniversalDocTypeInfo {
  type: UniversalDocType
  label: string
  short: string
  area: 'tax' | 'financials' | 'cash' | 'operations' | 'planning'
  category: FinancialCategory // coarse bucket stored on financial_documents
}

export const UNIVERSAL_DOC_TYPE_INFO: Record<UniversalDocType, UniversalDocTypeInfo> = {
  tax_return_1040: { type: 'tax_return_1040', label: 'Tax Return (1040)', short: '1040', area: 'tax', category: 'tax_return' },
  tax_return_1120: { type: 'tax_return_1120', label: 'Tax Return (1120 C-Corp)', short: '1120', area: 'tax', category: 'tax_return' },
  tax_return_1065: { type: 'tax_return_1065', label: 'Tax Return (1065 Partnership)', short: '1065', area: 'tax', category: 'tax_return' },
  tax_return_k1: { type: 'tax_return_k1', label: 'K-1 Schedules', short: 'K-1', area: 'tax', category: 'tax_return' },
  pnl: { type: 'pnl', label: 'P&L Statement', short: 'P&L', area: 'financials', category: 'financial_statement' },
  balance_sheet: { type: 'balance_sheet', label: 'Balance Sheet', short: 'Balance', area: 'financials', category: 'financial_statement' },
  cash_flow: { type: 'cash_flow', label: 'Cash Flow Statement', short: 'Cash Flow', area: 'cash', category: 'financial_statement' },
  bank_statement: { type: 'bank_statement', label: 'Bank Statement', short: 'Bank', area: 'cash', category: 'bank_statement' },
  sales_report: { type: 'sales_report', label: 'Sales Report', short: 'Sales', area: 'operations', category: 'financial_statement' },
  ap_report: { type: 'ap_report', label: 'AP Report (Accounts Payable)', short: 'AP', area: 'operations', category: 'financial_statement' },
  ar_report: { type: 'ar_report', label: 'AR Report (Accounts Receivable)', short: 'AR', area: 'operations', category: 'financial_statement' },
  payroll_report: { type: 'payroll_report', label: 'Payroll Report', short: 'Payroll', area: 'operations', category: 'financial_statement' },
  inventory_report: { type: 'inventory_report', label: 'Inventory Report', short: 'Inventory', area: 'operations', category: 'financial_statement' },
  financial_projections: { type: 'financial_projections', label: 'Financial Projections', short: 'Projections', area: 'planning', category: 'financial_statement' },
  business_plan: { type: 'business_plan', label: 'Business Plan', short: 'Business Plan', area: 'planning', category: 'other' },
  executive_summary: { type: 'executive_summary', label: 'Executive Summary', short: 'Exec Summary', area: 'planning', category: 'other' },
  budget_report: { type: 'budget_report', label: 'Budget Report', short: 'Budget', area: 'planning', category: 'financial_statement' },
  forecast_report: { type: 'forecast_report', label: 'Forecast Report', short: 'Forecast', area: 'planning', category: 'financial_statement' },
}

// Expand a coarse FinancialCategory into the UniversalDocTypes that share it.
export const UNIVERSAL_TYPES_BY_CATEGORY: Record<FinancialCategory, UniversalDocType[]> = {
  tax_return: ['tax_return_1040', 'tax_return_1120', 'tax_return_1065', 'tax_return_k1'],
  financial_statement: ['pnl', 'balance_sheet', 'cash_flow', 'sales_report', 'ap_report', 'ar_report', 'payroll_report', 'inventory_report', 'financial_projections', 'budget_report', 'forecast_report'],
  bank_statement: ['bank_statement'],
  generated_document: [],
  other: ['business_plan', 'executive_summary'],
}

// ---------------------------------------------------------------------------
// 2) Raw text extraction result
// ---------------------------------------------------------------------------
export interface ExtractedTextResult {
  fileName: string
  mimeType: string | null
  text: string      // extracted plain text (truncated to a sane window)
  truncated: boolean
  byteLength: number
}

// ---------------------------------------------------------------------------
// 3) Structured financial analysis (Claude output)
// ---------------------------------------------------------------------------
export interface AnalyzedYearFinancials {
  year: number
  label?: string
  revenue?: number
  cogs?: number
  grossProfit?: number
  operatingExpenses?: number
  ownerComp?: number
  depreciation?: number
  interest?: number
  otherExpenses?: number
  netIncome?: number
}

export interface BalanceSnapshot {
  asOf: string
  cash?: number
  accountsReceivable?: number
  inventory?: number
  totalAssets?: number
  accountsPayable?: number
  debt?: number
  totalLiabilities?: number
  equity?: number
  workingCapital?: number
}

export interface FinancialTrend {
  label: string
  value: string
  direction: 'up' | 'down' | 'flat'
  note: string
}

export interface FinancialRatio {
  name: string
  value: string
  benchmark: string
  healthy: boolean
  note: string
}

export interface DocumentAnalysis {
  fileName: string
  type: UniversalDocType
  typeLabel: string
  confidence: number // 0..1
  revenueTotal: number
  expenseTotal: number
  assets: number
  liabilities: number
  sde: number
  ebitda: number
  years: AnalyzedYearFinancials[]
  balances: BalanceSnapshot[]
  ratios: FinancialRatio[]
  trends: FinancialTrend[]
  tags: string[]
  keyMetrics: Record<string, string | number>
  summary: string
  raw: string // last ~600 chars of doc text for context
}

// Complete multi-document intelligence bundle (post-agent assembly)
export interface FinancialIntelligence {
  listingId: string
  listingName: string
  documents: {
    fileName: string
    type: UniversalDocType
    typeLabel: string
    confidence: number
    tags: string[]
    keyMetrics: Record<string, string | number>
  }[]
  revenueByYear: { year: number; revenue: number; label: string }[]
  expenses: Record<string, number> // category -> amount (annualized)
  sde: number
  ebitda: number
  addBacks: { label: string; amount: number; recurring: boolean }[]
  sdeMultipleLow: number
  sdeMultipleHigh: number
  valueRangeLow: number
  valueRangeHigh: number
  ratios: FinancialRatio[]
  trends: FinancialTrend[]
  workingCapital: number
  debt: number
  summary: string
  generatedAt: string
}
