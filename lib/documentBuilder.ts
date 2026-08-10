import { supabase } from '@/lib/supabase/client'

// ===========================================================================
// Document builder + signature + audit support for the Concord Deal Platform.
//
// These call the tables created in sql/document_compliance_realestate_schema.sql:
//   document_templates, documents, document_signatures, document_audit_logs.
// All reads/writes go through Supabase with RLS applied.
// ===========================================================================

// --- Field & party shapes (mirror the JSONB in document_templates) ---------

export type FieldType = 'text' | 'number' | 'date' | 'select' | 'textarea' | 'signature'

export interface TemplateField {
  key: string
  label: string
  type: FieldType
  required?: boolean
  options?: string[]
  placeholder?: string
}

export interface TemplateParty {
  key: string
  label: string
  role: 'agent' | 'seller' | 'buyer' | 'custom'
}

export interface DocumentTemplate {
  id: string
  name: string
  description: string | null
  category: string | null
  fields: TemplateField[]
  parties: TemplateParty[]
  body_template: string | null
  is_active: boolean
  created_by: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface FilledDocument {
  id: string
  template_id: string | null
  listing_id: string | null
  deal_id: string | null
  title: string
  status: 'draft' | 'pending_signature' | 'signed' | 'rejected' | 'archived'
  filled_data: Record<string, unknown>
  parties: FilledParty[]
  created_by: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface FilledParty {
  key: string
  label: string
  role: 'agent' | 'seller' | 'buyer' | 'custom'
  name: string | null
  email: string | null
}

export interface DocumentSignature {
  id: string
  document_id: string
  party_key: string
  party_name: string | null
  party_email: string | null
  role: string | null
  status: 'unsigned' | 'signed' | 'declined' | 'expired'
  signature_data: Record<string, unknown> | null
  signed_at?: string | null
  created_at?: string | null
}

// --- Templates --------------------------------------------------------------

export async function fetchTemplates(activeOnly = true): Promise<DocumentTemplate[]> {
  let q = supabase.from('document_templates').select('*')
  if (activeOnly) q = q.eq('is_active', true)
  const { data, error } = await q.order('name', { ascending: true })
  if (error) throw new Error(error.message || 'Failed to load templates')
  return (data as DocumentTemplate[]) || []
}

export async function fetchTemplate(id: string): Promise<DocumentTemplate | null> {
  const { data, error } = await supabase.from('document_templates').select('*').eq('id', id).maybeSingle()
  if (error || !data) return null
  return data as DocumentTemplate
}

// --- Documents (fillable instances) -----------------------------------------

export async function fetchDocuments(listingId?: string): Promise<FilledDocument[]> {
  let q = supabase.from('documents').select('*').order('created_at', { ascending: false })
  if (listingId) q = q.eq('listing_id', listingId)
  const { data, error } = await q
  if (error) throw new Error(error.message || 'Failed to load documents')
  return (data as FilledDocument[]) || []
}

export interface CreateDocumentInput {
  template_id: string
  listing_id?: string | null
  deal_id?: string | null
  title: string
  filled_data: Record<string, unknown>
  parties: FilledParty[]
}

export async function createDocument(input: CreateDocumentInput): Promise<FilledDocument> {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('documents')
    .insert({
      template_id: input.template_id,
      listing_id: input.listing_id ?? null,
      deal_id: input.deal_id ?? null,
      title: input.title,
      status: 'draft',
      filled_data: input.filled_data,
      parties: input.parties,
      created_by: user?.id ?? null,
    })
    .select()
    .single()
  if (error || !data) throw new Error(error?.message || 'Failed to create document')

  // Seed signature rows for each party so the UI can render sign slots.
  for (const p of input.parties) {
    await supabase.from('document_signatures').insert({
      document_id: data.id,
      party_key: p.key,
      party_name: p.name,
      party_email: p.email,
      role: p.role,
      status: 'unsigned',
    })
  }
  await logAction(data.id, user?.id ?? null, 'created', { template_id: input.template_id })

  return data as FilledDocument
}

export async function updateDocument(
  id: string,
  patch: Partial<Pick<FilledDocument, 'title' | 'filled_data' | 'parties' | 'status'>>,
): Promise<void> {
  const { error } = await supabase.from('documents').update(patch).eq('id', id)
  if (error) throw new Error(error.message || 'Failed to update document')
  if (patch.status) {
    const { data: { user } } = await supabase.auth.getUser()
    await logAction(id, user?.id ?? null, 'status_changed', { status: patch.status })
  }
}

// --- Signatures ---------------------------------------------------------------

export async function fetchSignatures(documentId: string): Promise<DocumentSignature[]> {
  const { data, error } = await supabase
    .from('document_signatures')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message || 'Failed to load signatures')
  return (data as DocumentSignature[]) || []
}

export async function signDocument(
  signatureId: string,
  partyName: string,
  signatureData: Record<string, unknown>,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('document_signatures')
    .update({ status: 'signed', party_name: partyName, signature_data: signatureData, signed_at: new Date().toISOString() })
    .eq('id', signatureId)
  if (error) throw new Error(error.message || 'Failed to record signature')

  const { data: sig } = await supabase.from('document_signatures').select('document_id').eq('id', signatureId).single()
  if (sig) await logAction(sig.document_id, user?.id ?? null, 'signed', { party: partyName })
}

// --- Audit log ----------------------------------------------------------------

interface AuditEntry {
  id: string
  document_id: string
  actor_id: string | null
  action: string
  detail: Record<string, unknown> | null
  created_at?: string | null
}

export async function fetchAuditLog(documentId: string): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from('document_audit_logs')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message || 'Failed to load audit log')
  return (data as AuditEntry[]) || []
}

async function logAction(
  documentId: string,
  actorId: string | null,
  action: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  await supabase.from('document_audit_logs').insert({ document_id: documentId, actor_id: actorId, action, detail })
}

// --- Rendering helper: fill body_template placeholders ------------------------

export function renderTemplateBody(body: string | null, filled: Record<string, unknown>): string {
  if (!body) return ''
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const v = filled[key]
    if (v == null || v === '') return `[${key}]`
    return String(v)
  })
}
