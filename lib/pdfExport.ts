import { jsPDF } from 'jspdf'
import type { CimContent } from '@/lib/cim'
import type { BovContent } from '@/lib/bov'
import type { RecastResult, RecastYearResult } from '@/lib/recast'
import type { BliContent } from '@/lib/bli'

// ---------------------------------------------------------------------------
// PDF export for CIM, BOV and Recast reports with the gold/navy investment-
// bank aesthetic. Uses jsPDF with manual layout (cover page, gold rules, navy
// headings) to avoid heavy HTML-to-PDF dependencies.
// ---------------------------------------------------------------------------

const NAVY: [number, number, number] = [26, 26, 46]
const GOLD: [number, number, number] = [201, 168, 76]
const GOLD_DARK: [number, number, number] = [168, 135, 47]
const CREAM: [number, number, number] = [247, 246, 242]
const TEXT: [number, number, number] = [43, 43, 58]
const MUTED: [number, number, number] = [122, 122, 138]

export function exportCimToPdf(content: CimContent, opts?: { returnBytes?: boolean }): Uint8Array | void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth() // 595
  const H = doc.internal.pageSize.getHeight() // 842
  const M = 56 // margin

  // ---- Cover page ----
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, H, 'F')
  // gold rule
  doc.setFillColor(...GOLD)
  doc.rect(0, H * 0.42, W, 2.5, 'F')

  doc.setTextColor(...GOLD)
  doc.setFont('times', 'bold')
  doc.setFontSize(30)
  let y = H * 0.5
  doc.text(content.title, M, y)

  doc.setTextColor(255, 255, 255)
  doc.setFont('times', 'normal')
  doc.setFontSize(18)
  y += 34
  doc.text(content.subtitle, M, y)

  doc.setFontSize(11)
  doc.setTextColor(...GOLD)
  y += 30
  doc.text('CONFIDENTIAL INFORMATION MEMORANDUM', M, y)

  doc.setFontSize(10)
  doc.setTextColor(200, 200, 200)
  y += 26
  doc.text(`Prepared: ${content.generatedAt}`, M, y)

  doc.setFontSize(10)
  y += 18
  doc.text(
    content.preparedByName
      ? `Prepared by ${content.preparedByName}${content.preparedByBrokerage ? ' — ' + content.preparedByBrokerage : ''}`
      : 'CONCORD DEAL PLATFORM',
    M, y
  )

  doc.addPage()

  // ---- Table of contents ----
  doc.setTextColor(...NAVY)
  doc.setFont('times', 'bold')
  doc.setFontSize(20)
  doc.text('Table of Contents', M, 80)
  doc.setFillColor(...GOLD)
  doc.rect(M, 92, 60, 2.5, 'F')

  doc.setFont('times', 'normal')
  doc.setFontSize(12)
  let ty = 130
  for (const s of content.sections) {
    doc.setTextColor(...NAVY)
    doc.text(s.title, M, ty)
    ty += 24
  }

  // ---- Sections ----
  for (const section of content.sections) {
    doc.addPage()
    // navy header band
    doc.setFillColor(...NAVY)
    doc.rect(0, 0, W, 90, 'F')
    doc.setTextColor(...GOLD)
    doc.setFont('times', 'bold')
    doc.setFontSize(16)
    doc.text(section.title, M, 55)

    let sy = 130
    for (const sub of section.subsections) {
      doc.setTextColor(...NAVY)
      doc.setFont('times', 'bold')
      doc.setFontSize(13)
      doc.text(sub.heading, M, sy)
      sy += 22
      doc.setFont('times', 'normal')
      doc.setFontSize(10.5)
      doc.setTextColor(...TEXT)
      for (const line of sub.body) {
        // word-wrap within margins
        const wrapped = doc.splitTextToSize(line, W - M * 2) as string[]
        for (const w of wrapped) {
          if (sy > H - 60) {
            doc.addPage()
            sy = 60
          }
          doc.text(w, M, sy)
          sy += 16
        }
        sy += 6
      }
      sy += 10
    }
  }

  // ---- Disclaimer (final page) ----
  doc.addPage()
  doc.setTextColor(...NAVY)
  doc.setFont('times', 'bold')
  doc.setFontSize(13)
  doc.text('Confidentiality', M, 80)
  doc.setFillColor(...GOLD)
  doc.rect(M, 92, 60, 2, 'F')
  doc.setFont('times', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...MUTED)
  const disc = doc.splitTextToSize(
    'This document is confidential and proprietary to the seller and its advisor. It is provided solely for the purpose of evaluating a potential transaction and may not be reproduced, distributed, or used for any other purpose without the prior written consent of the seller. Recipients agree to maintain the confidentiality of the information contained herein and to use it solely to evaluate an acquisition of the subject business. This memorandum does not constitute an offer to sell. Information is provided "as is" without warranty of accuracy or completeness.',
    W - M * 2
  ) as string[]
  let dy = 110
  for (const l of disc) {
    doc.text(l, M, dy)
    dy += 15
  }

  if (content.preparedByName) {
    dy += 20
    doc.setFont('times', 'italic')
    doc.setFontSize(9.5)
    doc.setTextColor(...GOLD_DARK)
    doc.text(
      `Prepared by ${content.preparedByName}${content.preparedByBrokerage ? ' — ' + content.preparedByBrokerage : ''}`,
      M, dy
    )
  }

  if (opts?.returnBytes) {
    return new Uint8Array(doc.output('arraybuffer'))
  }
  doc.save(`${content.title.replace(/[^a-z0-9]+/gi, '_')}_CIM_v1.pdf`)
}

const CONFIDENTIAL_STAMP = 'CONFIDENTIAL — This document contains proprietary and confidential information. Any reproduction, distribution, or disclosure without prior written consent is strictly prohibited.'
const H = 842 // A4 height (pt)

// Draws the navy/gold section header band + the confidentiality footer notice
// on the current page. Call after addPage() or at page start.
function startBovPage(doc: any, sectionTitle: string, footer = true, preparedBy?: string): void {
  const W = doc.internal.pageSize.getWidth()
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, W, H, 'F')
  // navy header band
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, 90, 'F')
  doc.setFillColor(...GOLD)
  doc.rect(0, 90, W, 2.5, 'F')
  doc.setTextColor(...GOLD)
  doc.setFont('times', 'bold')
  doc.setFontSize(13)
  doc.text('BROKER OPINION OF VALUE', W / 2, 32, { align: 'center' })
  doc.setFontSize(16)
  doc.setTextColor(255, 255, 255)
  doc.text(sectionTitle, 56, 64)
  if (footer) {
    const lines = doc.splitTextToSize(CONFIDENTIAL_STAMP, W - 112) as string[]
    doc.setFont('times', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    let fy = H - 30
    for (let i = lines.length - 1; i >= 0; i--) {
      doc.text(lines[i], 56, fy)
      fy -= 10
    }
    if (preparedBy) {
      doc.text(preparedBy, 56, fy)
      fy -= 10
    }
    doc.setDrawColor(...GOLD)
    doc.setLineWidth(0.7)
    doc.line(56, H - 42, W - 56, H - 42)
  }
}

export function exportBovToPdf(content: BovContent, opts?: { returnBytes?: boolean }): Uint8Array | void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 56
  const preparedByLine = content.preparedByName
    ? `Prepared by ${content.preparedByName}${content.preparedByBrokerage ? ' — ' + content.preparedByBrokerage : ''}`
    : undefined

  // ---- Cover page ----
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, H, 'F')
  doc.setFillColor(...GOLD)
  doc.rect(0, H * 0.42, W, 2.5, 'F')
  doc.setTextColor(...GOLD)
  doc.setFont('times', 'bold')
  doc.setFontSize(12)
  doc.text('CONFIDENTIAL', W / 2, H * 0.32, { align: 'center' })
  doc.setFontSize(30)
  doc.text('BROKER OPINION OF VALUE', W / 2, H * 0.5, { align: 'center' })
  doc.setTextColor(255, 255, 255)
  doc.setFont('times', 'normal')
  doc.setFontSize(18)
  doc.text(content.businessName, W / 2, H * 0.5 + 40, { align: 'center' })
  doc.setFontSize(11)
  doc.setTextColor(...GOLD)
  doc.text(preparedByLine || 'Prepared by Concord Deal Platform', W / 2, H * 0.5 + 66, { align: 'center' })
  doc.setFontSize(10)
  doc.setTextColor(200, 200, 200)
  doc.text(`Prepared: ${content.generatedAt}  ·  For: ${content.preparedFor}`, W / 2, H * 0.5 + 86, { align: 'center' })
  doc.setTextColor(...GOLD)
  doc.setFontSize(9)
  doc.text('PRIVILEGED & CONFIDENTIAL — UNDER NON-DISCLOSURE', W / 2, H - 60, { align: 'center' })

  // ---- Table of contents ----
  doc.addPage()
  startBovPage(doc, 'Table of Contents', true, preparedByLine)
  doc.setTextColor(...NAVY)
  doc.setFont('times', 'bold')
  doc.setFontSize(16)
  doc.text('Table of Contents', M, 140)
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(2)
  doc.line(M, 150, M + 70, 150)
  let ty = 190
  ;['Executive Summary', 
    ...content.sections.map((s) => s.title)].forEach((t, i) => {
    doc.setFont('times', 'normal')
    doc.setFontSize(12)
    doc.setTextColor(...NAVY)
    doc.text(`${i + 1}.  ${t}`, M, ty)
    ty += 28
    if (ty > H - 80) { doc.addPage(); startBovPage(doc, 'Table of Contents', true, preparedByLine); ty = 100 }
  })

  // ---- Valuation summary snapshot page ----
  doc.addPage()
  startBovPage(doc, 'Valuation Summary', true, preparedByLine)
  let y = 140
  doc.setTextColor(...NAVY)
  doc.setFont('times', 'bold')
  doc.setFontSize(14)
  doc.text('Valuation Summary', M, y)
  y += 10
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(2)
  doc.line(M, y, M + 70, y)
  y += 26
  const rows: [string, string][] = [
    ['Business', content.businessName],
    ['Asking Price', fmt(content.askingPrice)],
    ['Annual Revenue', fmt(content.revenue)],
    ['Normalized SDE', fmt(content.sde)],
    ['Normalized EBITDA', fmt(content.ebitda)],
    ['Price / Revenue', content.revenueMultiple],
    ['Price / SDE', content.sdeMultiple],
    ['Price / EBITDA', content.ebitdaMultiple],
    ['Indicative Value Range', content.valuationRange],
  ]
  doc.setFont('times', 'normal')
  doc.setFontSize(11)
  rows.forEach(([k, v]) => {
    doc.setTextColor(...TEXT)
    doc.text(k, M, y)
    doc.setTextColor(...GOLD_DARK)
    doc.setFont('times', 'bold')
    doc.text(v, W - M, y, { align: 'right' })
    doc.setFont('times', 'normal')
    y += 22
  })

  // ---- Full sections (each starts on a new page, auto-paginates) ----
  for (const section of content.sections) {
    doc.addPage()
    startBovPage(doc, section.title, true, preparedByLine)
    let sy = 130
    doc.setTextColor(...NAVY)
    doc.setFont('times', 'bold')
    doc.setFontSize(16)
    doc.text(section.title, M, sy)
    sy += 12
    doc.setDrawColor(...GOLD)
    doc.setLineWidth(2)
    doc.line(M, sy, M + 70, sy)
    sy += 26

    for (const sub of section.subsections) {
      if (sub.heading) {
        doc.setTextColor(...NAVY)
        doc.setFont('times', 'bold')
        doc.setFontSize(13)
        doc.text(sub.heading, M, sy)
        sy += 22
      }
      doc.setFont('times', 'normal')
      doc.setFontSize(10.5)
      doc.setTextColor(...TEXT)
      for (const line of sub.body) {
        const wrapped = doc.splitTextToSize(line, W - M * 2) as string[]
        for (const w of wrapped) {
          if (sy > H - 70) { doc.addPage(); startBovPage(doc, section.title, true, preparedByLine); sy = 90 }
          doc.text(w, M, sy)
          sy += 16
        }
        sy += 6
      }
      sy += 10
    }

    // Assumptions appended to the final section
    if (section.id === 'conclusion') {
      sy += 10
      doc.setTextColor(...NAVY)
      doc.setFont('times', 'bold')
      doc.setFontSize(13)
      doc.text('Assumptions & Methodology', M, sy)
      sy += 20
      doc.setFont('times', 'normal')
      doc.setFontSize(10.5)
      doc.setTextColor(...TEXT)
      for (const a of content.assumptions) {
        const lines = doc.splitTextToSize('•  ' + a, W - M * 2) as string[]
        for (const l of lines) {
          if (sy > H - 70) { doc.addPage(); startBovPage(doc, section.title, true, preparedByLine); sy = 90 }
          doc.text(l, M, sy)
          sy += 15
        }
      }
    }
  }

  // ---- Comparable transactions page ----
  doc.addPage()
  startBovPage(doc, 'Comparable Transactions', true, preparedByLine)
  let cy = 140
  doc.setTextColor(...NAVY)
  doc.setFont('times', 'bold')
  doc.setFontSize(14)
  doc.text('Comparable Transactions', M, cy)
  cy += 14
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(2)
  doc.line(M, cy, M + 70, cy)
  cy += 24
  doc.setFillColor(...NAVY)
  doc.rect(M, cy - 12, W - M * 2, 20, 'F')
  doc.setTextColor(...GOLD)
  doc.setFont('times', 'bold')
  doc.setFontSize(10)
  const cols = ['Business', 'Industry', 'Location', 'Price', 'Revenue', 'Multiple']
  const colX = [M, M + 105, M + 205, M + 315, M + 420, M + 500]
  for (let i = 0; i < cols.length; i++) doc.text(cols[i], colX[i], cy)
  cy += 24
  doc.setTextColor(...TEXT)
  doc.setFont('times', 'normal')
  doc.setFontSize(10)
  if (content.comparables.length === 0) {
    doc.setFont('times', 'italic')
    doc.text('No comparable transaction data source is connected yet.', M, cy)
    doc.setFont('times', 'normal')
  }
  for (const c of content.comparables) {
    const vals = [c.business, c.industry, c.location, fmt(c.price), fmt(c.revenue), c.multiple ? c.multiple.toFixed(2) + 'x' : 'N/A']
    for (let i = 0; i < vals.length; i++) doc.text(vals[i], colX[i], cy)
    cy += 20
    if (cy > H - 70) { doc.addPage(); startBovPage(doc, 'Comparable Transactions', true, preparedByLine); cy = 90 }
  }

  // ---- Final confidentiality / disclaimer page ----
  doc.addPage()
  startBovPage(doc, 'Confidentiality & Disclaimer', false)
  doc.setTextColor(...NAVY)
  doc.setFont('times', 'bold')
  doc.setFontSize(14)
  doc.text('Confidentiality & Disclaimer', M, 140)
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(2)
  doc.line(M, 150, M + 70, 150)
  doc.setFont('times', 'normal')
  doc.setFontSize(10.5)
  doc.setTextColor(...TEXT)
  const par = [
    'This Broker Opinion of Value has been prepared on a confidential basis solely for the information of the recipient in connection with the evaluation of a potential acquisition of the subject business. This document and the information contained herein are proprietary and confidential and may not be reproduced, distributed, or transmitted to any third party, in whole or in part, without the prior written consent of the seller and its advisor.',
    'By accepting this document, the recipient agrees to (i) treat its contents as confidential, (ii) use the information solely to evaluate the potential transaction, and (iii) not utilize such information in any manner detrimental to the seller or its advisor. Neither this document nor any of its contents may be relied upon as a basis for investment, legal, tax, or accounting advice.',
    'Disclaimer: ' + content.disclaimer,
  ]
  let dy = 178
  for (const p of par) {
    const wrapped = doc.splitTextToSize(p, W - M * 2) as string[]
    for (const l of wrapped) {
      if (dy > H - 70) { doc.addPage(); startBovPage(doc, 'Confidentiality & Disclaimer', false); dy = 90 }
      doc.text(l, M, dy)
      dy += 16
    }
    dy += 12
  }

  if (opts?.returnBytes) {
    return new Uint8Array(doc.output('arraybuffer'))
  }
  doc.save(`${content.businessName.replace(/[^a-z0-9]+/gi, '_')}_BOV.pdf`)
}

const fmt = (n: number | null | undefined): string => {
  if (n === null || n === undefined || isNaN(n)) return '$—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

// ---------------------------------------------------------------------------
// Recast Financial Report PDF export
// ---------------------------------------------------------------------------
const fmtR = (n: number | null | undefined, currency = '$'): string => {
  if (n === null || n === undefined || isNaN(n)) return '—'
  const sign = n < 0 ? '-' : ''
  return `${currency}${sign}${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

export function exportRecastToPdf(result: RecastResult, opts?: { returnBytes?: boolean }): Uint8Array | void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth() // 595
  const H = doc.internal.pageSize.getHeight() // 842
  const M = 56 // margin

  // ---- Cover page ----
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, H, 'F')
  doc.setFillColor(...GOLD)
  doc.rect(0, H * 0.42, W, 2.5, 'F')

  doc.setTextColor(...GOLD)
  doc.setFont('times', 'bold')
  doc.setFontSize(28)
  let y = H * 0.5
  doc.text(result.businessName || 'Recast Report', M, y)

  doc.setTextColor(255, 255, 255)
  doc.setFont('times', 'normal')
  doc.setFontSize(16)
  y += 30
  doc.text('Recasted Financial Statement', M, y)

  doc.setFontSize(11)
  doc.setTextColor(...GOLD)
  y += 28
  doc.text('NORMALIZED SDE / EBITDA ANALYSIS', M, y)

  doc.setFontSize(10)
  doc.setTextColor(200, 200, 200)
  y += 26
  doc.text(`Entity Type: ${result.entityType.toUpperCase().replace('_', '-')}`, M, y)
  y += 16
  doc.text(`Fiscal Periods Covered: ${result.years.length}`, M, y)
  y += 16
  doc.text(`Prepared: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, M, y)

  doc.setTextColor(...GOLD)
  doc.setFontSize(9)
  y = H - 60
  doc.text('CONCORD DEAL PLATFORM', M, y)
  doc.text('CONFIDENTIAL', W - M, y, { align: 'right' })

  // ---- Page 2: Executive summary metrics ----
  doc.addPage()
  y = 80
  doc.setTextColor(...NAVY)
  doc.setFont('times', 'bold')
  doc.setFontSize(16)
  doc.text('Recast Summary', M, y)
  y += 14
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(2)
  doc.line(M, y, M + 60, y)
  y += 30

  // Metric boxes
  const boxes = [
    { label: 'Average SDE', value: fmtR(result.avgSDE, result.currency), sub: "Seller's Discretionary Earnings" },
    { label: 'Average EBITDA', value: fmtR(result.avgEBITDA, result.currency), sub: 'Earnings Before Interest, Tax, D&A' },
  ]
  const boxW = (W - M * 2 - 24) / 2
  boxes.forEach((b, i) => {
    const bx = M + i * (boxW + 24)
    doc.setDrawColor(...GOLD)
    doc.setFillColor(250, 249, 244)
    doc.roundedRect(bx, y, boxW, 88, 6, 6, 'FD')
    doc.setTextColor(...NAVY)
    doc.setFont('times', 'bold')
    doc.setFontSize(11)
    doc.text(b.label, bx + 14, y + 22)
    doc.setTextColor(...GOLD_DARK)
    doc.setFontSize(18)
    doc.text(b.value, bx + 14, y + 50)
    doc.setTextColor(...MUTED)
    doc.setFont('times', 'normal')
    doc.setFontSize(9)
    doc.text(b.sub, bx + 14, y + 70)
  })

  y += 120
  doc.setTextColor(...NAVY)
  doc.setFont('times', 'bold')
  doc.setFontSize(11)
  doc.text('Earnings Trend', M, y)
  y += 18
  doc.setFont('times', 'normal')
  doc.setFontSize(10.5)
  doc.setTextColor(...TEXT)
  const trend = doc.splitTextToSize(result.trendNote, W - M * 2) as string[]
  for (const l of trend) {
    doc.text(l, M, y)
    y += 16
  }

  // ---- Before vs After table ----
  y += 24
  doc.addPage()
  y = 80
  doc.setTextColor(...NAVY)
  doc.setFont('times', 'bold')
  doc.setFontSize(16)
  doc.text('Before vs After — Recast Comparison', M, y)
  y += 14
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(2)
  doc.line(M, y, M + 60, y)
  y += 26

  const yearsSorted = result.years.slice().sort((a, b) => b.year - a.year)
  const rows: { label: string; key: (yr: RecastYearResult) => string; highlight?: boolean; gold?: boolean }[] = [
    { label: 'Revenue', key: (yr) => fmtR(yr.recast.revenue, result.currency), highlight: true },
    { label: 'As-Reported Net Income', key: (yr) => fmtR(yr.asReported.netIncome, result.currency) },
    { label: '+ Total Add-backs', key: (yr) => '+' + fmtR(yr.totalAddBacks, result.currency), gold: true },
    { label: 'Recast SDE', key: (yr) => fmtR(yr.recast.sde, result.currency), highlight: true, gold: true },
    { label: 'Recast EBITDA', key: (yr) => fmtR(yr.recast.ebitda, result.currency), highlight: true },
  ]

  // Header
  doc.setFillColor(...NAVY)
  doc.rect(M, y - 12, W - M * 2, 22, 'F')
  doc.setTextColor(...GOLD)
  doc.setFont('times', 'bold')
  doc.setFontSize(10)
  doc.text('Metric', M + 10, y)
  const yearStart = M + 130
  const colW = (W - M * 2 - 130) / yearsSorted.length
  yearsSorted.forEach((yr, i) => {
    doc.text(yr.label, yearStart + i * colW + colW / 2, y, { align: 'center' })
  })
  y += 28

  rows.forEach((r, ri) => {
    if (ri % 2 === 1 && !r.highlight) {
      doc.setFillColor(247, 246, 242)
      doc.rect(M, y - 12, W - M * 2, 22, 'F')
    }
    if (r.gold) {
      doc.setFillColor(250, 243, 225)
      doc.rect(M, y - 12, W - M * 2, 22, 'F')
    }
    doc.setTextColor(...NAVY)
    doc.setFont('times', r.highlight ? 'bold' : 'normal')
    doc.setFontSize(10)
    doc.text(r.label, M + 10, y)
    doc.setTextColor(...(r.gold ? GOLD_DARK : TEXT))
    yearsSorted.forEach((yr, i) => {
      doc.text(r.key(yr), yearStart + i * colW + colW / 2, y, { align: 'center' })
    })
    y += 24
    if (y > 780) { doc.addPage(); y = 60 }
  })

  // ---- Add-back detail ----
  y += 20
  doc.setTextColor(...NAVY)
  doc.setFont('times', 'bold')
  doc.setFontSize(14)
  doc.text('Add-Back Detail', M, y)
  y += 14
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(2)
  doc.line(M, y, M + 60, y)
  y += 24

  doc.setFont('times', 'normal')
  doc.setFontSize(9.5)
  for (const yr of yearsSorted) {
    doc.setTextColor(...NAVY)
    doc.setFont('times', 'bold')
    doc.text(`${yr.label} — Total Add-backs: ${fmtR(yr.totalAddBacks, result.currency)}`, M, y)
    y += 16
    doc.setFont('times', 'normal')
    for (const d of yr.addBackDetail) {
      if (y > 780) { doc.addPage(); y = 60 }
      doc.setTextColor(...TEXT)
      doc.text('•  ' + d.label, M + 8, y)
      doc.setTextColor(...GOLD_DARK)
      doc.text('+' + fmt(d.amount), W - M, y, { align: 'right' })
      y += 16
    }
    if (yr.addBackDetail.length === 0) {
      doc.setTextColor(...MUTED)
      doc.setFont('times', 'italic')
      doc.text('No add-backs recorded for this period.', M + 8, y)
      doc.setFont('times', 'normal')
      y += 16
    }
    y += 10
    if (y > 760) { doc.addPage(); y = 60 }
  }

  // ---- Disclaimer ----
  y += 20
  doc.setTextColor(...MUTED)
  doc.setFont('times', 'italic')
  doc.setFontSize(9.5)
  const disc2 = doc.splitTextToSize(
    'Disclaimer: This recast is an estimate prepared for business-valuation purposes and may not reflect GAAP financial statements. ' +
    'Add-backs are subject to buyer and lender verification. Figures include owner compensation, non-recurring, discretionary and ' +
    'non-arm\'s-length adjustments as standard industry practice for SDE/EBITDA normalization.',
    W - M * 2
  ) as string[]
  for (const l of disc2) {
    if (y > 790) { doc.addPage(); y = 60 }
    doc.text(l, M, y)
    y += 14
  }

  if (opts?.returnBytes) {
    return new Uint8Array(doc.output('arraybuffer'))
  }
  doc.save(`${result.businessName.replace(/[^a-z0-9]+/gi, '_')}_Recast_Report.pdf`)
}

// ---------------------------------------------------------------------------
// BLI — one-page Business Listing Information summary
// ---------------------------------------------------------------------------
export function exportBliToPdf(content: BliContent, opts?: { returnBytes?: boolean }): Uint8Array | void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 56

  // ---- Cover / header band ----
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, H, 'F')
  doc.setFillColor(...GOLD)
  doc.rect(0, H * 0.38, W, 2.5, 'F')
  doc.setTextColor(...GOLD)
  doc.setFont('times', 'bold')
  doc.setFontSize(30)
  doc.text('BUSINESS LISTING INFORMATION', W / 2, H * 0.5, { align: 'center' })
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.text(content.businessName, W / 2, H * 0.5 + 36, { align: 'center' })
  doc.setTextColor(...GOLD)
  doc.setFontSize(11)
  doc.text(`${content.industry || ''}${content.location ? ' · ' + content.location : ''}`, W / 2, H * 0.5 + 58, { align: 'center' })
  doc.setTextColor(200, 200, 210)
  doc.setFontSize(9)
  doc.text(`Prepared: ${content.generatedAt}`, W / 2, H * 0.5 + 76, { align: 'center' })
  doc.setTextColor(...GOLD)
  doc.setFontSize(9)
  doc.text('PRIVILEGED & CONFIDENTIAL — UNDER NON-DISCLOSURE', W / 2, H - 46, { align: 'center' })

  // ---- Snapshot page(s) ----
  startBovPage(doc, 'Offer Summary')
  let y = 104
  const row = (label: string, value: string) => {
    if (y > H - 70) { doc.addPage(); startBovPage(doc, 'Offer Summary'); y = 104 }
    doc.setFont('times', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...NAVY)
    doc.text(label, M, y)
    doc.setFont('times', 'normal')
    doc.setTextColor(...TEXT)
    doc.text(value, W - M, y, { align: 'right' })
    doc.setTextColor(220, 216, 205)
    doc.setLineWidth(0.6)
    doc.line(M, y + 5, W - M, y + 5)
    y += 22
  }

  row('Asking Price', fmt(content.askingPrice))
  row('Annual Revenue', fmt(content.metrics.revenue))
  row("Seller's Discretionary Earnings (SDE)", fmt(content.metrics.sde))
  row('EBITDA', fmt(content.metrics.ebitda))
  row('Gross Margin', content.metrics.grossMargin === null ? '—' : (content.metrics.grossMargin * 100).toFixed(0) + '%')
  row('SDE Margin', content.metrics.sdeMargin === null ? '—' : (content.metrics.sdeMargin * 100).toFixed(0) + '%')
  row('Price / Revenue', content.metrics.priceToRevenue === null ? '—' : content.metrics.priceToRevenue.toFixed(2) + 'x')
  row('Price / SDE', content.metrics.priceToSde === null ? '—' : content.metrics.priceToSde.toFixed(2) + 'x')
  row('Price / EBITDA', content.metrics.priceToEbitda === null ? '—' : content.metrics.priceToEbitda.toFixed(2) + 'x')
  y += 8

  // Investment highlights
  doc.setFont('times', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...NAVY)
  doc.text('Investment Highlights', M, y)
  y += 16
  const highlights = content.sections.find((s) => s.id === 'investment-highlights')
  const paras = (highlights?.subsections || []).flatMap((s) => s.body)
  doc.setFont('times', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...TEXT)
  for (const p of paras) {
    const wrapped = doc.splitTextToSize(p, W - M * 2) as string[]
    for (const l of wrapped) {
      if (y > H - 70) { doc.addPage(); startBovPage(doc, 'Investment Highlights'); y = 104 }
      doc.text(l, M, y)
      y += 15
    }
    y += 6
  }

  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  doc.setFont('times', 'italic')
  y += 14
  if (y > H - 40) { doc.addPage(); startBovPage(doc, 'Offer Summary'); y = 104 }
  doc.text('This summary is provided on a confidential basis for the sole purpose of evaluating a potential acquisition. Figures are derived from owner-provided financial information and are subject to change upon completion of due diligence.', M, y, { maxWidth: W - M * 2 })

  if (opts?.returnBytes) {
    return new Uint8Array(doc.output('arraybuffer'))
  }
  doc.save(`${content.businessName.replace(/[^a-z0-9]+/gi, '_')}_BLI.pdf`)
}
