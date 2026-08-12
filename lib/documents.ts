import { supabase } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Document categories (UI labels) and their DB-storage mapping.
//
// The live `listing_documents` table has a restrictive category allow-list:
//   nda | purchase_agreement | marketing_agreement | other
// (and a status allow-list: pending | signed; party_type: seller | buyer).
// The UI labels are Title Case, so we map them to the snake_case storage
// values below, and map back on read.
// ---------------------------------------------------------------------------
export const DOCUMENT_CATEGORIES = [
  'Marketing Agreement',
  'NDA',
  'Purchase Agreement',
  'Due Diligence',
  'Other',
] as const

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]

// UI label -> DB category (falls back to 'other' for labels not in the allow-list)
const CATEGORY_TO_DB: Record<string, string> = {
  'Marketing Agreement': 'marketing_agreement',
  NDA: 'nda',
  'Purchase Agreement': 'purchase_agreement',
  'Due Diligence': 'other', // not in the live allow-list; stored as 'other'
  Other: 'other',
}
export const toDbCategory = (label: string): string => CATEGORY_TO_DB[label] || 'other'
export const toLabelCategory = (db: string | null | undefined): string =>
  db === 'nda' ? 'NDA'
  : db === 'marketing_agreement' ? 'Marketing Agreement'
  : db === 'purchase_agreement' ? 'Purchase Agreement'
  : 'Other'

// ---------------------------------------------------------------------------
// Types representing the real Supabase schema
// ---------------------------------------------------------------------------
// listings: id, agent_id, business_name, headline, industry, status, etc.
export interface Listing {
  id: string
  business_name: string | null
  headline?: string | null
  industry?: string | null
  status?: string | null
  agent_id?: string | null
  [key: string]: unknown
}

// deals: id, listing_id, status, purchase_price, created_at, updated_at
export interface Deal {
  id: string
  listing_id: string | null
  status: string | null
  purchase_price: number | null
  created_at?: string | null
  updated_at?: string | null
  [key: string]: unknown
}

// deal_documents: id, deal_id, file_name, file_url, uploaded_by, created_at
export interface DealDocument {
  id: string
  deal_id: string | null
  file_name: string | null
  file_url: string | null
  uploaded_by: string | null
  created_at?: string | null
  [key: string]: unknown
}

// listing_documents: id, listing_id, file_url, category, status, created_at
export interface ListingDocument {
  id: string
  listing_id: string | null
  file_url: string | null
  category: string | null
  status: string | null
  created_at?: string | null
  [key: string]: unknown
}

// A flat, normalized document row used by the UI regardless of source table
export interface DocumentItem {
  id: string
  source: 'deal' | 'listing'          // which table it came from
  parentId: string                     // deal_id or listing_id
  parentName: string                   // resolved name for grouping
  fileUrl: string | null
  fileName: string | null
  category: string | null
  uploadedBy: string | null
  uploadedByName: string | null
  createdAt: string | null
}

// A group of documents under one deal/listing parent
export interface DocumentGroup {
  id: string
  source: 'deal' | 'listing'
  parentId: string
  parentName: string
  documents: DocumentItem[]
}

// ---------------------------------------------------------------------------
// Upload result / preview type detection
// ---------------------------------------------------------------------------
export function fileKind(url: string | null): 'pdf' | 'excel' | 'word' | 'image' | 'other' {
  if (!url) return 'other'
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase() || ''
  if (ext === 'pdf') return 'pdf'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'excel'
  if (['doc', 'docx'].includes(ext)) return 'word'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image'
  return 'other'
}

export function fileIcon(kind: ReturnType<typeof fileKind>): string {
  switch (kind) {
    case 'pdf': return '📄'
    case 'excel': return '📊'
    case 'word': return '📝'
    case 'image': return '🖼️'
    default: return '📁'
  }
}

// ---------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------
/**
 * Fetch all deals + listings, then their documents.
 * Resolves parent names and uploader names. Fails soft if joins are unavailable.
 */
export async function fetchDocumentGroups(): Promise<DocumentGroup[]> {
  // 1. Load listings (names) and deals (names via listing_id)
  const [listingsRes, dealsRes, dealDocsRes, listingDocsRes, profilesRes] =
    await Promise.allSettled([
      supabase.from('listings').select('id, business_name'),
      supabase.from('deals').select('id, listing_id, status, purchase_price'),
      supabase.from('deal_documents').select('*'),
      supabase.from('listing_documents').select('*'),
      supabase.from('profiles').select('id, full_name'),
    ])

  const listings = (listingsRes.status === 'fulfilled' && !listingsRes.value.error
    ? (listingsRes.value.data || []) as Listing[]
    : []) ?? []

  const deals = (dealsRes.status === 'fulfilled' && !dealsRes.value.error
    ? (dealsRes.value.data || []) as Deal[]
    : []) ?? []

  const dealDocs = (dealDocsRes.status === 'fulfilled' && !dealDocsRes.value.error
    ? (dealDocsRes.value.data || []) as DealDocument[]
    : []) ?? []

  const listingDocs = (listingDocsRes.status === 'fulfilled' && !listingDocsRes.value.error
    ? (listingDocsRes.value.data || []) as ListingDocument[]
    : []) ?? []

  const profiles = (profilesRes.status === 'fulfilled' && !profilesRes.value.error
    ? (profilesRes.value.data || []) as { id: string; full_name: string | null }[]
    : []) ?? []

  const nameById = new Map(listings.map((l) => [l.id, l.business_name || l.headline || 'Untitled Listing']))
  const dealNameById = new Map(deals.map((d) => [d.id, nameById.get(d.listing_id || '') || 'Untitled Deal']))
  const uploaderNameById = new Map(profiles.map((p) => [p.id, p.full_name || 'Unknown']))

  const groups = new Map<string, DocumentGroup>()

  const addDoc = (item: DocumentItem) => {
    const key = `${item.source}:${item.parentId}`
    const existing = groups.get(key)
    if (existing) {
      existing.documents.push(item)
    } else {
      groups.set(key, {
        id: key,
        source: item.source,
        parentId: item.parentId,
        parentName: item.parentName,
        documents: [item],
      })
    }
  }

  // Deal documents
  for (const d of dealDocs) {
    addDoc({
      id: d.id,
      source: 'deal',
      parentId: d.deal_id || '',
      parentName: dealNameById.get(d.deal_id || '') || 'Untitled Deal',
      fileUrl: d.file_url,
      fileName: d.file_name || extractName(d.file_url),
      category: null,
      uploadedBy: d.uploaded_by,
      uploadedByName: uploaderNameById.get(d.uploaded_by || '') || 'Unknown',
      createdAt: d.created_at || null,
    })
  }

  // Listing documents
  for (const l of listingDocs) {
    addDoc({
      id: l.id,
      source: 'listing',
      parentId: l.listing_id || '',
      parentName: nameById.get(l.listing_id || '') || 'Untitled Listing',
      fileUrl: l.file_url,
      fileName: extractName(l.file_url),
      category: toLabelCategory(l.category),
      uploadedBy: null,
      uploadedByName: '—',
      createdAt: l.created_at || null,
    })
  }

  // Sort: parent groups alphabetically, docs within by created date desc
  const sortedGroups = Array.from(groups.values())
    .sort((a, b) => a.parentName.localeCompare(b.parentName))

  for (const g of sortedGroups) {
    g.documents.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  }

  return sortedGroups
}

function extractName(url: string | null): string {
  if (!url) return 'Untitled document'
  const path = url.split('?')[0].split('/').pop() || ''
  return decodeURIComponent(path)
}

// ---------------------------------------------------------------------------
// Activity log — derived from all documents (who uploaded what, when)
// ---------------------------------------------------------------------------
export interface DocumentActivity {
  id: string
  action: string
  docName: string
  actorName: string | null
  parentName: string
  at: string | null
}

export async function fetchDocumentActivity(limit = 20): Promise<DocumentActivity[]> {
  const groups = await fetchDocumentGroups()
  const items: DocumentActivity[] = []

  for (const g of groups) {
    for (const doc of g.documents) {
      items.push({
        id: doc.id,
        action: g.source === 'deal' ? 'uploaded to deal' : 'attached to listing',
        docName: doc.fileName || 'Untitled document',
        actorName: doc.uploadedByName && doc.uploadedByName !== '—' ? doc.uploadedByName : null,
        parentName: g.parentName,
        at: doc.createdAt,
      })
    }
  }

  return items
    .filter((i) => i.at)
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''))
    .slice(0, limit)
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
export const DOCUMENT_BUCKET = 'documents'

export async function uploadDocument(
  target: { source: 'deal' | 'listing'; parentId: string },
  file: File,
  category: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (file.size > MAX_SIZE) {
    return { success: false, error: `File must be less than ${MAX_SIZE / 1024 / 1024}MB` }
  }

  const prefix = target.source === 'deal' ? `deal/${target.parentId}` : `listing/${target.parentId}`
  const safeCategory = category.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${prefix}/${safeCategory}/${Date.now()}-${safeName}`

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    })

  if (uploadError) {
    return { success: false, error: uploadError.message }
  }

  // Build public URL
  const { data: urlData } = supabase.storage.from(DOCUMENT_BUCKET).getPublicUrl(path)
  const publicUrl = urlData?.publicUrl

  // Insert into the appropriate table
  if (target.source === 'deal') {
    const { error: insertError } = await supabase.from('deal_documents').insert({
      deal_id: target.parentId,
      file_name: file.name,
      file_url: publicUrl,
      uploaded_by: (await supabase.auth.getUser()).data.user?.id || null,
    })
    if (insertError) return { success: false, error: insertError.message }
  } else {
    // listing_documents has a NOT NULL `party_type` and a status allow-list
    // of pending | signed, plus the restrictive category constraint above.
    const { error: insertError } = await supabase.from('listing_documents').insert({
      listing_id: target.parentId,
      file_url: publicUrl,
      category: toDbCategory(category),
      status: 'pending',
      party_type: 'seller',
    })
    if (insertError) return { success: false, error: insertError.message }
  }

  return { success: true, url: publicUrl }
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------
export async function deleteDocument(item: DocumentItem): Promise<{ success: boolean; error?: string }> {
  // Remove storage object if we can derive its path from the URL
  const urlPath = item.fileUrl?.split('/object/public/')[1]
  if (urlPath) {
    await supabase.storage.from(DOCUMENT_BUCKET).remove([urlPath]).catch(() => {})
  }

  const table = item.source === 'deal' ? 'deal_documents' : 'listing_documents'
  const { error } = await supabase.from(table).delete().eq('id', item.id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ---------------------------------------------------------------------------
// Download - create a signed URL for private files, or public URL directly
// ---------------------------------------------------------------------------
export async function getDownloadUrl(item: DocumentItem): Promise<string | null> {
  if (!item.fileUrl) return null
  // Bucket is public, so the URL works directly. For <a download>, we return it as-is.
  return item.fileUrl
}
