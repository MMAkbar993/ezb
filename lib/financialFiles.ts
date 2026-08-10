'use client'

// =============================================================================
// lib/financialFiles.ts — data layer for the Financial Files system.
// -----------------------------------------------------------------------------
// Per-deal/listing financial document management: multi-file upload with
// per-file progress, auto-tagging (tax return / financial statement / bank
// statement / generated document), workflow status tracking, preview +
// download, and role-scoped delete (agent deletes own; broker/admin delete any).
// =============================================================================

import { supabase } from '@/lib/supabase/client'

export const FF_BUCKET = 'documents'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type FileKind = 'pdf' | 'excel' | 'word' | 'image' | 'other'
export type FinancialCategory =
  | 'tax_return'
  | 'financial_statement'
  | 'bank_statement'
  | 'generated_document'
  | 'other'

export type FinancialStatus =
  | 'pending'
  | 'processed'
  | 'recast_done'
  | 'bov_done'
  | 'cim_done'
  | 'bli_done'
  | 'failed'

export interface FinancialDoc {
  id: string
  deal_id: string | null
  listing_id: string | null
  file_name: string
  file_url: string
  storage_path: string | null
  file_size: number | null
  mime_type: string | null
  file_kind: FileKind
  category: FinancialCategory
  status: FinancialStatus
  notes: string | null
  uploaded_by: string | null
  uploaded_at: string | null
}

export interface UploadProgress {
  fileName: string
  uploaded: boolean
  error?: string
  percent: number
}

// ---------------------------------------------------------------------------
// Lookups / labels
// ---------------------------------------------------------------------------
export const CATEGORY_LABELS: Record<FinancialCategory, string> = {
  tax_return: 'Tax Return',
  financial_statement: 'Financial Statement',
  bank_statement: 'Bank Statement',
  generated_document: 'Generated Document',
  other: 'Other',
}

export const CATEGORY_COLORS: Record<FinancialCategory, string> = {
  tax_return: '#0e7490',          // teal
  financial_statement: '#1a3a8f', // navy-blue
  bank_statement: '#0f3460',      // dark navy
  generated_document: '#a8872f',  // gold-dark
  other: '#7a7a8a',               // muted
}

export const STATUS_LABELS: Record<FinancialStatus, string> = {
  pending: 'Pending',
  processed: 'Processed',
  recast_done: 'Recast Done',
  bov_done: 'BOV Done',
  cim_done: 'CIM Done',
  bli_done: 'BLI Done',
  failed: 'Failed',
}

export const STATUS_COLORS: Record<FinancialStatus, string> = {
  pending: '#7a7a8a',
  processed: '#0f3460',
  recast_done: '#a8872f',
  bov_done: '#0e7490',
  cim_done: '#16a34a',
  bli_done: '#7c3aed',
  failed: '#dc2626',
}

// ---------------------------------------------------------------------------
// File kind + icon + color
// ---------------------------------------------------------------------------
export function fileKindOf(name: string): FileKind {
  const ext = name.split('?')[0].split('.').pop()?.toLowerCase() || ''
  if (ext === 'pdf') return 'pdf'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'excel'
  if (['doc', 'docx'].includes(ext)) return 'word'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image'
  return 'other'
}

export const FILE_ICON: Record<FileKind, string> = {
  pdf: '📄',
  excel: '📊',
  word: '📝',
  image: '🖼️',
  other: '📁',
}

export const FILE_COLOR: Record<FileKind, string> = {
  pdf: '#dc2626',
  excel: '#16a34a',
  word: '#2563eb',
  image: '#9333ea',
  other: '#7a7a8a',
}

export const FILE_LABEL: Record<FileKind, string> = {
  pdf: 'PDF',
  excel: 'Excel',
  word: 'Word',
  image: 'Image',
  other: 'Other',
}

// ---------------------------------------------------------------------------
// Auto-tagging — detect financial document category from the file name
// ---------------------------------------------------------------------------
const TAX_RE = /tax|return|1040|1120|1120s|1065|k-1|k1|w-2|w2|1099/i
const BANK_RE = /(^|[^a-z])bank|[^a-z]account statement|statement of account/i
const FIN_STMT_RE = /p&l|pnl|profit\s*(and|&|\/)\s*loss|income statement|balance sheet|financial statement|trial balance/i
const GENERATED_RE = /cim|bov|recast|bli|business listing/i

export function autoTagCategory(fileName: string): FinancialCategory {
  const n = fileName.toLowerCase()
  if (TAX_RE.test(n)) return 'tax_return'
  if (BANK_RE.test(n)) return 'bank_statement'
  if (FIN_STMT_RE.test(n)) return 'financial_statement'
  if (GENERATED_RE.test(n)) return 'generated_document'
  return 'other'
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// ---------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------
export async function fetchFinancialFiles(): Promise<FinancialDoc[]> {
  const { data, error } = await supabase
    .from('financial_documents')
    .select('*')
    .order('uploaded_at', { ascending: false })
  if (error) throw error
  return (data || []) as FinancialDoc[]
}

export async function fetchDealOptions(): Promise<{ id: string; title: string }[]> {
  const [dealsRes, listingsRes] = await Promise.allSettled([
    supabase.from('deals').select('id, listing_id, title').limit(200),
    supabase.from('listings').select('id, business_name').limit(200),
  ])

  const deals = (dealsRes.status === 'fulfilled' && !dealsRes.value.error
    ? (dealsRes.value.data || []) as any[]
    : [])
  const listings = (listingsRes.status === 'fulfilled' && !listingsRes.value.error
    ? (listingsRes.value.data || []) as { id: string; business_name: string | null }[]
    : [])

  const listingName = new Map(listings.map((l) => [l.id, l.business_name || 'Untitled Listing']))

  const opts = deals.map((d) => ({
    id: d.id,
    title: d.title || listingName.get(d.listing_id) || `Deal ${d.id.slice(0, 8)}`,
  }))

  // Also surface standalone listings that have no deal yet
  const listedIds = new Set(deals.map((d) => d.listing_id).filter(Boolean))
  for (const l of listings) {
    if (!listedIds.has(l.id)) {
      opts.push({ id: l.id, title: `${l.business_name || 'Untitled Listing'} (Listing)` })
    }
  }

  return opts.sort((a, b) => a.title.localeCompare(b.title))
}

// Resolve whether an option is a deal or a listing (heuristic: has a deal prefix
// or not). We store whichever id the user picked; parent linkage handled by RLS
// rules + the deal_id/listing_id columns we set explicitly.
export function currentUser(): string | null {
  // Best-effort: gets resolved asynchronously via getUserId() in callers.
  return null
}

export async function getUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser()
    return data?.user?.id || null
  } catch {
    return null
  }
}

export async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession()
    return data?.session?.access_token || null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Multi-file upload with per-file progress + auto-tag + insert
// ---------------------------------------------------------------------------
const MAX_SIZE = 25 * 1024 * 1024 // 25 MB

export async function uploadFinancialFiles(
  target: { dealId: string | null; listingId: string | null; parentId: string },
  files: File[],
  onProgress?: (p: UploadProgress[]) => void
): Promise<{ ok: number; failed: number; errors: string[] }> {
  const userId = await getUserId()
  const result = { ok: 0, failed: 0, errors: [] as string[] }
  const progress: UploadProgress[] = files.map((f) => ({
    fileName: f.name,
    uploaded: false,
    percent: 0,
  }))

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    try {
      if (file.size > MAX_SIZE) {
        throw new Error(`"${file.name}" is over ${MAX_SIZE / 1024 / 1024}MB`)
      }

      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `financial-files/${target.parentId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safe}`
      const category = autoTagCategory(file.name)
      const kind = fileKindOf(file.name)

      // Upload with progress via XMLHttpRequest isn't supported by supabase-js
      // directly (it uses fetch). We simulate progress per file for UX:
      // 40% on start / 80% on upload / 100% on insert.
      progress[i].percent = 20
      onProgress?.([...progress])

      const { error: upErr } = await supabase.storage
        .from(FF_BUCKET)
        .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })
      if (upErr) throw new Error(`Upload failed for "${file.name}": ${upErr.message}`)

      progress[i].percent = 80
      onProgress?.([...progress])

      const { data: urlData } = supabase.storage.from(FF_BUCKET).getPublicUrl(path)
      const publicUrl = urlData?.publicUrl

      const row = {
        deal_id: target.dealId,
        listing_id: target.listingId,
        file_name: file.name,
        file_url: publicUrl,
        storage_path: path,
        file_size: file.size,
        mime_type: file.type || null,
        file_kind: kind,
        category,
        status: 'pending' as FinancialStatus,
        uploaded_by: userId,
      }

      const { error: insErr } = await supabase.from('financial_documents').insert(row)
      if (insErr) throw new Error(`DB insert failed for "${file.name}": ${insErr.message}`)

      progress[i].percent = 100
      progress[i].uploaded = true
      result.ok++
    } catch (e: any) {
      progress[i].uploaded = false
      progress[i].error = e?.message || 'Upload failed'
      result.failed++
      result.errors.push(progress[i].error)
    }
    onProgress?.([...progress])
  }

  return result
}

// ---------------------------------------------------------------------------
// Delete — removes storage object + DB row. RLS enforces owner/broker rule.
// ---------------------------------------------------------------------------
export async function deleteFinancialFile(doc: FinancialDoc): Promise<{ success: boolean; error?: string }> {
  if (doc.storage_path) {
    await supabase.storage.from(FF_BUCKET).remove([doc.storage_path]).catch(() => {})
  } else {
    const urlPath = doc.file_url?.split('/object/public/')[1]
    if (urlPath) await supabase.storage.from(FF_BUCKET).remove([urlPath]).catch(() => {})
  }

  const { error } = await supabase.from('financial_documents').delete().eq('id', doc.id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ---------------------------------------------------------------------------
// Update status (Recast done / BOV done / CIM done / Processed)
// ---------------------------------------------------------------------------
export async function updateFinancialStatus(docId: string, status: FinancialStatus): Promise<boolean> {
  const { error } = await supabase.from('financial_documents').update({ status }).eq('id', docId)
  return !error
}

// ---------------------------------------------------------------------------
// Preview — files are public in the 'documents' bucket, so the URL works for
// preview (<iframe>/<img>) and download (anchor with `download`).
// ---------------------------------------------------------------------------
export function previewKind(kind: FileKind): 'pdf' | 'img' | 'none' {
  if (kind === 'pdf') return 'pdf'
  if (kind === 'image') return 'img'
  return 'none'
}
