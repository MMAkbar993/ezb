import { supabase } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Seller Lead CRUD — configured to the REAL seller_leads schema:
//   id, business_name, email, phone, status, created_at
// (Probed live 2026-07-30; columns like name/notes/asking_price do NOT exist
//  on this table, so we don't reference them.)
// ---------------------------------------------------------------------------

export type LeadStatus = 'new' | 'qualifying' | 'qualified' | 'handed_off' | 'not_a_fit'

export interface SellerLead {
  id: string
  business_name: string | null
  email: string | null
  phone: string | null
  status: LeadStatus | string
  created_at?: string | null
}

export interface SellerLeadInput {
  business_name: string
  email: string
  phone: string
  status: LeadStatus
}

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------
export const LEAD_STATUSES: { id: LeadStatus; label: string; color: string }[] = [
  { id: 'new', label: 'New', color: '#3b82f6' },
  { id: 'qualifying', label: 'Qualifying', color: '#f59e0b' },
  { id: 'qualified', label: 'Qualified', color: '#8b5cf6' },
  { id: 'handed_off', label: 'Handed Off', color: '#22c55e' },
  { id: 'not_a_fit', label: 'Not a Fit', color: '#ef4444' },
]

export const statusMeta = (status: string | null | undefined) =>
  LEAD_STATUSES.find((s) => s.id === status) || {
    id: status || 'new',
    label: status || 'New',
    color: '#94a3b8',
  }

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------
export async function fetchSellerLeads(): Promise<SellerLead[]> {
  const { data, error } = await supabase
    .from('seller_leads')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchSellerLeads error:', error)
    throw new Error(error.message || 'Failed to load seller leads')
  }
  return (data as SellerLead[]) || []
}

export async function createSellerLead(input: SellerLeadInput): Promise<SellerLead> {
  const { data, error } = await supabase
    .from('seller_leads')
    .insert({
      business_name: input.business_name,
      email: input.email || null,
      phone: input.phone || null,
      status: input.status,
    })
    .select()
    .single()

  if (error) {
    console.error('createSellerLead error:', error)
    throw new Error(error.message || 'Failed to create seller lead')
  }
  return data as SellerLead
}

export async function updateSellerLead(id: string, input: SellerLeadInput): Promise<SellerLead> {
  const { data, error } = await supabase
    .from('seller_leads')
    .update({
      business_name: input.business_name,
      email: input.email || null,
      phone: input.phone || null,
      status: input.status,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('updateSellerLead error:', error)
    throw new Error(error.message || 'Failed to update seller lead')
  }
  return data as SellerLead
}

export async function updateSellerLeadStatus(id: string, status: LeadStatus): Promise<void> {
  const { error } = await supabase
    .from('seller_leads')
    .update({ status })
    .eq('id', id)

  if (error) {
    console.error('updateSellerLeadStatus error:', error)
    throw new Error(error.message || 'Failed to update lead status')
  }
}

export async function deleteSellerLead(id: string): Promise<void> {
  const { error } = await supabase.from('seller_leads').delete().eq('id', id)
  if (error) {
    console.error('deleteSellerLead error:', error)
    throw new Error(error.message || 'Failed to delete seller lead')
  }
}

// ---------------------------------------------------------------------------
// Activity logging
// Uses the `lead_activities` table — create it with the SQL in
// sql/create_activity_tables.sql if it does not exist.
// ---------------------------------------------------------------------------
export interface LeadActivity {
  id: string
  lead_id: string
  type: string
  description: string
  created_at?: string | null
}

export async function fetchLeadActivities(leadId: string): Promise<LeadActivity[]> {
  const { data, error } = await supabase
    .from('lead_activities')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })

  if (error) {
    // Table may not exist yet — surface empty instead of crashing
    console.warn('fetchLeadActivities error (table may not exist):', error.message)
    return []
  }
  return (data as LeadActivity[]) || []
}

export async function addLeadActivity(
  leadId: string,
  type: string,
  description: string
): Promise<LeadActivity> {
  const { data, error } = await supabase
    .from('lead_activities')
    .insert({ lead_id: leadId, type, description })
    .select()
    .single()

  if (error) {
    console.error('addLeadActivity error:', error)
    throw new Error(error.message || 'Failed to log activity (is the lead_activities table created?)')
  }
  return data as LeadActivity
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0] || '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
