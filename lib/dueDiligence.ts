import { supabase } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Due Diligence Tracker
// due_diligence_items real columns: id, deal_id, title, status, due_date,
// created_at. Plus added: category, assignee, notes (via sql/full_schema.sql).
// ---------------------------------------------------------------------------

export type DDStatus = 'pending' | 'in_review' | 'approved' | 'rejected' | 'waived'

export const DD_STATUSES: { id: DDStatus; label: string; color: string }[] = [
  { id: 'pending', label: 'Pending', color: '#94a3b8' },
  { id: 'in_review', label: 'In Review', color: '#f59e0b' },
  { id: 'approved', label: 'Approved', color: '#22c55e' },
  { id: 'rejected', label: 'Rejected', color: '#ef4444' },
  { id: 'waived', label: 'Waived', color: '#8b5cf6' },
]

export const statusMeta = (s?: string | null) =>
  DD_STATUSES.find((x) => x.id === s) || { id: 'pending', label: 'Pending', color: '#94a3b8' }

export interface DDItem {
  id: string
  deal_id: string | null
  title: string
  category: string | null
  status: string
  due_date: string | null
  assignee: string | null
  notes: string | null
  created_at?: string | null
}

export interface DDInput {
  deal_id: string
  title: string
  category?: string
  status?: DDStatus
  due_date?: string | null
  assignee?: string | null
  notes?: string | null
}

export async function fetchDDItems(dealId?: string): Promise<DDItem[]> {
  let q = supabase.from('due_diligence_items').select('*')
  if (dealId) q = q.eq('deal_id', dealId)
  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) {
    console.error('fetchDDItems error:', error)
    throw new Error(error.message || 'Failed to load due diligence items')
  }
  return (data as DDItem[]) || []
}

export async function createDDItem(input: DDInput): Promise<DDItem> {
  const { data, error } = await supabase
    .from('due_diligence_items')
    .insert({
      deal_id: input.deal_id,
      title: input.title,
      category: input.category || 'General',
      status: input.status || 'pending',
      due_date: input.due_date || null,
      assignee: input.assignee || null,
      notes: input.notes || null,
    })
    .select()
    .single()
  if (error) {
    console.error('createDDItem error:', error)
    throw new Error(error.message || 'Failed to create due diligence item')
  }
  return data as DDItem
}

export async function updateDDItem(id: string, input: Partial<DDInput>): Promise<DDItem> {
  const { data, error } = await supabase
    .from('due_diligence_items')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) {
    console.error('updateDDItem error:', error)
    throw new Error(error.message || 'Failed to update due diligence item')
  }
  return data as DDItem
}

export async function deleteDDItem(id: string): Promise<void> {
  const { error } = await supabase.from('due_diligence_items').delete().eq('id', id)
  if (error) {
    console.error('deleteDDItem error:', error)
    throw new Error(error.message || 'Failed to delete due diligence item')
  }
}

export const isOverdue = (item: DDItem): boolean => {
  if (!item.due_date) return false
  const due = new Date(item.due_date + 'T00:00:00')
  return due < new Date() && item.status !== 'approved' && item.status !== 'waived'
}
