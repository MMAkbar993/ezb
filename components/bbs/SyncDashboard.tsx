'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  BbsSyncWithListing, fetchSyncHistory, syncAllActiveToBbs, syncListingToBbs, unsyncListing,
} from '@/lib/bbs'
import { fetchListings, Listing } from '@/lib/listings'
import { fmt$ } from '@/lib/recast'
import { useToast } from '@/components/ui/Toast'
import { LoadingState, EmptyState, Card, CardHeader, Badge } from '@/components/ui'

export default function SyncDashboard() {
  const toast = useToast()
  const [listings, setListings] = useState<Listing[]>([])
  const [syncs, setSyncs] = useState<BbsSyncWithListing[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const load = useCallback(async () => {
    const [l, s] = await Promise.all([fetchListings().catch(() => []), fetchSyncHistory()])
    setListings(l); setSyncs(s); setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const statusColor = (s: string) =>
    s === 'synced' ? '#22c55e' : s === 'pending' ? '#f59e0b' : s === 'removed' ? '#94a3b8' : '#ef4444'

  const syncOne = async (listing: Listing) => {
    try {
      await syncListingToBbs(listing)
      toast(`${listing.business_name} synced to BizBuySell`, 'success')
      load()
    } catch (e: any) { toast(e.message, 'error') }
  }

  const syncAll = async () => {
    setSyncing(true)
    try {
      const n = await syncAllActiveToBbs()
      toast(`Synced ${n} listing(s) to BizBuySell`, 'success')
      load()
    } catch (e: any) { toast(e.message, 'error') } finally { setSyncing(false) }
  }

  if (loading) return <LoadingState label="Loading sync dashboard..." />

  const syncedCount = syncs.filter((s) => s.status === 'synced').length
  const pendingCount = syncs.filter((s) => s.status === 'pending').length
  const failedCount = syncs.filter((s) => s.status === 'failed').length

  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>BizBuySell Integration</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>
            Auto-sync listings, capture inbound leads, monitor sync health
          </p>
        </div>
        <button className="btn btn-primary" onClick={syncAll} disabled={syncing}>
          {syncing ? 'Syncing...' : '🔄 Sync All Active Listings'}
        </button>
      </header>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 20 }}>
        <StatCard label="Synced" value={syncedCount} color="#22c55e" />
        <StatCard label="Pending" value={pendingCount} color="#f59e0b" />
        <StatCard label="Failed" value={failedCount} color="#ef4444" />
        <StatCard label="Active Listings" value={listings.length} color="#1a1a2e" />
      </div>

      {/* Active listings to sync */}
      <Card>
        <CardHeader title="Active Listings" subtitle="Sync individual listings to BizBuySell" />
        <div style={{ padding: '12px 20px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {listings.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>No active listings. Create a listing to sync it.</div>
          ) : (
            listings.map((l) => {
              const existing = syncs.find((s) => s.listing_id === l.id && s.status === 'synced')
              return (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8 }}>
                  <span style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)' }}>{l.business_name}</span>
                    <span style={{ color: 'var(--muted)', fontSize: 13, marginLeft: 10 }}>{fmt$(l.asking_price)}</span>
                  </span>
                  {existing ? (
                    <Badge color="#22c55e">Synced</Badge>
                  ) : (
                    <button className="btn btn-navy" style={{ padding: '7px 14px', fontSize: 13 }} onClick={() => syncOne(l)}>Sync</button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </Card>

      {/* Sync history */}
      <Card style={{ marginTop: 20 }}>
        <CardHeader title="Sync History" subtitle="Recent BizBuySell sync activity" />
        <div style={{ padding: '12px 20px 20px' }}>
          {syncs.length === 0 ? (
            <EmptyState icon="🔄" title="No sync activity yet" subtitle="Sync a listing to see status here." />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--navy)', color: 'var(--navy)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>Listing</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                  <th style={{ padding: '10px 12px' }}>External ID</th>
                  <th style={{ padding: '10px 12px' }}>Last Sync</th>
                  <th style={{ padding: '10px 12px' }}></th>
                </tr>
              </thead>
              <tbody>
                {syncs.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{s.business_name || '—'}</td>
                    <td style={{ padding: '10px 12px' }}><Badge color={statusColor(s.status)}>{s.status}</Badge></td>
                    <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{s.external_id || '—'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{s.last_sync_at ? new Date(s.last_sync_at).toLocaleString() : '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {s.status === 'synced' && <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => unsyncListing(s.id).then(() => { toast('Removed from BizBuySell', 'info'); load() }).catch((e: any) => toast(e.message, 'error'))}>Unsync</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
    </Card>
  )
}
