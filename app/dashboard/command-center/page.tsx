'use client'

// ---------------------------------------------------------------------------
// /dashboard/command-center — All listings with live status, SBA eligibility,
// workflow progress, and quick actions (open workflow / edit / withdraw).
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import { Card, CardHeader, LoadingState } from '@/components/ui'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { fetchListings, fmtMoneyCompact } from '@/lib/listings'
import { getWorkflow, setListingStatus, fetchSBA } from '@/lib/workflow'
import StatusBadge from '@/components/listings/StatusBadge'
import SBABadge from '@/components/listings/SBABadge'

export default function CommandCenterPage() {
  return (
    <AppShell active="Command Center">
      <ToastProvider>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <CommandCenter />
        </div>
      </ToastProvider>
    </AppShell>
  )
}

function CommandCenter() {
  const router = useRouter()
  const toast = useToast()
  const [listings, setListings] = useState<any[]>([])
  const [enriched, setEnriched] = useState<Record<string, { workflow?: any; sba?: any }>>({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const load = useCallback(async () => {
    const rows = await fetchListings()
    setListings(rows)
    // Enrich workflow + SBA per listing (best-effort, parallel).
    const map: Record<string, any> = {}
    await Promise.all(rows.map(async (l) => {
      const [w, s] = await Promise.all([getWorkflow(l.id).catch(() => null), fetchSBA(l.id).catch(() => null)])
      map[l.id] = { workflow: w, sba: s }
    }))
    setEnriched(map)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingState label="Loading command center…" />

  const statuses = ['all', 'draft', 'active', 'pending_sale', 'under_contract', 'sold', 'withdrawn']
  const shown = filter === 'all' ? listings : listings.filter((l) => l.status === filter)

  const stats = {
    total: listings.length,
    active: listings.filter((l) => l.status === 'active').length,
    pending: listings.filter((l) => ['pending_sale', 'under_contract'].includes(l.status)).length,
    sold: listings.filter((l) => l.status === 'sold').length,
  }

  const doWithdraw = async (id: string) => {
    if (!confirm('Withdraw this listing?')) return
    const ok = await setListingStatus(id, 'withdrawn')
    toast(ok ? 'Listing withdrawn' : 'Withdraw failed', ok ? 'success' : 'error')
    load()
  }

  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: 'var(--navy)', margin: 0 }}>Command Center</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>Manage all listings and their status across the sales lifecycle.</p>
        </div>
        <Link href="/dashboard/listings/new" style={{ textDecoration: 'none', padding: '11px 18px', background: 'var(--navy)', color: '#fff', borderRadius: 8, fontWeight: 600, whiteSpace: 'nowrap' }}>
          + New listing
        </Link>
      </header>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
        {[['Total', stats.total, '#0b1f3a'], ['Active', stats.active, '#16a34a'], ['Pending / Contract', stats.pending, '#b45309'], ['Sold', stats.sold, '#0e7490']].map(([l, v, c]) => (
          <div key={l as string} style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--muted)' }}>{l}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: c as string, fontFamily: 'Georgia, serif' }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {statuses.map((s) => (
          <button key={s} onClick={() => setFilter(s)} style={{ padding: '8px 15px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', border: `1.5px solid ${filter === s ? 'var(--navy)' : 'var(--line)'}`, background: filter === s ? 'var(--navy)' : '#fff', color: filter === s ? '#fff' : 'var(--ink)' }}>
            {s === 'all' ? `All (${stats.total})` : `${s.replace(/_/g, ' ')}`}
          </button>
        ))}
      </div>

      {/* Listings table */}
      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Georgia, serif', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--line)', textAlign: 'left' }}>
                {['Business', 'Industry', 'Asking', 'Workflow', 'SBA', 'Status', 'Actions'].map((h) => <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && <tr><td colSpan={7} style={{ padding: 24, color: 'var(--muted)', textAlign: 'center' }}>No listings in this view.</td></tr>}
              {shown.map((l) => {
                const w = enriched[l.id]?.workflow
                const sba = enriched[l.id]?.sba
                const pct = w ? Math.round(((w.completed_steps || []).length / 10) * 100) : 0
                return (
                  <tr key={l.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={td}>
                      <Link href={`/dashboard/listings/${l.id}/workflow`} style={{ fontWeight: 700, color: 'var(--navy)', textDecoration: 'none' }}>{l.business_name}</Link>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{l.location_general || ''}</div>
                    </td>
                    <td style={td}>{l.industry || '—'}</td>
                    <td style={td}><strong>{l.asking_price ? fmtMoneyCompact(l.asking_price) : '—'}</strong></td>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 70, height: 5, background: 'var(--paper)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--gold)' }} />
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{pct}%</span>
                      </div>
                    </td>
                    <td style={td}><SBABadge eligible={sba?.is_sba_eligible} reviewed={!!sba?.reviewed_at} /></td>
                    <td style={td}><StatusBadge status={l.status} /></td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Link href={`/dashboard/listings/${l.id}/workflow`} style={miniBtn}>Workflow</Link>
                        <Link href={`/dashboard/listings/${l.id}/edit`} style={miniBtn}>Edit</Link>
                        {l.status !== 'withdrawn' && l.status !== 'sold' && (
                          <button onClick={() => doWithdraw(l.id)} style={{ ...miniBtn, color: '#dc2626', borderColor: '#fecaca' }}>Withdraw</button>
                        )}
                      </div>
                    </td>
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
const miniBtn: React.CSSProperties = { display: 'inline-block', padding: '6px 11px', fontSize: 12, fontWeight: 600, color: 'var(--navy)', border: '1px solid var(--line)', borderRadius: 6, textDecoration: 'none', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }
