import { supabase } from '@/lib/supabase/client'
import { getSignedFileUrl, getAccessToken } from '@/lib/financialFiles'
import { FF_BUCKET } from '@/lib/storageBuckets'
import { SELLER_FORM_SCHEMAS, type SellerFormType } from '@/lib/sellerFormSchemas'

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

// deal_documents: id, deal_id, file_name, file_url, uploaded_by, created_at,
// storage_path, category (last two added by sql/deal_documents_storage_path.sql),
// visible_to_seller, visible_to_buyer, uploaded_by_role (sql/document_sharing_scope.sql)
export interface DealDocument {
  id: string
  deal_id: string | null
  file_name: string | null
  file_url: string | null
  uploaded_by: string | null
  created_at?: string | null
  storage_path?: string | null
  category?: string | null
  visible_to_seller?: boolean
  visible_to_buyer?: boolean
  uploaded_by_role?: string | null
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

// financial_documents: id, listing_id, deal_id, file_name, file_url,
// storage_path, category, status, uploaded_by, uploaded_at,
// visible_to_seller, visible_to_buyer (sql/document_sharing_scope.sql)
export interface FinancialDocument {
  id: string
  listing_id: string | null
  deal_id: string | null
  file_name: string | null
  file_url: string | null
  storage_path: string | null
  category: string | null
  status: string | null
  uploaded_by: string | null
  uploaded_at: string | null
  visible_to_seller?: boolean
  visible_to_buyer?: boolean
  [key: string]: unknown
}

// seller_forms: id, listing_id, form_type, status, pdf_url, signer_name,
// signed_at, updated_at (sql/seller_forms.sql)
export interface SellerFormDoc {
  id: string
  listing_id: string | null
  form_type: string
  status: string
  pdf_url: string | null
  signer_name: string | null
  signed_at: string | null
  updated_at: string | null
  [key: string]: unknown
}

// listing_nda_signatures: id, listing_id, buyer_name, pdf_url, signed_at
// (sql/listing_nda_signatures.sql + sql/buyer_qualification_fields.sql)
export interface BuyerFormDoc {
  id: string
  listing_id: string | null
  buyer_name: string
  pdf_url: string | null
  signed_at: string
  [key: string]: unknown
}

// A flat, normalized document row used by the UI regardless of source table
export interface DocumentItem {
  id: string
  source: 'deal' | 'listing' | 'financial' | 'seller_form' | 'buyer_form'  // which table it came from
  parentId: string                           // deal_id, listing_id, or financial doc's own listing_id
  parentName: string                         // resolved listing business name, used for grouping
  fileUrl: string | null                     // direct/public URL — null for financial docs (private bucket, resolved on demand)
  storagePath: string | null                 // set for financial docs — resolve via getSignedFileUrl
  fileName: string | null
  category: string | null
  uploadedBy: string | null
  uploadedByName: string | null
  createdAt: string | null
  visibleToSeller: boolean
  visibleToBuyer: boolean
}

// A group of every document for one listing (business name), regardless of
// which table each document actually lives in.
export interface DocumentGroup {
  id: string
  parentId: string     // listing_id
  parentName: string   // business name
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
 * Fetch every document for every listing — deal_documents, listing_documents,
 * AND financial_documents (source uploads + generated Recast/BOV/CIM/BLI) —
 * grouped into ONE card per listing (business name), not split by source
 * table. Previously this only pulled deal_documents + listing_documents and
 * produced two separate cards per listing; financial_documents (where the
 * real generated CIM/BOV/BLI/Recast and uploaded tax returns/P&Ls actually
 * live) never appeared here at all.
 */
export async function fetchDocumentGroups(): Promise<DocumentGroup[]> {
  const [listingsRes, dealsRes, dealDocsRes, listingDocsRes, financialDocsRes, profilesRes, sellerFormsRes, buyerFormsSettled] =
    await Promise.allSettled([
      supabase.from('listings').select('id, business_name'),
      supabase.from('deals').select('id, listing_id, status, purchase_price'),
      supabase.from('deal_documents').select('*'),
      supabase.from('listing_documents').select('*'),
      supabase.from('financial_documents').select('*'),
      supabase.from('profiles').select('id, full_name'),
      supabase.from('seller_forms').select('id, listing_id, form_type, status, pdf_url, signer_name, signed_at, updated_at').not('pdf_url', 'is', null),
      fetchAllBuyerFormDocs(),
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

  const financialDocs = (financialDocsRes.status === 'fulfilled' && !financialDocsRes.value.error
    ? (financialDocsRes.value.data || []) as FinancialDocument[]
    : []) ?? []

  const profiles = (profilesRes.status === 'fulfilled' && !profilesRes.value.error
    ? (profilesRes.value.data || []) as { id: string; full_name: string | null }[]
    : []) ?? []

  const sellerFormDocs = (sellerFormsRes.status === 'fulfilled' && !sellerFormsRes.value.error
    ? (sellerFormsRes.value.data || []) as SellerFormDoc[]
    : []) ?? []

  const buyerFormDocs = buyerFormsSettled.status === 'fulfilled' ? buyerFormsSettled.value : []

  const nameById = new Map(listings.map((l) => [l.id, l.business_name || l.headline || 'Untitled Listing']))
  const dealListingId = new Map(deals.map((d) => [d.id, d.listing_id || '']))
  const uploaderNameById = new Map(profiles.map((p) => [p.id, p.full_name || 'Unknown']))

  const groups = new Map<string, DocumentGroup>()

  const addDoc = (listingId: string, item: DocumentItem) => {
    const key = listingId || 'unassigned'
    const existing = groups.get(key)
    if (existing) {
      existing.documents.push(item)
    } else {
      groups.set(key, {
        id: key,
        parentId: listingId,
        parentName: nameById.get(listingId) || 'Untitled Listing',
        documents: [item],
      })
    }
  }

  // Deal documents — resolve back to the deal's listing_id
  for (const d of dealDocs) {
    const listingId = dealListingId.get(d.deal_id || '') || ''
    addDoc(listingId, {
      id: d.id,
      source: 'deal',
      parentId: d.deal_id || '',
      parentName: nameById.get(listingId) || 'Untitled Listing',
      fileUrl: d.file_url,
      storagePath: null,
      fileName: d.file_name || extractName(d.file_url),
      category: d.category || null,
      uploadedBy: d.uploaded_by,
      uploadedByName: uploaderNameById.get(d.uploaded_by || '') || 'Unknown',
      createdAt: d.created_at || null,
      visibleToSeller: d.visible_to_seller ?? true,
      visibleToBuyer: d.visible_to_buyer ?? false,
    })
  }

  // Listing documents (legal docs — NDA, listing agreement, etc.)
  for (const l of listingDocs) {
    addDoc(l.listing_id || '', {
      id: l.id,
      source: 'listing',
      parentId: l.listing_id || '',
      parentName: nameById.get(l.listing_id || '') || 'Untitled Listing',
      fileUrl: l.file_url,
      storagePath: null,
      fileName: extractName(l.file_url),
      category: toLabelCategory(l.category),
      uploadedBy: null,
      uploadedByName: '—',
      createdAt: l.created_at || null,
      visibleToSeller: true,
      visibleToBuyer: false,
    })
  }

  // Financial documents (source uploads + generated Recast/BOV/CIM/BLI) —
  // private bucket, so fileUrl stays null here; resolved on demand via
  // getDownloadUrl() below.
  for (const f of financialDocs) {
    const listingId = f.listing_id || dealListingId.get(f.deal_id || '') || ''
    addDoc(listingId, {
      id: f.id,
      source: 'financial',
      parentId: listingId,
      parentName: nameById.get(listingId) || 'Untitled Listing',
      fileUrl: null,
      storagePath: f.storage_path,
      fileName: f.file_name,
      category: f.category === 'generated_document' ? 'Generated Document' : toLabelCategory(f.category),
      uploadedBy: f.uploaded_by,
      uploadedByName: uploaderNameById.get(f.uploaded_by || '') || 'Unknown',
      createdAt: f.uploaded_at || null,
      visibleToSeller: f.visible_to_seller ?? true,
      visibleToBuyer: f.visible_to_buyer ?? false,
    })
  }

  // Seller legal-document forms (Seller Interview, Listing Agreement, Corp/
  // LLC Resolution, Documentation Checklist) — only rows with a generated
  // PDF (signed remotely, or completed in-app by the broker) show up here.
  for (const s of sellerFormDocs) {
    if (!s.pdf_url) continue
    const listingId = s.listing_id || ''
    const schema = SELLER_FORM_SCHEMAS[s.form_type as SellerFormType]
    addDoc(listingId, {
      id: s.id,
      source: 'seller_form',
      parentId: listingId,
      parentName: nameById.get(listingId) || 'Untitled Listing',
      fileUrl: null,
      storagePath: s.pdf_url,
      fileName: `${schema?.title || s.form_type}.pdf`,
      category: schema?.title || 'Seller Form',
      uploadedBy: null,
      uploadedByName: s.signer_name || '—',
      createdAt: s.signed_at || s.updated_at || null,
      visibleToSeller: true,
      visibleToBuyer: false,
    })
  }

  // Buyer NDA + Buyer Profile Form submissions (public gate or agent-entered)
  for (const b of buyerFormDocs) {
    if (!b.pdf_url) continue
    const listingId = b.listing_id || ''
    addDoc(listingId, {
      id: b.id,
      source: 'buyer_form',
      parentId: listingId,
      parentName: nameById.get(listingId) || 'Untitled Listing',
      fileUrl: null,
      storagePath: b.pdf_url,
      fileName: `NDA + Buyer Profile — ${b.buyer_name}.pdf`,
      category: 'NDA + Buyer Profile Form',
      uploadedBy: null,
      uploadedByName: b.buyer_name,
      createdAt: b.signed_at || null,
      visibleToSeller: true,
      visibleToBuyer: false,
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

// listing_nda_signatures has zero RLS (service-role only) — read through the
// authenticated API route rather than the browser client directly. Best-
// effort: an auth failure here shouldn't break the rest of the Documents
// dashboard, just omit these documents.
async function fetchAllBuyerFormDocs(): Promise<BuyerFormDoc[]> {
  try {
    const token = await getAccessToken()
    if (!token) return []
    const res = await fetch('/api/listing-nda-signatures', { headers: { Authorization: 'Bearer ' + token } })
    const data = await res.json()
    if (!data.ok) return []
    return (data.inquiries || []) as BuyerFormDoc[]
  } catch {
    return []
  }
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

const ACTION_LABEL: Record<DocumentItem['source'], string> = {
  deal: 'uploaded to deal',
  listing: 'attached to listing',
  financial: 'added to financial files',
  seller_form: 'completed seller form',
  buyer_form: 'signed NDA + Buyer Profile Form',
}

export async function fetchDocumentActivity(limit = 20): Promise<DocumentActivity[]> {
  const groups = await fetchDocumentGroups()
  const items: DocumentActivity[] = []

  for (const g of groups) {
    for (const doc of g.documents) {
      items.push({
        id: doc.id,
        action: ACTION_LABEL[doc.source],
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
    // category was previously dropped here even though the upload modal lets
    // the broker pick one — deal_documents has no CHECK constraint on it
    // (unlike listing_documents), so the UI label is stored as-is. This also
    // matters for the client-portal's buyer-visibility filter, which now
    // relies on this column to keep legal-category uploads (NDA, Purchase
    // Agreement, Marketing Agreement) out of buyer-facing "financial access."
    const { error: insertError } = await supabase.from('deal_documents').insert({
      deal_id: target.parentId,
      file_name: file.name,
      file_url: publicUrl,
      category,
      uploaded_by: (await supabase.auth.getUser()).data.user?.id || null,
      uploaded_by_role: 'broker',
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
  if (item.source === 'financial') {
    if (item.storagePath) await supabase.storage.from(FF_BUCKET).remove([item.storagePath]).catch(() => {})
    const { error } = await supabase.from('financial_documents').delete().eq('id', item.id)
    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  if (item.source === 'seller_form' || item.source === 'buyer_form') {
    return { success: false, error: `Manage this from ${item.source === 'seller_form' ? 'Legal Documents' : 'Buyer Inquiries'} on the listing's workflow instead.` }
  }

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
// Download — signed URL for private financial docs, public URL for the rest
// ---------------------------------------------------------------------------
export async function getDownloadUrl(item: DocumentItem): Promise<string | null> {
  if (item.source === 'financial' || item.source === 'seller_form' || item.source === 'buyer_form') {
    return item.storagePath ? getSignedFileUrl(item.storagePath) : null
  }
  if (!item.fileUrl) return null
  // Bucket is public, so the URL works directly. For <a download>, we return it as-is.
  return item.fileUrl
}

// ---------------------------------------------------------------------------
// Sharing — broker toggles per-document buyer/seller visibility. Applies to
// deal_documents and financial_documents (listing_documents are broker/
// seller-internal legal paperwork, not shared through the client portal).
// ---------------------------------------------------------------------------
export async function setDocumentVisibility(
  item: DocumentItem,
  patch: { visibleToSeller?: boolean; visibleToBuyer?: boolean }
): Promise<{ success: boolean; error?: string }> {
  if (item.source === 'listing' || item.source === 'seller_form' || item.source === 'buyer_form') {
    return { success: false, error: 'This document type is not shared through the client portal.' }
  }
  const table = item.source === 'financial' ? 'financial_documents' : 'deal_documents'
  const dbPatch: Record<string, boolean> = {}
  if (patch.visibleToSeller !== undefined) dbPatch.visible_to_seller = patch.visibleToSeller
  if (patch.visibleToBuyer !== undefined) dbPatch.visible_to_buyer = patch.visibleToBuyer
  const { error } = await supabase.from(table).update(dbPatch).eq('id', item.id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}
