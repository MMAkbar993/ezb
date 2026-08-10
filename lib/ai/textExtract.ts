// =============================================================================
// lib/ai/textExtract.ts — server-side raw text extraction from documents.
// -----------------------------------------------------------------------------
// SERVER-ONLY. Extracts readable text from stored documents so Claude can read
// them: PDFs (pdf-parse), plain text/CSV (direct), and a graceful fallback for
// unsupported binaries (Office/images) where we can't OCR server-side yet.
// =============================================================================

import type { ExtractedTextResult } from '@/lib/ai/types'
import { isPlainTextType, truncateForClaude } from '@/lib/ai/documentAnalyzer'

// Re-export the type predicate + truncator so the route stays thin.
export { isPlainTextType, truncateForClaude }

// Lazy, memoized pdf-parse (keeps module load cost off cold start hot path).
let pdfParse: ((data: Buffer) => Promise<{ text: string }>) | null = null
async function getPdfParser() {
  if (!pdfParse) {
    const mod: any = await import('pdf-parse')
    const fn = mod?.default || mod
    pdfParse = (data: Buffer) => fn(data)
  }
  return pdfParse
}

/**
 * Extract up-to-bounded plain text from a document buffer based on its MIME +
 * file extension. Returns truncated text + metadata.
 */
export async function extractDocumentText({
  fileName,
  mime,
  data,
}: {
  fileName: string
  mime: string | null
  data: Buffer
}): Promise<ExtractedTextResult> {
  const n = fileName.toLowerCase()
  const m = mime || ''

  let raw = ''

  if (isPlainTextType(mime, fileName)) {
    raw = data.toString('utf8')
  } else {
    const isPdf = m === 'application/pdf' || n.endsWith('.pdf')
    if (isPdf) {
      try {
        const parser = await getPdfParser()
        const r = await parser(data)
        raw = r.text || ''
      } catch (e) {
        raw = ''
      }
    }
    // Word/Excel/images: not OCR'd server-side (no OCR dep installed).
    // We return empty text; the analyzer will rely on filename heuristics.
  }

  const { text, truncated } = truncateForClaude(raw || '')

  return {
    fileName,
    mimeType: mime,
    text,
    truncated,
    byteLength: data.byteLength,
  }
}

/**
 * Best-effort structured CSV parse into a lightweight normalized row set so a
 * text/CSV financial file can feed the extractor even before Claude.
 */
export function csvToRows(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []
  const header = lines[0].split(/[,;\t]/).map((h) => h.trim().toLowerCase())
  const rows: Record<string, string>[] = []
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const cells = line.split(/[,;\t]/)
    const rec: Record<string, string> = {}
    header.forEach((h, i) => { rec[h] = (cells[i] || '').trim() })
    rows.push(rec)
  }
  return rows
}
