'use client'

// ---------------------------------------------------------------------------
// AdminTrialsAnalytics — trial analytics dashboard (admin).
//   - Trial conversion rate (paid / total with a trial)
//   - Average trial length (days used before convert/expiry)
//   - Active / expired / grace / locked split
//   - Most-used features (aggregated from agency_usage across agencies)
//   - Popular upgrade paths (breakdown of subscription_history plan_type)
// Pure reads from agencies, agency_usage, subscription_history.
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

interface AgencyRow {
  id: string; name: string; created_at: string | null
  trial_start_date?: string | null; trial_end_date?: string | null
  trial_active?: boolean; paid_plan_active?: boolean
  plan_type?: string | null; locked_at?: string | null
}

interface SubRow { plan_type: string | null; status: string | null; amount: number | null }

export default function AdminTrialsAnalytics() {
  const [loadErr, setLoadErr] = useState('')
  const [metrics, setMetrics] = useState<any>(null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const { data: ags } = await supabase.from('agencies').select('*').limit(1000)
      const agencies = (ags as AgencyRow[]) || []
      const { data: subs } = await supabase.from('subscription_history').select('plan_type, status, amount').limit(1000)
      const history = (subs as SubRow[]) || []

      const withTrial = agencies.filter((a) => !!a.trial_start_date)
      const paid = agencies.filter((a) => a.paid_plan_active)
      const expired = agencies.filter((a) => !a.paid_plan_active && !!a.trial_start_date && !!a.trial_end_date && new Date(a.trial_end_date).getTime() < Date.now())
      const locked = agencies.filter((a) => !!a.locked_at && !a.paid_plan_active)

      const conversionRate = withTrial.length ? Math.round((paid.length / withTrial.length) * 100) : 0

      // average trial length: days between trial_start and either convert date (from sub) or trial_end
      let totalDays = 0, n = 0
      for (const a of withTrial) {
        const start = a.trial_start_date ? new Date(a.trial_start_date).getTime() : null
        if (!start) continue
        const endRef = a.paid_plan_active
          ? new Date(a.trial_end_date || a.created_at || Date.now()).getTime()
          : (a.trial_end_date ? new Date(a.trial_end_date).getTime() : Date.now())
        totalDays += Math.max(1, Math.round((endRef - start) / 86400000)); n++
      }
      const avgTrialLength = n ? Math.round((totalDays / n) * 10) / 10 : 0

      // usage aggregation
      const { data: usage } = await supabase.from('agency_usage').select('listings_used, leads_used, deals_used, storage_used').limit(1000)
      const usageRows = (usage as any[]) || []
      const agg = { listings: 0, leads: 0, deals: 0, storageMb: 0 }
      usageRows.forEach((u) => {
        agg.listings += u.listings_used || 0; agg.leads += u.leads_used || 0; agg.deals += u.deals_used || 0
        agg.storageMb += (u.storage_used || 0) / 1024 / 1024
      })

      // upgrade paths
      const paths: Record<string, number> = {}
      history.forEach((s) => { if (s.plan_type) paths[s.plan_type] = (paths[s.plan_type] || 0) + 1 })

      const statusSplit = {
        active: agencies.filter((a) => a.trial_active).length,
        trialEnded: expired.length,
        locked,
        paid: paid.length,
      }

      setMetrics({ agencies: agencies.length, withTrial: withTrial.length, paid: paid.length, conversionRate, avgTrialLength, agg, paths, statusSplit, lockedCount: locked.length })
    } catch (e: any) {
      setLoadErr(e.message || 'Failed to load analytics')
    }
  }

  if (loadErr) return <div style={{ color: '#b00020', fontFamily: 'Georgia, serif' }}>⚠️ {loadErr}</div>
  if (!metrics) return <div style={{ color: 'var(--muted)', fontFamily: 'Georgia, serif' }}>Loading analytics…</div>

  const cards: [string, string][] = [
    ['Agencies', String(metrics.agencies)],
    ['Started a trial', String(metrics.withTrial)],
    ['Converted to paid', String(metrics.paid)],
    ['Conversion rate', `${metrics.conversionRate}%`],
    ['Avg trial length', `${metrics.avgTrialLength} days`],
    ['Locked', String(metrics.lockedCount)],
  ]

  return (
    <div style={{ fontFamily: 'Georgia, serif', padding: '4px 0 40px' }}>
      <h1 style={{ fontSize: 22, marginBottom: 2 }}>Trial Analytics</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>Conversion, retention, and feature usage across all agencies.</p>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 22 }}>
        {cards.map(([label, val]) => (
          <div key={label} style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 14, padding: '16px 14px' }}>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{val}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {/* Feature usage */}
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 14, padding: 18 }}>
          <h2 style={{ fontSize: 15, marginTop: 0 }}>Most-used features (during trial)</h2>
          {[['🏢 Listings', metrics.agg.listings], ['🎯 Leads', metrics.agg.leads], ['🤝 Deals', metrics.agg.deals], ['💾 Storage', `${Math.round(metrics.agg.storageMb)}MB`]].map(([label, v]) => (
            <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--line)', fontSize: 14 }}>
              <span>{label}</span><span style={{ fontWeight: 700 }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Upgrade paths */}
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 14, padding: 18 }}>
          <h2 style={{ fontSize: 15, marginTop: 0 }}>Popular upgrade paths</h2>
          {Object.keys(metrics.paths).length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13 }}>No subscriptions recorded yet.</div>}
          {Object.entries(metrics.paths as Record<string, number>).sort((a, b) => b[1] - a[1]).map(([plan, count]) => (
            <div key={plan} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--line)', fontSize: 14, textTransform: 'capitalize' }}>
              <span>{plan}</span><span style={{ fontWeight: 700 }}>{count}</span>
            </div>
          ))}
        </div>

        {/* Status split */}
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 14, padding: 18 }}>
          <h2 style={{ fontSize: 15, marginTop: 0 }}>Agency status split</h2>
          {[['🟢 Active trial', metrics.statusSplit.active], ['🟡 Trial ended', metrics.statusSplit.trialEnded], ['🔴 Locked', metrics.statusSplit.lockedCount], ['✅ Paid', metrics.statusSplit.paid]].map(([label, v]) => (
            <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--line)', fontSize: 14 }}>
              <span>{label}</span><span style={{ fontWeight: 700 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
