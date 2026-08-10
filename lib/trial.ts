'use client'

// =============================================================================
// Trial helpers — client-side trial status, days remaining, usage limits, and
// the trial vs paid feature matrix. Mirrors the authority of the server cron /
// conversion routes; these helpers drive UI badges, banners, and enforceLimits
// gate-checks in the client. Data comes from the current user's agency.
// =============================================================================

import { supabase } from '@/lib/supabase/client'
import { fetchUserAgencyContext, type Agency } from '@/lib/agencies'

export type TrialStatus = 'active' | 'ending_soon' | 'expired' | 'grace' | 'locked' | 'paid' | 'none'

export interface TrialState {
  status: TrialStatus
  daysRemaining: number
  trialStart: string | null
  trialEnd: string | null
  graceEnd: string | null
  lockedAt: string | null
  planType: string
  isTrial: boolean
  isPaid: boolean
}

export interface AgencyUsage {
  listingsUsed: number
  leadsUsed: number
  dealsUsed: number
  storageUsedBytes: number
  agentsUsed: number
}

export interface UsageLimits {
  maxListings: number
  maxLeads: number
  maxDeals: number
  maxAgents: number
  maxStorageBytes: number
}

/** Reserved feature gate keys — see FEATURE_MATRIX. */
export type FeatureKey =
  | 'listings' | 'leads' | 'deals' | 'agents' | 'storage'
  | 'cim_bov' | 'ai_agents' | 'social_media' | 'email_campaigns' | 'branding'

export interface Feature {
  key: FeatureKey
  label: string
  trial: boolean | number | string
  paid: boolean | number | string
  kind: 'bool' | 'limit'
}

/** Trial vs Paid feature matrix (matches the request spec). */
export const FEATURE_MATRIX: Feature[] = [
  { key: 'listings', label: 'Listings', trial: 5, paid: 'Unlimited', kind: 'limit' },
  { key: 'leads', label: 'Leads', trial: 20, paid: 'Unlimited', kind: 'limit' },
  { key: 'deals', label: 'Deals', trial: 5, paid: 'Unlimited', kind: 'limit' },
  { key: 'agents', label: 'Agents', trial: 3, paid: 'Unlimited', kind: 'limit' },
  { key: 'storage', label: 'Storage', trial: 100, paid: 'Unlimited', kind: 'limit' }, // MB
  { key: 'cim_bov', label: 'CIM / BOV Generators', trial: true, paid: true, kind: 'bool' },
  { key: 'ai_agents', label: 'AI Agents', trial: true, paid: true, kind: 'bool' },
  { key: 'social_media', label: 'Social Media', trial: false, paid: true, kind: 'bool' },
  { key: 'email_campaigns', label: 'Email Campaigns', trial: false, paid: true, kind: 'bool' },
  { key: 'branding', label: 'Branding', trial: 'Basic', paid: 'Full', kind: 'bool' },
]

export const PLAN_NAMES: Record<string, string> = {
  free: 'Free', starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise',
}

const DAY_MS = 86_400_000
export const ENDING_SOON_DAYS = 3

/** Determine trial/plan status from an agency row. */
export function statusFromAgency(a: Agency | null): TrialState {
  const empty: TrialState = {
    status: 'none', daysRemaining: 0, trialStart: null, trialEnd: null,
    graceEnd: null, lockedAt: null, planType: 'free', isTrial: false, isPaid: false,
  }
  if (!a) return empty

  const now = Date.now()
  const trialEnd = a.trial_end_date ? new Date(a.trial_end_date).getTime() : null
  const trialStart = a.trial_start_date ? new Date(a.trial_start_date).getTime() : null
  const graceEnd = a.grace_end_date ? new Date(a.grace_end_date).getTime() : null
  const lockedAt = a.locked_at ? new Date(a.locked_at).getTime() : null
  const planType = (a as any).plan_type || 'free'

  if (a.paid_plan_active) {
    return { ...empty, status: 'paid', planType, isPaid: true }
  }

  const isTrial = !!a.trial_active && !!trialEnd

  if (isTrial && trialEnd) {
    const days = Math.ceil((trialEnd - now) / DAY_MS)
    return {
      status: days <= ENDING_SOON_DAYS ? 'ending_soon' : 'active',
      daysRemaining: Math.max(0, days), trialStart: a.trial_start_date, trialEnd: a.trial_end_date,
      graceEnd: a.grace_end_date || null, lockedAt: a.locked_at || null, planType,
      isTrial: true, isPaid: false,
    }
  }

  // Trial ended — was there a grace window?
  if (graceEnd) {
    if (now < graceEnd) {
      return { ...empty, status: 'grace', graceEnd: a.grace_end_date, trialStart: a.trial_start_date, daysRemaining: Math.ceil((graceEnd - now) / DAY_MS), planType }
    }
    // past grace but not locked yet
    if (!lockedAt) {
      return { ...empty, status: 'expired', graceEnd: a.grace_end_date, trialStart: a.trial_start_date, planType }
    }
    return { ...empty, status: 'locked', lockedAt: a.locked_at, trialStart: a.trial_start_date, planType }
  }

  if (lockedAt) return { ...empty, status: 'locked', lockedAt: a.locked_at, planType }
  return { ...empty, status: 'expired', trialStart: a.trial_start_date, planType }
}

// --- Default limits ----------------------------------------------------------
export const DEFAULT_LIMITS: UsageLimits = {
  maxListings: 5, maxLeads: 20, maxDeals: 5, maxAgents: 3, maxStorageBytes: 100 * 1024 * 1024,
}

/** Fetch trial settings (global default + any per-agency override). */
export async function fetchTrialSettings(agencyId?: string | null): Promise<UsageLimits & { trialDays: number; graceDays: number; archiveDays: number; sendReminders: boolean }> {
  const global = { trialDays: 14, graceDays: 7, archiveDays: 30, sendReminders: true, ...DEFAULT_LIMITS }
  try {
    const { data } = await supabase.from('trial_settings').select('*').order('created_at', { ascending: true })
    const rows: any[] = data || []
    const perAgency = agencyId ? rows.find((r) => r.agency_id === agencyId) : null
    const g = rows.find((r) => r.agency_id === null) || {}
    return {
      trialDays: perAgency?.trial_days ?? g.trial_days ?? global.trialDays,
      graceDays: perAgency?.grace_days ?? g.grace_days ?? global.graceDays,
      archiveDays: perAgency?.archive_days ?? g.archive_days ?? global.archiveDays,
      sendReminders: perAgency?.send_reminders ?? g.send_reminders ?? global.sendReminders,
      maxListings: perAgency?.max_listings ?? g.max_listings ?? global.maxListings,
      maxLeads: perAgency?.max_leads ?? g.max_leads ?? global.maxLeads,
      maxDeals: perAgency?.max_deals ?? g.max_deals ?? global.maxDeals,
      maxAgents: perAgency?.max_agents ?? g.max_agents ?? global.maxAgents,
      maxStorageBytes: ((perAgency?.max_storage_mb ?? g.max_storage_mb ?? 100) * 1024 * 1024),
    }
  } catch {
    return global as any
  }
}

/** Load the current user's agency and its trial state. */
export async function getMyTrialState(): Promise<{ state: TrialState; agency: Agency | null }> {
  const ctx = await fetchUserAgencyContext()
  return { state: statusFromAgency(ctx.agency), agency: ctx.agency }
}

/** Load current usage counters for the agency. */
export async function getAgencyUsage(agencyId: string): Promise<AgencyUsage> {
  const { data } = await supabase
    .from('agency_usage')
    .select('listings_used, leads_used, deals_used, storage_used')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return { listingsUsed: 0, leadsUsed: 0, dealsUsed: 0, storageUsedBytes: 0, agentsUsed: 0 }
  return {
    listingsUsed: data.listings_used || 0,
    leadsUsed: data.leads_used || 0,
    dealsUsed: data.deals_used || 0,
    storageUsedBytes: data.storage_used || 0,
    agentsUsed: 0, // resolved from agency_members count in usage bump route
  }
}

/** Is the user allowed to do `count = 1` more of a feature key? */
export function checkUsageLimits(usage: AgencyUsage, limits: UsageLimits, state: TrialState, key: FeatureKey): { allowed: boolean; reason?: string } {
  if (state.isPaid) return { allowed: true } // unlimited on paid
  if (state.status === 'grace' || state.status === 'expired' || state.status === 'locked') {
    return { allowed: false, reason: 'Your trial has ended. Upgrade to continue creating.' }
  }
  switch (key) {
    case 'listings': return usage.listingsUsed < limits.maxListings ? { allowed: true } : { allowed: false, reason: `Trial limited to ${limits.maxListings} listings. Upgrade for unlimited.` }
    case 'leads': return usage.leadsUsed < limits.maxLeads ? { allowed: true } : { allowed: false, reason: `Trial limited to ${limits.maxLeads} leads. Upgrade for unlimited.` }
    case 'deals': return usage.dealsUsed < limits.maxDeals ? { allowed: true } : { allowed: false, reason: `Trial limited to ${limits.maxDeals} deals. Upgrade for unlimited.` }
    case 'agents': return usage.agentsUsed < limits.maxAgents ? { allowed: true } : { allowed: false, reason: `Trial limited to ${limits.maxAgents} agents. Upgrade for unlimited.` }
    case 'storage': return usage.storageUsedBytes < limits.maxStorageBytes ? { allowed: true } : { allowed: false, reason: 'Trial storage limit reached. Upgrade for unlimited storage.' }
    default: return { allowed: true }
  }
}

/** Boolean-gated features (social, email campaigns). Returns blocked redirect hint. */
export function isFeatureEnabled(state: TrialState, key: FeatureKey): boolean {
  if (key === 'social_media' || key === 'email_campaigns') return state.isPaid
  return true
}

/**
 * Gate a page/action in a read-only block. Used for the grace/locked read-only
 * mode: callers check `enforceLimits` and, if blocked, render a read-only view
 * instead of allowing creates.
 */
export function enforceLimits(state: TrialState): { blocked: boolean; mode: 'normal' | 'read_only' | 'locked'; reason?: string } {
  if (state.isPaid) return { blocked: false, mode: 'normal' }
  if (state.status === 'grace') return { blocked: true, mode: 'read_only', reason: `Your trial ended. You're in a read-only grace period until ${state.graceEnd ? new Date(state.graceEnd).toLocaleDateString() : 'soon'}. Upgrade to keep creating.` }
  if (state.status === 'expired') return { blocked: true, mode: 'read_only', reason: 'Your trial has ended. Data is preserved — upgrade to create again.' }
  if (state.status === 'locked') return { blocked: true, mode: 'locked', reason: 'Your account is locked. Contact us to restore access.' }
  return { blocked: false, mode: 'normal' }
}
