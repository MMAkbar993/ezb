'use client'

// ---------------------------------------------------------------------------
// /dashboard/performance — Agent performance dashboards: listings, deals,
// commissions, time-to-close, conversion. Reads agent_performance + live data.
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import AppShell from '@/components/layout/AppShell'
import { Card, CardHeader, LoadingState } from '@/components/ui'
import { fmtMoney } from '@/lib/listings'
import { supabase } from '@/lib/supabase/client'

export default function PerformancePage() {
  return (
    <AppShell active="Performance">
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <Performance />
      </div>
    </AppShell>
  )
}

function Performance() {
  const [agents, setAgents] = useState<any[]>([])
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [deals, setDeals] = useState<any[]>([])

  useEffect(() => {
    (async () => {
      const [profiles, perf, dl] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, role'),
        supabase.from('agent_performance').select('*').order('created_at', { ascending: false }),
        supabase.from('deals').select('id, listing_id, status, purchase_price, created_at, updated_at'),
      ])
      setAgents((profiles.data || []) as any[])
      setRecords((perf.data || []) as any[])
      setDeals((dl.data || []) as any[])
      setLoading(false)
    })()
  }, [])

  if (loading) return <LoadingState label="Loading performance…" />

  // Aggregate live stats per agent (from listings + deals + commission-perf).
  const chartData = records.length
    ? records.slice(0, 10).map((r) => ({ name: r.agent_id?.slice(0, 8) || 'Agent', deals: r.total_deals, commission: r.total_commission }))
    : agents.slice(0, 8).map((a) => ({ name: (a.full_name || a.email || '').split(' ')[0] || 'Agent', deals: 0, commission: 0 }))

  return (
    <div>
      <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: 'var(--navy)', marginBottom: 6 }}>Agent Performance</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 20 }}>Track listings, deals, commissions, and close velocity per agent.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          ['Team listings', deals.length + agents.length, '#0b1f3a'],
          ['Deals', deals.length, '#3b82f6'],
          ['Commission (live)', records.reduce((s, r) => s + (Number(r.total_commission) || 0), 0), '#c9a84c'],
          ['Profiles', agents.length, '#8b5cf6'],
        ].map(([l, v, c]) => (
          <div key={l as string} style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--muted)' }}>{l}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: c as string, fontFamily: 'Georgia, serif' }}>{typeof v === 'number' ? (l as string).includes('$') || (l as string).toLowerCase().includes('commission') ? '$' + (v as number).toLocaleString() : (v as number) : v}</div>
          </div>
        ))}
      </div>

      <Card style={{ marginBottom: 20 }}>
        <CardHeader title="Commission by agent" subtitle="From agent_performance records" />
        <div style={{ padding: 16, height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="name" tick={{ fontFamily: 'Georgia, serif', fontSize: 12 }} />
              <YAxis tickFormatter={(v: number) => `$${v.toLocaleString()}`} width={72} tick={{ fontFamily: 'Georgia, serif', fontSize: 12 }} />
              <Tooltip formatter={(v: any) => fmtMoney(Number(v))} contentStyle={{ fontFamily: 'Georgia, serif', borderRadius: 8, border: '1px solid var(--line)' }} />
              <Bar dataKey="commission" fill="#c9a84c" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <CardHeader title="Agent detail" subtitle="Performance records" />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Georgia, serif', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--line)', textAlign: 'left' }}>
                {['Agent', 'Period', 'Listings', 'Deals', 'Commission', 'Avg close (days)', 'Conversion', 'Role'].map((h) => <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {records.length === 0 && <tr><td colSpan={8} style={{ padding: 24, color: 'var(--muted)', textAlign: 'center' }}>No agent performance records yet — run sql/workflow_schema.sql and populate agent_performance.</td></tr>}
              {records.map((r) => {
                const agent = agents.find((a) => a.id === r.agent_id)
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={td}><strong>{agent?.full_name || (r.agent_id || '').slice(0, 8)}</strong></td>
                    <td style={td}>{r.period || '—'}</td>
                    <td style={td}>{r.total_listings}</td>
                    <td style={td}>{r.total_deals}</td>
                    <td style={td}><strong style={{ color: 'var(--navy)' }}>{fmtMoney(r.total_commission)}</strong></td>
                    <td style={td}>{r.avg_time_to_close ?? '—'}</td>
                    <td style={td}>{r.conversion_rate != null ? r.conversion_rate + '%' : '—'}</td>
                    <td style={td}><span style={{ textTransform: 'capitalize' }}>{agent?.role || 'agent'}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

const th: React.CSSProperties = { padding: '12px 14px', fontWeight: 700, color: 'var(--navy)', fontSize: 12.5, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '14px', verticalAlign: 'middle' }
