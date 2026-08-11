import { supabase } from '@/lib/supabase/client'
import { fetchListings } from '@/lib/listings'
import { fetchPipelineDeals, PIPELINE_STAGES } from '@/lib/pipeline'
import { fetchLeadStats } from '@/lib/leads2'

// ---------------------------------------------------------------------------
// Dashboard metrics — corrected against REAL schema.
// deals columns: id, listing_id, status, purchase_price, created_at, updated_at
// ---------------------------------------------------------------------------

export interface DashboardStats {
  totalListings: number
  activeListings: number
  totalDeals: number
  pendingDeals: number
  totalLeads: number
  newLeads: number
}

export interface FunnelPoint {
  stage: string
  value: number
}

export interface ActivityItem {
  id: string
  kind: 'deal' | 'lead' | 'note'
  title: string
  detail?: string
  createdAt: string | null
}

const PENDING_STAGES = ['letter_of_intent', 'under_contract', 'due_diligence', 'closing']

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const [listings, pipelineDeals, leadStats] = await Promise.allSettled([
    fetchListings(),
    fetchPipelineDeals(),
    fetchLeadStats(),
  ])

  const allListings = listings.status === 'fulfilled' ? listings.value : []
  const ptpDeals = pipelineDeals.status === 'fulfilled' ? pipelineDeals.value : []
  const ls = leadStats.status === 'fulfilled' ? leadStats.value : { total: 0, newLeads: 0, buyers: 0, sellers: 0 }

  const pendingDeals = ptpDeals.filter((d) => PENDING_STAGES.includes(d.stage)).length

  return {
    totalListings: allListings.length,
    activeListings: allListings.filter((l) => l.status === 'active').length,
    totalDeals: ptpDeals.length,
    pendingDeals,
    totalLeads: ls.total,
    newLeads: ls.newLeads,
  }
}

export async function fetchPipelineFunnel(): Promise<FunnelPoint[]> {
  const deals = await fetchPipelineDeals()
  return PIPELINE_STAGES.map((s) => ({
    stage: s.label,
    value: deals.filter((d) => d.stage === s.id).length,
  }))
}

export async function fetchRecentActivity(): Promise<ActivityItem[]> {
  // Combine deals + leads as recent activity (best-effort; no dedicated audit table)
  const [dealsRes, leadsRes, cimRes, bovRes] = await Promise.allSettled([
    supabase.from('deals').select('id, listing_id, status, purchase_price, created_at, updated_at').order('updated_at', { ascending: false }).limit(8),
    supabase.from('seller_leads').select('*').order('created_at', { ascending: false }).limit(5),
    // cim_versions/bov_versions use generated_at (not created_at) live — confirmed
    // 2026-08-11. Ordering by a nonexistent column silently dropped these from the
    // activity feed via the allSettled/error check below.
    supabase.from('cim_versions').select('*').order('generated_at', { ascending: false }).limit(5),
    supabase.from('bov_versions').select('*').order('generated_at', { ascending: false }).limit(5),
  ])

  const items: ActivityItem[] = []

  if (dealsRes.status === 'fulfilled' && !dealsRes.value.error) {
    for (const d of (dealsRes.value.data || [])) {
      items.push({
        id: 'deal-' + d.id,
        kind: 'deal',
        title: `Deal ${d.status || 'letter_of_intent'}`,
        detail: d.purchase_price ? `$` + Math.round(d.purchase_price).toLocaleString() : 'Price TBD',
        createdAt: d.updated_at || d.created_at,
      })
    }
  }
  if (leadsRes.status === 'fulfilled' && !leadsRes.value.error) {
    for (const l of (leadsRes.value.data || [])) {
      items.push({
        id: 'lead-' + l.id,
        kind: 'lead',
        title: `New seller lead: ${l.business_name || 'Unnamed'}`,
        detail: l.status,
        createdAt: l.created_at,
      })
    }
  }
  if (cimRes.status === 'fulfilled' && !cimRes.value.error) {
    for (const c of (cimRes.value.data || [])) {
      items.push({ id: 'cim-' + c.id, kind: 'note', title: `CIM version ${c.version_number} ${c.status}`, detail: '', createdAt: c.generated_at })
    }
  }
  if (bovRes.status === 'fulfilled' && !bovRes.value.error) {
    for (const b of (bovRes.value.data || [])) {
      items.push({ id: 'bov-' + b.id, kind: 'note', title: `BOV version ${b.version_number} ${b.status}`, detail: '', createdAt: b.generated_at })
    }
  }

  items.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return tb - ta
  })

  return items.slice(0, 12)
}

export async function fetchUpcomingTasks(): Promise<ActivityItem[]> {
  const { data, error } = await supabase
    .from('due_diligence_items')
    .select('*')
    .order('due_date', { ascending: true })
    .limit(10)
  if (error || !data) return []
  return (data as any[]).map((d) => ({
    id: 'dd-' + d.id,
    kind: 'note',
    title: d.title || 'Due diligence task',
    detail: d.status || 'pending',
    createdAt: d.due_date,
  }))
}
