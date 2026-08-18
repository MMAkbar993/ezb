import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'
import type { FormValues } from '@/components/forms/DynamicFormFields'

// =============================================================================
// lib/pdfOverlay.ts — fills the client's REAL branded PDF templates (his
// actual Confidentiality Agreement, Buyer Profile Form, Seller Interview
// Form, etc.) instead of generating a brand-new plain document from scratch.
// Uses pdf-lib (unlike jsPDF, it can load and draw onto an EXISTING PDF's
// pages) so the output is his own document with the blanks filled in and a
// signature added — not a re-typeset summary. See lib/formPdf.ts for the
// older from-scratch renderer, still used as a fallback for any form type
// that doesn't have a real template mapped here yet.
// =============================================================================

export type OverlayFieldKind = 'text' | 'check' | 'multiline'

export interface OverlayField {
  key: string                 // FormValues key, or 'literal:<text>' for a fixed value
  page: number                 // 0-indexed, within THIS template's own pages
  x: number
  y: number                    // pdf-lib coords: origin bottom-left of the page
  kind?: OverlayFieldKind      // 'text' (default): draw the value; 'check': draw ✓ if truthy/matches; 'multiline': wrap within maxWidth
  fontSize?: number
  maxWidth?: number            // required for kind 'multiline'
  maxLines?: number            // multiline: overflow beyond this continues on an appended page
  matchValue?: string          // for kind 'check': only draw the mark if the field's value equals this
  bold?: boolean
}

export interface SignatureSpot {
  page: number
  nameX: number
  nameY: number
  dateX?: number
  dateY?: number
  noteX?: number                // small E-SIGN disclosure line position
  noteY?: number
}

export interface OverlayTemplate {
  name: string
  fields: OverlayField[]
  signature?: SignatureSpot
}

export interface OverlaySection {
  template: OverlayTemplate
  templateBytes: Uint8Array | ArrayBuffer
  values: FormValues
}

export interface ComposeOptions {
  signerName?: string
  signerTitle?: string
  signedAt?: string
  ipNote?: string
}

const INK = rgb(0.13, 0.13, 0.18)

function displayValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return ''
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
}

function wrapToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line)
      line = w
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines
}

/**
 * Fills one or more real PDF templates with form values and concatenates
 * them into a single output document (e.g. the real Confidentiality
 * Agreement followed by the real Buyer Profile Form — two separate branded
 * documents in real life, delivered as one downloadable file here).
 */
export async function composeFilledPdf(sections: OverlaySection[], opts: ComposeOptions = {}): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  const regularFont = await out.embedFont(StandardFonts.Helvetica)
  const boldFont = await out.embedFont(StandardFonts.HelveticaBold)
  const italicFont = await out.embedFont(StandardFonts.TimesRomanItalic)

  for (const section of sections) {
    const src = await PDFDocument.load(section.templateBytes)
    const pageIndices = src.getPages().map((_, i) => i)
    const copiedPages = await out.copyPages(src, pageIndices)
    for (const p of copiedPages) out.addPage(p)

    const basePageIndex = out.getPageCount() - copiedPages.length
    const overflowNotes: string[] = []

    // Reserved keys a field map can reference for a "Printed Name:" /
    // "Dated as of:" row elsewhere on the page, distinct from the styled
    // signature line itself.
    const values: FormValues = {
      ...section.values,
      ...(opts.signedAt ? { _signed_date: new Date(opts.signedAt).toLocaleDateString('en-US') } : {}),
      ...(opts.signerName ? { _signer_name: opts.signerName } : {}),
      ...(opts.signerTitle ? { _signer_title: opts.signerTitle } : {}),
    }

    for (const field of section.template.fields) {
      const page = out.getPage(basePageIndex + field.page)
      const size = field.fontSize ?? 10
      const font = field.bold ? boldFont : regularFont

      if (field.kind === 'check') {
        // matchValue compares against the displayed string (e.g. a select's
        // 'Yes'/'No'); with no matchValue the field is a plain boolean
        // checkbox — check the raw value directly, since displayValue(false)
        // returns the string "No" (truthy) and would wrongly check every box.
        const matches = field.matchValue
          ? displayValue(values[field.key]) === field.matchValue
          : !!values[field.key]
        if (matches) page.drawText('X', { x: field.x, y: field.y, size: size, font: boldFont, color: INK })
        continue
      }

      const raw = field.key.startsWith('literal:') ? field.key.slice(8) : displayValue(values[field.key])
      if (!raw) continue

      if (field.kind === 'multiline' && field.maxWidth) {
        const lines = wrapToWidth(raw, font, size, field.maxWidth)
        const lineHeight = size + 2
        const maxLines = field.maxLines ?? lines.length
        let y = field.y
        for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
          page.drawText(lines[i], { x: field.x, y, size, font, color: INK })
          y -= lineHeight
        }
        if (lines.length > maxLines) {
          overflowNotes.push(`${field.key}: ${lines.slice(maxLines).join(' ')}`)
        }
      } else {
        page.drawText(raw, { x: field.x, y: field.y, size, font, color: INK })
      }
    }

    if (section.template.signature && opts.signerName) {
      const sig = section.template.signature
      const page = out.getPage(basePageIndex + sig.page)
      page.drawText(opts.signerName, { x: sig.nameX, y: sig.nameY, size: 13, font: italicFont, color: INK })
      if (opts.signedAt && sig.dateX !== undefined && sig.dateY !== undefined) {
        const dateStr = new Date(opts.signedAt).toLocaleDateString('en-US')
        page.drawText(dateStr, { x: sig.dateX, y: sig.dateY, size: 10, font: regularFont, color: INK })
      }
      if (sig.noteX !== undefined && sig.noteY !== undefined) {
        page.drawText(
          'Signed electronically — valid under the Pennsylvania Electronic Transactions Act (73 P.S. § 2260.101 et seq.) and the federal E-SIGN Act (15 U.S.C. § 7001 et seq.).',
          { x: sig.noteX, y: sig.noteY, size: 6.5, font: regularFont, color: rgb(0.45, 0.45, 0.5) },
        )
      }
    }

    if (overflowNotes.length) {
      appendContinuationPage(out, regularFont, boldFont, section.template.name, overflowNotes)
    }
  }

  return out.save()
}

function appendContinuationPage(doc: PDFDocument, font: PDFFont, boldFont: PDFFont, sourceName: string, notes: string[]) {
  const page = doc.addPage([612, 792])
  let y = 740
  page.drawText(`Continued — ${sourceName}`, { x: 56, y, size: 13, font: boldFont, color: INK })
  y -= 24
  page.drawText('The following answer(s) did not fit within the original form field and continue here:', { x: 56, y, size: 9, font, color: rgb(0.4, 0.4, 0.45) })
  y -= 20
  for (const note of notes) {
    const lines = wrapToWidth(note, font, 10, 500)
    for (const line of lines) {
      page.drawText(line, { x: 56, y, size: 10, font, color: INK })
      y -= 14
    }
    y -= 8
  }
}
