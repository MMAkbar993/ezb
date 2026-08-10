'use client'

// ---------------------------------------------------------------------------
// AgencyBilling — agency-view billing & plan page.
//   - Current trial / plan status with TrialStatusBadge
//   - Usage counters vs trial limits (listings/leads/deals/storage/agents)
//   - Plan cards (Starter $9, Professional $49, Enterprise $149) with upgrade
//     → calls convert-trial API; then prompts Stripe payment (hook placeholder)
//   - Subscription history table
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { authedFetch } from '@/lib/apiFetch'
import { useToast } from '@/components/ui/Toast'
import { fetchUserAgencyContext, type Agency } from '@/lib/agencies'
import TrialStatusBadge from '@/components/agency/TrialStatusBadge'
import { statusFromAgency, getAgencyUsage, DEFAULT_LIMITS, type TrialState, type AgencyUsage } from '@/lib/trial'

const PLANS = [
  { id: 'starter', name: 'Starter', monthly: 9, features: ['Up to 5 active listings', '30 leads / month', 'Basic CIM & BOV'] },
  { id: 'professional', name: 'Professional', monthly: 49, features: ['Unlimited listings', 'Unlimited leads & deals', 'AI agents + full CIM/BOV', 'Social media publishing', 'Email campaigns'] },
  { id: 'enterprise', name: 'Enterprise', monthly: 149, features: ['Everything in Professional', 'Custom branding & white-label', 'Dedicated support + onboarding', 'Multi-agent seats'] },
] as const

interface SubRow { plan_type: string | null; start_date: string | null; end_date: string | null; amount: number | null; status: string | null; notes: string | null }

export default function AgencyBilling() {
  const toast = useToast()
  const [agency, setAgency] = useState<Agency | null>(null)
  const [state, setState] = useState<TrialState | null>(null)
  const [usage, setUsage] = useState<AgencyUsage | null>(null)
  const [history, setHistory] = useState<SubRow[]>([])
  const [paying, setPaying] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const ctx = await fetchUserAgencyContext()
        setAgency(ctx.agency)
        setState(statusFromAgency(ctx.agency))
        if (ctx.agency) {
          setUsage(await getAgencyUsage(ctx.agency.id))
          const { data } = await supabase.from('subscription_history').select('*').eq('agency_id', ctx.agency.id).order('created_at', { ascending: false }).limit(20)
          setHistory((data as SubRow[]) || [])
        }
      } catch { /* degrade */ }
    })()
  }, [])

  const rows = useMemo(() => {
    if (!usage) return []
    const max = DEFAULT_LIMITS
    return [
      { label: '🏢 Listings', used: usage.listingsUsed, max: max.maxListings },
      { label: '🎯 Leads', used: usage.leadsUsed, max: max.maxLeads },
      { label: '🤝 Deals', used: usage.dealsUsed, max: max.maxDeals },
      { label: '🤖 Agents', used: usage.agentsUsed, max: max.maxAgents },
      { label: '💾 Storage (MB)', used: Math.round(usage.storageUsedBytes / 1024 / 1024), max: Math.round(max.maxStorageBytes / 1024 / 1024) },
    ]
  }, [usage])

  async function upgrade(planId: 'starter' | 'professional' | 'enterprise') {
    if (!agency) return
    setPaying(planId)
    try {
      const res = await authedFetch('/api/billing/convert-trial', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agencyId: agency.id, planType: planId }) })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Upgrade failed')
      // Payment hook: in production this returns a Stripe Checkout URL to redirect to.
      toast(`Upgraded to ${planId} — payment collected separately`, 'success')
      setState(statusFromAgency({ ...agency, paid_plan_active: true, plan_type: planId } as Agency))
    } catch (e: any) {
      toast(e.message || 'Upgrade failed', 'error')
    } finally { setPaying(null) }
  }

  return (
    <div style={{ fontFamily: 'Georgia, serif', padding: '4px 0 40px', maxWidth: 880, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 2 }}>Billing & Plan</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>{agency?.name || 'Your agency'} account</p>
        </div>
        {state && <TrialStatusBadge state={state} />}
      </div>

      {/* Trial / usage summary */}
      {state && state.isTrial && (
        <div style={{ background: 'linear-gradient(120deg, var(--navy), #263059)', color: '#fff', borderRadius: 14, padding: 18, marginBottom: 22 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Free trial — {state.daysRemaining} day{state.daysRemaining === 1 ? '' : 's'} remaining</div>
          <div style={{ opacity: 0.75, fontSize: 13, margin: '4px 0 14px' }}>Upgrade to keep your listings, leads, and deals without limits.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
            {rows.map((r) => {
              const pct = r.max ? Math.min(100, Math.round((r.used / r.max) * 100)) : 0
              return (
                <div key={r.label} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 13 }}>{r.label}</div>
                  <div style={{ fontWeight: 800, fontSize: 16, margin: '4px 0' }}>{r.used}<span style={{ fontWeight: 400, fontSize: 12, opacity: 0.7 }}> / {r.max}</span></div>
                  <div style={{ height: 5, background: 'rgba(255,255,255,0.18)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: pct > 80 ? '#f87171' : 'var(--gold)', borderRadius: 99 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {state && (state.status === 'grace' || state.status === 'expired' || state.status === 'locked') && (
        <div style={{ background: '#fef7e0', border: '1px solid #f0e0a8', color: '#9a6a00', borderRadius: 12, padding: '14px 16px', fontSize: 14, marginBottom: 22 }}>
          {state.status === 'locked' ? '🔒 Account locked — contact support to restore access.' : '⚠️ Your trial has ended. Your data is preserved — upgrade to keep creating.'}
        </div>
      )}

      {/* Plan cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 26 }}>
        {PLANS.map((p) => (
          <div key={p.id} style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 10, position: 'relative' }}>
            {state?.planType === p.id && <div style={{ position: 'absolute', top: 12, right: 12, background: '#e6f4ea', color: '#1e7e34', fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 99 }}>Current</div>}
            <div>
              <div style={{ fontWeight: 800, fontSize: 17 }}>{p.name}</div>
              <div style={{ fontSize: 26, fontWeight: 800, margin: '4px 0 2px' }}>${p.monthly}<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--muted)' }}>/mo</span></div>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--ink)', display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
              {p.features.map((f) => <li key={f}>{f}</li>)}
            </ul>
            <button
              onClick={() => upgrade(p.id)}
              disabled={paying === p.id}
              style={{
                marginTop: 6, padding: '11px', borderRadius: 10, background: state?.planType === p.id ? 'transparent' : 'var(--gold)',
                color: state?.planType === p.id ? 'var(--muted)' : 'var(--navy)',
                border: state?.planType === p.id ? '1px solid var(--line)' : 'none', fontWeight: 800, fontSize: 14, cursor: paying === p.id ? 'wait' : state?.planType === p.id ? 'default' : 'pointer',
              }}
            >
              {paying === p.id ? 'Processing…' : state?.planType === p.id ? 'Current plan' : `Upgrade to ${p.name}`}
            </button>
          </div>
        ))}
      </div>

      {/* Subscription history */}
      <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 14, padding: 18 }}>
        <h2 style={{ fontSize: 15, marginTop: 0 }}>Subscription history</h2>
        {history.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13 }}>No billing activity yet.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {history.map((h, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--paper)', borderRadius: 10, fontSize: 13 }}>
              <div>
                <div style={{ fontWeight: 700, textTransform: 'capitalize' }}>{h.plan_type}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                  {h.start_date ? new Date(h.start_date).toLocaleDateString() : ''} → {h.end_date ? new Date(h.end_date).toLocaleDateString() : 'ongoing'}
                  {h.notes ? ` · ${h.notes}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {h.amount ? <span style={{ fontWeight: 800 }}>${Number(h.amount).toFixed(2)}</span> : null}
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'capitalize', color: h.status === 'active' ? '#1e7e34' : 'var(--muted)' }}>{h.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
