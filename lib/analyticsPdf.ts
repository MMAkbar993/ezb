import { jsPDF } from 'jspdf'
import type {
  PipelineValuePoint, FunnelPoint, BrokerPerformance,
  RevenueSeries, PeriodComparison, AnalyticsOverview,
} from '@/lib/analytics'

// ---------------------------------------------------------------------------
// Analytics PDF export — a polished "Executive Analytics Report" using jsPDF
// with the same navy/gold investment-bank aesthetic as the CIM/BOV exports.
// Mirrors the CSV exports in lib/analytics.ts but as a single branded PDF.
// ---------------------------------------------------------------------------

const NAVY: [number, number, number] = [26, 26, 46]
const GOLD: [number, number, number] = [201, 168, 76]
const CREAM: [number, number, number] = [247, 246, 242]
const INK: [number, number, number] = [43, 43, 58]
const MUTED: [number, number, number] = [122, 122, 138]

const money = (n: number): string => {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

interface AnalyticsReportData {
  overview: AnalyticsOverview
  pipelineValue: PipelineValuePoint[]
  funnel: FunnelPoint[]
  brokers: BrokerPerformance[]
  revenue: RevenueSeries[]
  comparison: PeriodComparison
  compareMode: 'mom' | 'yoy'
  generatedAt?: Date
}

function header(doc: jsPDF, W: number, M: number, title: string) {
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, 58, 'F')
  doc.setFillColor(...GOLD)
  doc.rect(0, 58, W, 2.2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('times', 'bold')
  doc.setFontSize(13)
  doc.text('CONCORD  DEAL  PLATFORM', M, 24)
  doc.setFontSize(20)
  doc.text(title, M, 46)
}

function sectionTitle(doc: jsPDF, M: number, y: number, text: string) {
  doc.setTextColor(...NAVY)
  doc.setFont('times', 'bold')
  doc.setFontSize(14)
  doc.text(text, M, y)
  doc.setFillColor(...GOLD)
  doc.rect(M, y + 4, 34, 2, 'F')
}

function footer(doc: jsPDF, W: number, H: number) {
  doc.setFont('times', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text('CONFIDENTIAL — for internal brokerage use only', M, H - 18)
}

const M = 46

export function exportAnalyticsPdf(data: AnalyticsReportData): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const now = data.generatedAt || new Date()

  // ---- Cover ----
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, H, 'F')
  doc.setFillColor(...GOLD)
  doc.rect(0, H * 0.42, W, 2.5, 'F')
  doc.setTextColor(...GOLD)
  doc.setFont('times', 'bold')
  doc.setFontSize(30)
  doc.text('Executive Analytics', M, H * 0.5)
  doc.text('Report', M, H * 0.5 + 34)
  doc.setTextColor(255, 255, 255)
  doc.setFont('times', 'normal')
  doc.setFontSize(14)
  doc.text('Concord Deal Platform', M, H * 0.5 + 66)
  doc.setFontSize(11)
  doc.setTextColor(...GOLD)
  doc.text(now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), M, H * 0.5 + 86)

  // ---- KPI summary ----
  let y = 0
  doc.addPage()
  header(doc, W, M, 'Overview')
  y = 96
  doc.setFont('times', 'bold'); doc.setFontSize(11); doc.setTextColor(...INK)
  const kpis: [string, string][] = [
    ['Pipeline value', money(data.overview.totalPipelineValue)],
    ['Avg deal size', money(data.overview.avgDealSize)],
    ['Active deals', String(data.overview.activeCount)],
    ['Closed deals', String(data.overview.closedCount)],
    ['Total leads', String(data.overview.leadTotal)],
    ['Converted', String(data.overview.leadConverted)],
  ]
  kpis.forEach(([label, val], i) => {
    const colX = M + (i % 2) * ((W - 2 * M) / 2)
    const rowY = y + Math.floor(i / 2) * 34
    doc.setFont('times', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED)
    doc.text(label.toUpperCase(), colX, rowY)
    doc.setFont('times', 'bold'); doc.setFontSize(15); doc.setTextColor(...NAVY)
    doc.text(val, colX, rowY + 18)
  })

  // ---- Comparison ----
  y += 3 * 34 + 22
  sectionTitle(doc, M, y, data.compareMode === 'mom' ? 'Month-over-Month Comparison' : 'Year-over-Year Comparison')
  y += 18
  const tone: [number, number, number] = data.comparison.changePct >= 0 ? [22, 163, 74] : [220, 38, 38]
  doc.setFont('times', 'normal'); doc.setFontSize(10); doc.setTextColor(...MUTED)
  doc.text(`This period:  ${money(data.comparison.currentValue)}`, M, y)
  doc.text(`Previous:     ${money(data.comparison.previousValue)}`, M + (W - 2 * M) / 2, y)
  doc.setFont('times', 'bold'); doc.setTextColor(...tone)
  doc.text(`Change: ${data.comparison.changePct >= 0 ? '+' : ''}${data.comparison.changePct}%`, M, y + 18)

  // ---- Pipeline value table ----
  y += 40
  sectionTitle(doc, M, y, 'Pipeline Value by Month')
  y += 14
  doc.setFont('times', 'bold'); doc.setFontSize(10); doc.setTextColor(...NAVY)
  doc.text('Month', M, y); doc.text('Deals', M + 120, y); doc.text('Value', M + 200, y)
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.8); doc.line(M, y + 3, W - M, y + 3)
  doc.setFont('times', 'normal'); doc.setFontSize(10); doc.setTextColor(...INK)
  for (const p of data.pipelineValue.slice(0, 18)) {
    y += 16
    if (y > H - 60) { doc.addPage(); y = 80 }
    doc.text(p.month, M, y)
    doc.text(String(p.count), M + 120, y)
    doc.text(money(p.value), M + 200, y)
  }

  // ---- Lead funnel ----
  doc.addPage(); header(doc, W, M, 'Lead Conversion Funnel')
  y = 96
  data.funnel.forEach((f) => {
    doc.setFont('times', 'bold'); doc.setFontSize(11); doc.setTextColor(...NAVY)
    doc.text(f.stage, M, y)
    doc.setFont('times', 'normal'); doc.setFontSize(11); doc.setTextColor(...GOLD)
    doc.text(`${f.count}  (${f.pct}%)`, M + 200, y)
    // bar
    const barMax = (W - 2 * M - 240)
    doc.setFillColor(201, 168, 76)
    doc.rect(M + 240, y - 9, barMax * Math.max(f.pct, 0) / 100, 11, 'F')
    y += 28
  })

  // ---- Broker performance ----
  if (data.brokers.length) {
    y += 10
    sectionTitle(doc, M, y, 'Broker Performance')
    y += 16
    doc.setFont('times', 'bold'); doc.setFontSize(10); doc.setTextColor(...NAVY)
    doc.text('Broker', M, y); doc.text('Deals', M + 160, y); doc.text('Revenue', M + 230, y); doc.text('Commissions', M + 320, y)
    doc.setDrawColor(...GOLD); doc.line(M, y + 3, W - M, y + 3)
    doc.setFont('times', 'normal'); doc.setTextColor(...INK)
    for (const b of data.brokers.slice(0, 12)) {
      y += 16
      if (y > H - 60) { doc.addPage(); y = 80 }
      doc.text(b.name.slice(0, 30), M, y)
      doc.text(String(b.deals), M + 160, y)
      doc.text(money(b.revenue), M + 230, y)
      doc.text(money(b.commissions), M + 320, y)
    }
  }

  footer(doc, W, H)
  doc.save('concord-analytics-report.pdf')
}
