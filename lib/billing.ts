// =============================================================================
// Subscription billing — tiers, plans, and management.
// Integrates with Stripe (schema in sql/phase2_schema.sql). Checkout calls are
// structured to hit a real Stripe Checkout session; the createBillingSession
// helper is where you wire your publishable key / server endpoint.
// =============================================================================

import { supabase } from '@/lib/supabase/client'

// --- Plan definitions ---
export interface Plan {
  id: string
  name: string
  monthly: number
  icon: string
  tagline: string
  features: string[]
  cta: string
  highlighted?: boolean
}

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    monthly: 9,
    icon: '🌱',
    tagline: 'For solo brokers getting started',
    features: [
      'Up to 5 active listings',
      'Deal pipeline (1 board)',
      'Lead management (100 leads)',
      'CIM & BOV generation',
      'Document management (2GB)',
      'Email support',
    ],
    cta: 'Start Free Trial',
  },
  {
    id: 'professional',
    name: 'Professional',
    monthly: 99,
    icon: '💼',
    tagline: 'For growing brokerages',
    highlighted: true,
    features: [
      'Unlimited active listings',
      'Deal pipeline (unlimited)',
      'Unlimited leads & CRM',
      'CIM & BOV generation + PDF',
      'Financial recasting engine',
      'Public marketplace listing',
      'Document management (50GB)',
      '3 broker seats',
      'Priority support',
    ],
    cta: 'Start Free Trial',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthly: 199,
    icon: '🏛️',
    tagline: 'For multi-broker agencies',
    features: [
      'Everything in Professional',
      'Multi-broker / agency system',
      'White-label branding & subdomains',
      'Unlimited seats',
      'Public marketplace + featured',
      'BizBuySell integration',
      'API & webhooks',
      'Dedicated account manager',
    ],
    cta: 'Contact Sales',
  },
]

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled'

export interface Subscription {
  id: string
  profile_id: string
  agency_id: string | null
  tier: string
  stripe_customer: string | null
  stripe_sub: string | null
  status: SubscriptionStatus
  current_period_end: string | null
  trial_end: string | null
  seats: number
  created_at?: string | null
}

export interface Invoice {
  id: string
  subscription_id: string | null
  profile_id: string | null
  amount: number
  currency: string
  stripe_invoice: string | null
  status: string
  pdf_url: string | null
  due_date: string | null
  paid_at: string | null
  created_at?: string | null
}

export const canAccessFeature = (sub: Subscription | null, tierMinimum: 'starter' | 'professional' | 'enterprise'): boolean => {
  if (!sub) return false
  if (sub.status !== 'active' && sub.status !== 'trialing') return false
  const order = { starter: 1, professional: 2, enterprise: 3 }
  return order[sub.tier as keyof typeof order] >= order[tierMinimum]
}

// --- Fetch current subscription ---
export async function fetchMySubscription(): Promise<Subscription | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase.from('subscriptions').select('*').eq('profile_id', user.id).maybeSingle()
  if (error || !data) return null
  return data as Subscription
}

// --- Fetch invoices ---
export async function fetchMyInvoices(): Promise<Invoice[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase.from('invoices').select('*').eq('profile_id', user.id).order('created_at', { ascending: false }).limit(50)
  if (error || !data) return []
  return data as Invoice[]
}

// --- Start trial / subscribe (Upsert into subscriptions table) ---
export async function subscribeToTier(tier: string, email: string): Promise<Subscription> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be signed in to subscribe')

  const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('subscriptions')
    .upsert({
      profile_id: user.id,
      agency_id: null,
      tier,
      status: 'trialing',
      trial_end: trialEnd,
      seats: 1,
    }, { onConflict: 'profile_id' })
    .select()
    .single()

  if (error) throw new Error(error.message || 'Failed to start subscription')
  return data as Subscription
}

export async function cancelSubscription(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { error } = await supabase.from('subscriptions').update({ status: 'canceled' }).eq('profile_id', user.id)
  if (error) throw new Error(error.message || 'Failed to cancel subscription')
}

export async function upgradeTier(tier: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be signed in')
  const { error } = await supabase.from('subscriptions').update({ tier, status: 'active' }).eq('profile_id', user.id)
  if (error) throw new Error(error.message || 'Failed to upgrade plan')
}

// --- Stripe Checkout (production wiring point) ---
/**
 * In production, this should call a server route that creates a Stripe Checkout
 * Session using your secret key, then redirects to session.url. The schema and
 * webhook handler (provider='stripe' in webhook_events) are ready for it.
 */
export async function createBillingSession(tier: string): Promise<string> {
  // Demo flow: record the subscription and return a fake checkout "success" path.
  // Replace with: POST /api/stripe/checkout { tier } -> { url }
  const { data: { user } } = await supabase.auth.getUser()
  const email = user?.email || ''
  await subscribeToTier(tier, email)
  return '/billing?checkout=success'
}
