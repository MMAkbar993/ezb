'use client'

// ---------------------------------------------------------------------------
// AdminTrials — super-admin view of every agency's trial status.
//   - Filter by status (all / active / ending-all-time / expired / paid)
//   - Per-agency: status badge, trial dates, usage counters, extend + convert
//   - Read-only for non-admins (should be mounted under an admin gate)
// Reads agencies + agency_usage via Supabase; uses convert-trial + create-agency
// APIs for the extend/convert actions.
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { authedFetch } from '@/lib/apiFetch'
import { useToast } from '@/components/ui/Toast'
import TrialStatusBadge from '@/components/agency/TrialStatusBadge'
import { statusFromAgency, DEFAULT_LIMITS, type TrialState, type AgencyUsage } from '@/lib/trial'
import type { Agency } from '@/lib/agencies'

type Filter = 'all' | 'active' | 'ending' | 'expired' | 'paid'

interface Row extends Agency {
  trial_start_date?: string | null
  trial_end_date?: string | null
  grace_end_date?: string | null
  locked_at?: string | null
  plan_type?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any
}

export default function AdminTrials() {
  const toast = useToast()
  const [rows, setRows] = useState<Row[]>([])
  const [usage, setUsage] = useState<Record<string, AgencyUsage>>({})
  const [filter, setFilter] = useState<Filter>('all')
  const [extendDays, setExtendDays] = useState(14)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data } = await supabase.from('agencies').select('*').order('created_at', { ascending: false }).limit(500)
      const ags = (data as Row[]) || []
      setRows(ags)
      // usage per agency from latest agency_usage row
      const map: Record<string, AgencyUsage> = {}
      await Promise.all(ags.map(async (a) => {
        const { data: u } = await supabase.from('agency_usage').select('*').eq('agency_id', a.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
        if (u) map[a.id] = { listingsUsed: u.listings_used || 0, leadsUsed: u.leads_used || 0, dealsUsed: u.deals_used || 0, storageUsedBytes: u.storage_used || 0, agentsUsed: 0 }
      }))
      setUsage(map)
    } finally { setLoading(false) }
  }

  async function extend(a: Row) {
    const base = a.trial_end_date ? new Date(a.trial_end_date).getTime() : Date.now()
    const newEnd = new Date(base + extendDays * 86400000).toISOString()
    await supabase.from('agencies').update({ trial_end_date: newEnd, trial_active: true }).eq('id', a.id)
    toast('Extended', 'success'); load()
  }

  async function convert(a: Row, plan: 'starter' | 'professional' | 'enterprise') {
    const res = await authedFetch('/api/billing/convert-trial', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agencyId: a.id, planType: plan }) })
    const json = await res.json()
    toast(json.ok ? `Converted to ${plan}` : json.error || 'Convert failed', json.ok ? 'success' : 'error')
    if (json.ok) load()
  }

  const filtered = rows.filter((a) => {
    const s = statusFromAgency(a as Agency)
    switch (filter) {
      case 'active': return s.status === 'active' || s.status === 'ending_soon'
      case 'ending': return s.status === 'ending_soon'
      case 'expired': return s.status === 'expired' || s.status === 'grace' || s.status === 'locked'
      case 'paid': return s.status === 'paid'
      default: return true
    }
  })

  return (
    <div style={{ fontFamily: 'Georgia, serif', padding: '4px 0 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 2 }}>Agency Trials</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>All agencies, trial status, usage, extend & convert.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 13 }}>Extend +</label>
          <input type="number" value={extendDays} onChange={(e) => setExtendDays(Math.max(1, Number(e.target.value)))} style={{ width: 70, padding: '7px 8px', borderRadius: 8, border: '1px solid var(--line)' }} />
          <label style={{ fontSize: 13 }}>d</label>
        </div>
      </div>

      {/* filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['all', 'active', 'ending', 'expired', 'paid'] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '8px 14px', borderRadius: 99, cursor: 'pointer', fontSize: 13, fontWeight: 700, textTransform: 'capitalize',
            background: filter === f ? 'var(--navy)' : '#fff', color: filter === f ? '#fff' : 'var(--ink)', border: '1px solid var(--line)',
          }}>
            {f}
            <span style={{ opacity: 0.6, marginLeft: 4, fontSize: 11 }}>{filter === f ? filtered.length : count(rows, f)}</span>
          </button>
        ))}
      </div>

      {loading ? <div style={{ color: 'var(--muted)' }}>Loading…</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.length === 0 && <div style={{ color: 'var(--muted)', padding: 20 }}>No agencies in this view.</div>}
          {filtered.map((a) => {
            const s: TrialState = statusFromAgency(a as Agency)
            const u = usage[a.id] || { listingsUsed: 0, leadsUsed: 0, dealsUsed: 0, storageUsedBytes: 0, agentsUsed: 0 }
            return (
              <div key={a.id} style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{a.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      {s.trialStart ? `Started ${new Date(s.trialStart).toLocaleDateString()}` : 'No trial start'} · {s.trialEnd ? `Ends ${new Date(s.trialEnd).toLocaleDateString()}` : '—'}
                    </div>
                  </div>
                  <TrialStatusBadge state={s} />
                </div>
                {/* usage counters */}
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--muted)' }}>
                  <span>🏢 {u.listingsUsed}/{DEFAULT_LIMITS.maxListings} listings</span>
                  <span>🎯 {u.leadsUsed}/{DEFAULT_LIMITS.maxLeads} leads</span>
                  <span>🤝 {u.dealsUsed}/{DEFAULT_LIMITS.maxDeals} deals</span>
                  <span>💾 {Math.round(u.storageUsedBytes / 1024 / 1024)}MB/{DEFAULT_LIMITS.maxStorageBytes / 1024 / 1024}MB</span>
                </div>
                {/* actions */}
                {s.status !== 'paid' && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => extend(a)} style={{ padding: '8px 14px', background: 'var(--gold)', color: 'var(--navy)', border: 'none', borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>Extend +{extendDays}d</button>
                    {(['starter', 'professional', 'enterprise'] as const).map((p) => (
                      <button key={p} onClick={() => convert(a, p)} style={{ padding: '8px 14px', background: 'transparent', color: 'var(--navy)', border: '1px solid var(--navy)', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer', textTransform: 'capitalize' }}>Convert → {p}</button>
                    ))}
                  </div>
                )}
                {s.status === 'paid' && <div style={{ fontSize: 12, color: '#1e7e34', fontWeight: 700 }}>✓ Active paying customer</div>}
              </div>
            )
          })}
        </div>
      )}

      {/* batch extend */}
      <button
        onClick={async () => {
          const active = rows.filter((a) => (statusFromAgency(a as Agency).status === 'active' || statusFromAgency(a as Agency).status === 'ending_soon'))
          for (const a of active) await extend(a)
          toast(`Batch extended ${active.length} active trials`, 'success')
        }}
        style={{ marginTop: 18, padding: '11px 18px', background: 'transparent', color: 'var(--navy)', border: '1px solid var(--navy)', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
      >
        Batch extend all active trials
      </button>
    </div>
  )
}

function count(rows: Row[], f: Filter): number {
  return rows.filter((a) => {
    const s = statusFromAgency(a as Agency)
    switch (f) {
      case 'active': return s.status === 'active' || s.status === 'ending_soon'
      case 'ending': return s.status === 'ending_soon'
      case 'expired': return s.status === 'expired' || s.status === 'grace' || s.status === 'locked'
      case 'paid': return s.status === 'paid'
      default: return true
    }
  }).length
}
