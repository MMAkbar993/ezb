// =============================================================================
// Financial document upload + extraction for the Recasting Engine.
// Uploads raw financial docs (tax returns, P&Ls, balance sheets, CSV/Excel)
// to Supabase Storage, and auto-extracts structured figures.
//
// Real OCR/ML can be plugged into the `extractFinancialDocument` function —
// today it performs heuristic CSV parsing in-browser and returns a clear
// "uploaded, awaiting extraction" state for images/PDFs.
// =============================================================================

import { supabase } from '@/lib/supabase/client'
import { parseFinancialCsv, ExtractedRow } from '@/lib/recast'

export const FINANCIAL_DOC_BUCKET = 'financial_docs'

// Allowed MIME types
const ALLOWED = [
  'application/pdf',
  'text/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'application/json',
]

export interface UploadedFinancialDoc {
  id: string
  fileName: string
  mimeType: string
  size: number
  publicUrl: string
  kind: 'tax_return' | 'p_l' | 'balance_sheet' | 'csv' | 'excel' | 'image' | 'other'
  extracted: boolean
  extractedRows?: ExtractedRow[]
}

const kindFromMime = (mime: string, fileName: string): UploadedFinancialDoc['kind'] => {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (mime === 'text/csv' || ext === 'csv') return 'csv'
  if (mime.includes('spreadsheet') || ext === 'xls' || ext === 'xlsx') return 'excel'
  if (mime.includes('pdf')) return 'p_l' // default; user can retag
  if (mime.startsWith('image/')) return 'image'
  return 'other'
}

export async function uploadedFinancialDocs(listingId: string): Promise<UploadedFinancialDoc[]> {
  const { data, error } = await supabase.storage.from(FINANCIAL_DOC_BUCKET).list(listingId || 'general')
  if (error || !data) return []
  const docs = data.filter((f) => f.name !== '.emptyFolderPlaceholder')
  return Promise.all(
    docs.map(async (f) => {
      const mime = (f.metadata as any)?.mimetype || (f.metadata as any)?.mimeType || 'application/octet-stream'
      const { data: urlData } = supabase.storage.from(FINANCIAL_DOC_BUCKET).getPublicUrl(`${listingId || 'general'}/${f.name}`)
      return {
        id: f.id || f.name,
        fileName: f.name,
        mimeType: mime,
        size: f.metadata?.size || 0,
        publicUrl: urlData.publicUrl,
        kind: kindFromMime(mime, f.name),
        extracted: false,
      }
    }),
  )
}

export async function uploadFinancialDocument(listingId: string, file: File): Promise<UploadedFinancialDoc> {
  const cleanId = listingId || 'general'
  const path = `${cleanId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const { error } = await supabase.storage.from(FINANCIAL_DOC_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '3600',
  })
  if (error) throw new Error(error.message || 'Upload failed')

  const { data: urlData } = supabase.storage.from(FINANCIAL_DOC_BUCKET).getPublicUrl(path)
  return {
    id: path,
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
    publicUrl: urlData.publicUrl,
    kind: kindFromMime(file.type, file.name),
    extracted: false,
  }
}

export async function deleteFinancialDocument(listingId: string, fileName: string): Promise<void> {
  const cleanId = listingId || 'general'
  const { error } = await supabase.storage.from(FINANCIAL_DOC_BUCKET).remove([`${cleanId}/${fileName}`])
  if (error) throw new Error(error.message || 'Delete failed')
}

/**
 * Auto-extract structured figures from an uploaded financial document.
 * CSV files are parsed in-browser. PDF/image docs are marked for OCR — the
 * actual server-side OCR call can be wired here (e.g. Tesseract.js, an edge
 * function, or an AI vision model). Returns extracted rows if available.
 */
export async function extractFinancialDocument(doc: UploadedFinancialDoc, lastYear: number): Promise<ExtractedRow[]> {
  // CSV: parse in-browser
  if (doc.kind === 'csv' || doc.mimeType === 'text/csv' || doc.fileName.toLowerCase().endsWith('.csv') || doc.fileName.toLowerCase().endsWith('.txt')) {
    try {
      const res = await fetch(doc.publicUrl)
      const text = await res.text()
      return parseFinancialCsv(text, lastYear)
    } catch {
      return []
    }
  }

  // For PDFs/images, we attempt OCR only if a content source is available.
  // Returning [] signals "needs OCR" — the UI shows a pending badge.
  return []
}

// Persist extracted rows to base64 metadata for quick re-load (self-hosting fallback)
export async function extractToJson(listingId: string, doc: UploadedFinancialDoc): Promise<void> {
  const res = await fetch(doc.publicUrl)
  const blob = await res.blob()
  const text = await blob.text()
  await supabase.storage
    .from(FINANCIAL_DOC_BUCKET)
    .upload(`${listingId || 'general'}/extracted-${doc.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`,
      new Blob([JSON.stringify({ source: doc.fileName, rows: parseFinancialCsv(text, new Date().getFullYear() - 1) })], { type: 'application/json' }),
      { upsert: true })
}
