'use client'

// ---------------------------------------------------------------------------
// AdminTrialSettings — global + per-agency trial configuration (admin only).
//   - Default trial period (7/14/30/60 days)
//   - Max listings / leads / deals / agents / storage during trial
//   - Send reminder emails toggle
//   - Grace period + archive window
//   - Per-agency overrides + manual extension + batch extend for promotions
// Reads/writes the trial_settings table (agency_id = null for global default;
// per-agency rows override).
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

interface TrialSettingsRow {
  id: string
  agency_id: string | null
  trial_days: number
  max_listings: number
  max_leads: number
  max_deals: number
  max_agents: number
  max_storage_mb: number
  send_reminders: boolean
  grace_days: number
  archive_days: number
}

interface AgencyRow { id: string; name: string; trial_end_date: string | null; trial_active: boolean }

export default function AdminTrialSettings() {
  const toast = useToast()
  const [row, setRow] = useState<TrialSettingsRow | null>(null)
  const [agencies, setAgencies] = useState<AgencyRow[]>([])
  const [extendDays, setExtendDays] = useState(14)
  const [loading, setLoading] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('trial_settings').select('*').eq('agency_id', null).limit(1).maybeSingle()
    setRow((data as TrialSettingsRow) || null)
    const { data: ags } = await supabase.from('agencies').select('id, name, trial_end_date, trial_active').order('created_at', { ascending: false }).limit(200)
    setAgencies((ags as AgencyRow[]) || [])
  }

  async function saveGlobal() {
    if (!row) return
    setLoading(true)
    try {
      const patch = {
        trial_days: row.trial_days, max_listings: row.max_listings, max_leads: row.max_leads,
        max_deals: row.max_deals, max_agents: row.max_agents, max_storage_mb: row.max_storage_mb,
        send_reminders: row.send_reminders, grace_days: row.grace_days, archive_days: row.archive_days,
      }
      if (row.id) await supabase.from('trial_settings').update(patch).eq('id', row.id)
      else await supabase.from('trial_settings').insert({ ...patch, agency_id: null })
      toast('Trial settings saved', 'success')
    } finally { setLoading(false) }
  }

  async function extendAgency(id: string) {
    const { data } = await supabase.from('agencies').select('trial_end_date').eq('id', id).maybeSingle()
    const base = data?.trial_end_date ? new Date(data.trial_end_date).getTime() : Date.now()
    const newEnd = new Date(base + extendDays * 86400000).toISOString()
    await supabase.from('agencies').update({ trial_end_date: newEnd, trial_active: true }).eq('id', id)
    toast('Trial extended', 'success'); load()
  }

  const num = (k: keyof TrialSettingsRow): React.CSSProperties => ({
    width: '100%', padding: '9px 10px', borderRadius: 9, border: '1px solid var(--line)', fontSize: 14,
  })

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '4px 0 40px', fontFamily: 'Georgia, serif' }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Trial Settings</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>Global defaults + per-agency overrides for free trial configuration.</p>

      {/* Global defaults */}
      <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 14, padding: 20, marginBottom: 18 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Global default plan</h2>
        {row && (
          <div className="grid-3" style={{ gap: 14 }}>
            <div><label style={lbl}>Trial period (days)</label>
              <select style={num('trial_days')} value={row.trial_days} onChange={(e) => setRow({ ...row, trial_days: Number(e.target.value) })}>
                {[7, 14, 30, 60].map((d) => <option key={d} value={d}>{d} days</option>)}
              </select></div>
            <div><label style={lbl}>Max listings</label><input type="number" style={num('max_listings')} value={row.max_listings} onChange={(e) => setRow({ ...row, max_listings: Number(e.target.value) })} /></div>
            <div><label style={lbl}>Max leads</label><input type="number" style={num('max_leads')} value={row.max_leads} onChange={(e) => setRow({ ...row, max_leads: Number(e.target.value) })} /></div>
            <div><label style={lbl}>Max deals</label><input type="number" style={num('max_deals')} value={row.max_deals} onChange={(e) => setRow({ ...row, max_deals: Number(e.target.value) })} /></div>
            <div><label style={lbl}>Max agents</label><input type="number" style={num('max_agents')} value={row.max_agents} onChange={(e) => setRow({ ...row, max_agents: Number(e.target.value) })} /></div>
            <div><label style={lbl}>Max storage (MB)</label><input type="number" style={num('max_storage_mb')} value={row.max_storage_mb} onChange={(e) => setRow({ ...row, max_storage_mb: Number(e.target.value) })} /></div>
            <div><label style={lbl}>Grace period (days)</label><input type="number" style={num('grace_days')} value={row.grace_days} onChange={(e) => setRow({ ...row, grace_days: Number(e.target.value) })} /></div>
            <div><label style={lbl}>Archive after (days)</label><input type="number" style={num('archive_days')} value={row.archive_days} onChange={(e) => setRow({ ...row, archive_days: Number(e.target.value) })} /></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 22 }}>
              <input type="checkbox" checked={row.send_reminders} onChange={(e) => setRow({ ...row, send_reminders: e.target.checked })} />
              <span style={{ fontSize: 13 }}>Send reminder emails</span>
            </div>
          </div>
        )}
        <button onClick={saveGlobal} disabled={loading || !row} style={{ marginTop: 16, padding: '11px 20px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: loading ? 'wait' : 'pointer' }}>
          {loading ? 'Saving…' : 'Save global settings'}
        </button>
      </div>

      {/* Per-agency override / extension */}
      <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 14, padding: 20 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Agency trials & extensions</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <label style={lbl}>Extend by (days):</label>
          <input type="number" value={extendDays} onChange={(e) => setExtendDays(Math.max(1, Number(e.target.value)))} style={{ width: 80, padding: '7px 8px', borderRadius: 8, border: '1px solid var(--line)' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {agencies.map((a) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'var(--paper)', borderRadius: 10, padding: '10px 14px' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{a.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {a.trial_active ? `Trial ends ${a.trial_end_date ? new Date(a.trial_end_date).toLocaleDateString() : '—'}` : a.trial_end_date ? `Trial ended ${new Date(a.trial_end_date).toLocaleDateString()}` : 'Not on trial'}
                </div>
              </div>
              <button onClick={() => extendAgency(a.id)} style={{ padding: '8px 14px', background: 'var(--gold)', color: 'var(--navy)', border: 'none', borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                Extend +{extendDays}d
              </button>
            </div>
          ))}
        </div>
        {/* Batch extend all active trials */}
        <button
          onClick={async () => {
            const ids = agencies.filter((a) => a.trial_active).map((a) => a.id)
            for (const id of ids) await extendAgency(id)
            toast(`Batch extended ${ids.length} active trials`, 'success')
          }}
          style={{ marginTop: 14, padding: '10px 16px', background: 'transparent', color: 'var(--navy)', border: '1px solid var(--navy)', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
        >
          Batch extend all active trials
        </button>
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: 'var(--ink)' }
