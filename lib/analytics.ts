'use client'

// =============================================================================
// Analytics & Reporting service
// -----------------------------------------------------------------------------
// Aggregates metrics for the analytics dashboard: deal pipeline value over
// time, lead conversion funnel, broker performance, revenue/commission
// tracking, period comparison (MoM/YoY), and CSV export helpers.
//
// Realistic about the schema: deals have (id, listing_id, status,
// purchase_price, created_at, updated_at); leads live in seller_leads +
// buyer_leads. Commission data comes from a hypothetical `commissions` table
// (added in sql/analytics_schema.sql) and degrades gracefully when absent.
// =============================================================================

import { supabase } from '@/lib/supabase/client'

// --- Types ------------------------------------------------------------------
export interface PipelineValuePoint {
  month: string       // e.g. "Aug 26"
  value: number       // sum of purchase_price of deals created that month
  count: number
}

export interface FunnelPoint {
  stage: string
  count: number
  pct: number
}

export interface BrokerPerformance {
  name: string
  deals: number
  revenue: number
  commissions: number
}

export interface RevenueSeries {
  month: string
  revenue: number
  commissions: number
}

export interface PeriodComparison {
  currentValue: number
  previousValue: number
  changePct: number
}

export interface AnalyticsOverview {
  totalPipelineValue: number
  avgDealSize: number
  closedCount: number
  activeCount: number
  leadTotal: number
  leadConverted: number
}

export function emptyOverview(): AnalyticsOverview {
  return { totalPipelineValue: 0, avgDealSize: 0, closedCount: 0, activeCount: 0, leadTotal: 0, leadConverted: 0 }
}

// --- Internal helpers --------------------------------------------------------
const monthKey = (d: string | Date): string => {
  const dt = typeof d === 'string' ? new Date(d) : d
  return dt.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}
const fmt = (n: any): number => (Number.isFinite(n) ? Number(n) : 0)

// --- Deal pipeline value over time ------------------------------------------
export async function fetchPipelineValueSeries(): Promise<PipelineValuePoint[]> {
  try {
    const { data } = await supabase.from('deals').select('status, purchase_price, created_at')
    const rows = (data || []) as any[]
    const byMonth: Record<string, { value: number; count: number }> = {}
    for (const r of rows) {
      if (!r.created_at) continue
      const m = monthKey(r.created_at)
      const v = fmt(r.purchase_price)
      if (r.status === 'closed') continue // only active pipeline value
      byMonth[m] = byMonth[m] || { value: 0, count: 0 }
      byMonth[m].value += v
      byMonth[m].count += 1
    }
    return Object.entries(byMonth).map(([month, v]) => ({ month, value: Math.round(v.value), count: v.count }))
      .sort((a, b) => sortMonths(a.month, b.month))
  } catch {
    return []
  }
}

// --- Lead conversion funnel --------------------------------------------------
export async function fetchLeadFunnel(): Promise<FunnelPoint[]> {
  try {
    const [s, b] = await Promise.all([
      supabase.from('seller_leads').select('id, status'),
      supabase.from('buyer_leads').select('id, status'),
    ])
    const all = [...(s.data || []), ...(b.data || [])] as any[]
    const total = all.length
    const qualified = all.filter((l) => ['qualified', 'contacted', 'converted'].includes(l.status)).length
    const closing = all.filter((l) => ['converted'].includes(l.status)).length
    const stages = [
      { stage: 'Total leads', count: total },
      { stage: 'Engaged / qualified', count: qualified },
      { stage: 'Converted', count: closing },
    ]
    return stages.map((s2) => ({ stage: s2.stage, count: s2.count, pct: total ? Math.round((s2.count / total) * 100) : 0 }))
  } catch {
    return []
  }
}

// --- Revenue / commission over time -----------------------------------------
export async function fetchRevenueSeries(): Promise<RevenueSeries[]> {
  try {
    // Commission rows (schedule required) — degrade if table missing.
    const { data } = await supabase.from('commissions').select('amount, commission_amount, created_at')
    const rows = (data || []) as any[]
    if (rows.length === 0) {
      // Fall back to deals purchase_price as "revenue" proxy.
      const { data: deals } = await supabase.from('deals').select('purchase_price, status, created_at')
      const dRows = (deals || []).filter((d: any) => d.status === 'closed')
      const byMonth: Record<string, RevenueSeries> = {}
      for (const d of dRows) {
        if (!d.created_at) continue
        const m = monthKey(d.created_at)
        byMonth[m] = byMonth[m] || { month: m, revenue: 0, commissions: 0 }
        byMonth[m].revenue += fmt(d.purchase_price)
      }
      return Object.values(byMonth).map((r) => ({ ...r, revenue: Math.round(r.revenue) }))
        .sort((a, b) => sortMonths(a.month, b.month))
    }
    const byMonth: Record<string, RevenueSeries> = {}
    for (const r of rows) {
      if (!r.created_at) continue
      const m = monthKey(r.created_at)
      byMonth[m] = byMonth[m] || { month: m, revenue: 0, commissions: 0 }
      byMonth[m].revenue += fmt(r.amount || r.purchase_price)
      byMonth[m].commissions += fmt(r.commission_amount)
    }
    return Object.values(byMonth).map((r) => ({ ...r, revenue: Math.round(r.revenue), commissions: Math.round(r.commissions) }))
      .sort((a, b) => sortMonths(a.month, b.month))
  } catch {
    return []
  }
}

// --- Broker performance -------------------------------------------------------
export async function fetchBrokerPerformance(): Promise<BrokerPerformance[]> {
  try {
    // Requires commissions.agent_name. Degrade to deals grouped by agent via
    // the commission table when available; otherwise return empty-like summary.
    const { data } = await supabase.from('commissions').select('agent_name, amount, commission_amount, status')
    const rows = (data || []) as any[]
    if (rows.length === 0) return []
    const byAgent: Record<string, BrokerPerformance> = {}
    for (const r of rows) {
      const n = r.agent_name || 'Unassigned'
      byAgent[n] = byAgent[n] || { name: n, deals: 0, revenue: 0, commissions: 0 }
      byAgent[n].deals += 1
      byAgent[n].revenue += fmt(r.amount || r.purchase_price)
      byAgent[n].commissions += fmt(r.commission_amount)
    }
    return Object.values(byAgent).map((a) => ({ ...a, revenue: Math.round(a.revenue), commissions: Math.round(a.commissions) }))
      .sort((a, b) => b.commissions - a.commissions)
  } catch {
    return []
  }
}

// --- Period comparison (MoM / YoY) -------------------------------------------
export async function fetchComparison(mode: 'mom' | 'yoy'): Promise<PeriodComparison> {
  try {
    const { data } = await supabase.from('deals').select('status, purchase_price, created_at')
    const rows = (data || []) as any[]
    const now = new Date()
    const curMonth = now.getMonth(), curYear = now.getFullYear()
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    let cm = 0, pm = 0, lm = 0
    for (const r of rows) {
      const d = r.created_at ? new Date(r.created_at) : null
      if (!d) continue
      if (d.getMonth() === curMonth && d.getFullYear() === curYear) cm += fmt(r.purchase_price)
      if (d.getMonth() === prevMonth.getMonth() && d.getFullYear() === prevMonth.getFullYear()) pm += fmt(r.purchase_price)
      if (d.getFullYear() === curYear - 1 && d.getMonth() === curMonth) lm += fmt(r.purchase_price)
    }
    let curV = 0, prevV = 0
    if (mode === 'mom') { curV = cm; prevV = pm } else { curV = cm; prevV = lm }
    const changePct = prevV ? Math.round(((curV - prevV) / prevV) * 100) : (curV ? 100 : 0)
    return { currentValue: Math.round(curV), previousValue: Math.round(prevV), changePct }
  } catch {
    return { currentValue: 0, previousValue: 0, changePct: 0 }
  }
}

export async function fetchAnalyticsOverview(): Promise<AnalyticsOverview> {
  try {
    const [dealsRes, leadRes] = await Promise.all([
      supabase.from('deals').select('purchase_price, status'),
      supabase.from('seller_leads').select('id, status'),
    ])
    const deals = (dealsRes.data || []) as any[]
    const leads = (leadRes.data || []) as any[]
    const totalPipelineValue = deals.reduce((s, d) => s + fmt(d.purchase_price), 0)
    const closed = deals.filter((d) => d.status === 'closed')
    const active = deals.filter((d) => d.status !== 'closed')
    return {
      totalPipelineValue: Math.round(totalPipelineValue),
      avgDealSize: deals.length ? Math.round(totalPipelineValue / deals.length) : 0,
      closedCount: closed.length,
      activeCount: active.length,
      leadTotal: leads.length,
      leadConverted: leads.filter((l) => l.status === 'converted').length,
    }
  } catch {
    return emptyOverview()
  }
}

// --- CSV export ---------------------------------------------------------------
export function toCSV(headers: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n')
}

export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// --- internal: sort "Aug 26" style month labels chronologically --------------
function sortMonths(a: string, b: string): number {
  const parse = (s: string) => {
    const [m, y] = s.split(' ')
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return (Number('20' + y) * 12) + months.indexOf(m)
  }
  return parse(a) - parse(b)
}
