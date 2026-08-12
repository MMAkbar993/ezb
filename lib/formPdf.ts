import { jsPDF } from 'jspdf'
import type { SellerFormSection } from '@/lib/sellerFormSchemas'
import type { FormValues } from '@/components/forms/DynamicFormFields'

// =============================================================================
// lib/formPdf.ts — generic "filled form → PDF" renderer, shared by the seller
// legal documents (Part 2) and the buyer NDA + Buyer Profile Form (Part 3).
// Reuses the exact jsPDF conventions established in lib/pdfExport.ts (navy/
// gold palette, Times font, A4 pt units, cover page + confidentiality
// footer, returnBytes flag for server-side use) rather than introducing a
// new PDF engine or a new visual language.
// =============================================================================

const NAVY: [number, number, number] = [26, 26, 46]
const GOLD: [number, number, number] = [201, 168, 76]
const TEXT: [number, number, number] = [43, 43, 58]
const MUTED: [number, number, number] = [122, 122, 138]

export interface FilledFormPdfInput {
  title: string
  subtitle: string
  intro?: string
  sections: SellerFormSection[]
  values: FormValues
  signerName?: string | null
  signerTitle?: string | null
  signedAt?: string | null
  ipNote?: string | null
}

function displayValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
}

export function exportFilledFormToPdf(input: FilledFormPdfInput, opts?: { returnBytes?: boolean }): Uint8Array | void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 56

  // ---- Cover ----
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, H, 'F')
  doc.setFillColor(...GOLD)
  doc.rect(0, H * 0.42, W, 2.5, 'F')

  doc.setTextColor(...GOLD)
  doc.setFont('times', 'bold')
  doc.setFontSize(26)
  const titleLines = doc.splitTextToSize(input.title, W - M * 2) as string[]
  let y = H * 0.48
  for (const l of titleLines) { doc.text(l, M, y); y += 32 }

  doc.setTextColor(255, 255, 255)
  doc.setFont('times', 'normal')
  doc.setFontSize(15)
  y += 10
  doc.text(input.subtitle, M, y)

  doc.setFontSize(10)
  doc.setTextColor(200, 200, 200)
  y += 26
  doc.text(`Prepared: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, M, y)
  y += 16
  doc.text('CONCORD DEAL PLATFORM · EZ BUSINESS ADVISORS LLC', M, y)

  // ---- Content ----
  doc.addPage()
  let sy = 0
  const startPage = () => {
    doc.setFillColor(255, 255, 255)
    doc.rect(0, 0, W, H, 'F')
    doc.setFillColor(...NAVY)
    doc.rect(0, 0, W, 70, 'F')
    doc.setFillColor(...GOLD)
    doc.rect(0, 70, W, 2, 'F')
    doc.setTextColor(...GOLD)
    doc.setFont('times', 'bold')
    doc.setFontSize(13)
    doc.text(input.title, M, 44)
    sy = 100
  }
  startPage()

  const ensureSpace = (needed: number) => {
    if (sy + needed > H - 60) { doc.addPage(); startPage() }
  }

  if (input.intro) {
    doc.setFont('times', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...MUTED)
    const wrapped = doc.splitTextToSize(input.intro, W - M * 2) as string[]
    for (const l of wrapped) { ensureSpace(14); doc.text(l, M, sy); sy += 13 }
    sy += 14
  }

  for (const section of input.sections) {
    ensureSpace(30)
    doc.setFont('times', 'bold')
    doc.setFontSize(12.5)
    doc.setTextColor(...NAVY)
    doc.text(section.title, M, sy)
    doc.setFillColor(...GOLD)
    doc.rect(M, sy + 6, 40, 1.5, 'F')
    sy += 24

    for (const field of section.fields) {
      const val = displayValue(input.values[field.key])
      doc.setFont('times', 'bold')
      doc.setFontSize(9.5)
      doc.setTextColor(...MUTED)
      ensureSpace(28)
      doc.text(field.label, M, sy)
      sy += 13
      doc.setFont('times', 'normal')
      doc.setFontSize(11)
      doc.setTextColor(...TEXT)
      const wrapped = doc.splitTextToSize(val, W - M * 2) as string[]
      for (const l of wrapped) { ensureSpace(15); doc.text(l, M, sy); sy += 15 }
      sy += 8
    }
    sy += 8
  }

  // ---- Signature block ----
  if (input.signerName) {
    ensureSpace(90)
    doc.setFont('times', 'bold')
    doc.setFontSize(12.5)
    doc.setTextColor(...NAVY)
    doc.text('Signature', M, sy)
    sy += 20
    doc.setFont('times', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(...TEXT)
    doc.text(`Signed by: ${input.signerName}${input.signerTitle ? ' — ' + input.signerTitle : ''}`, M, sy)
    sy += 16
    if (input.signedAt) { doc.text(`Date: ${new Date(input.signedAt).toLocaleString('en-US')}`, M, sy); sy += 16 }
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    doc.text('Signed electronically. Valid under the Pennsylvania Electronic Transactions Act (73 P.S. § 2260.101 et seq.) and the federal E-SIGN Act (15 U.S.C. § 7001 et seq.).', M, sy, { maxWidth: W - M * 2 })
    if (input.ipNote) { sy += 24; doc.setFontSize(8); doc.text(input.ipNote, M, sy) }
  }

  // ---- Confidentiality footer (final page) ----
  doc.addPage()
  startPage()
  doc.setFont('times', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...NAVY)
  doc.text('Confidentiality', M, sy)
  sy += 20
  doc.setFont('times', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...MUTED)
  const disc = doc.splitTextToSize(
    'This document contains confidential and proprietary information prepared in connection with a potential business transaction through EZ Business Advisors LLC. It is provided solely for evaluation purposes and may not be reproduced or disclosed without prior written consent.',
    W - M * 2,
  ) as string[]
  for (const l of disc) { doc.text(l, M, sy); sy += 14 }

  if (opts?.returnBytes) {
    return new Uint8Array(doc.output('arraybuffer'))
  }
  doc.save(`${input.title.replace(/[^a-z0-9]+/gi, '_')}.pdf`)
}
