'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import {
  DashboardStats, FunnelPoint, ActivityItem,
  fetchDashboardStats, fetchPipelineFunnel, fetchRecentActivity, fetchUpcomingTasks,
} from '@/lib/dashboard'
import { Card, CardHeader, StatCard, LoadingState } from '@/components/ui'
import LiveFeed from '@/components/dashboard/LiveFeed'
import { useRealtimeListener } from '@/lib/realtime'

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [funnel, setFunnel] = useState<FunnelPoint[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [tasks, setTasks] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const [s, f, a, t] = await Promise.all([
          fetchDashboardStats(), fetchPipelineFunnel(), fetchRecentActivity(), fetchUpcomingTasks(),
        ])
        setStats(s); setFunnel(f); setActivity(a); setTasks(t)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // Realtime refresh — when deals/leads/listings change, re-pull stats.
  const refresh = () => {
    fetchDashboardStats().then(setStats).catch(() => {})
    fetchPipelineFunnel().then(setFunnel).catch(() => {})
  }
  useRealtimeListener('deals', refresh)
  useRealtimeListener('seller_leads', refresh)
  useRealtimeListener('buyer_leads', refresh)
  useRealtimeListener('listings', refresh)

  if (loading) return <LoadingState label="Loading dashboard..." />

  return (
    <div>
      <header style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>Dashboard</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>
            Concord Deal Platform overview — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <LiveFeed />
      </header>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard label="Total Listings" value={stats?.totalListings || 0} icon="🏢" />
        <StatCard label="Active Listings" value={stats?.activeListings || 0} icon="✅" accent="#22c55e" />
        <StatCard label="Total Deals" value={stats?.totalDeals || 0} icon="🤝" />
        <StatCard label="Pending Deals" value={stats?.pendingDeals || 0} icon="⏳" accent="#f59e0b" />
        <StatCard label="Total Leads" value={stats?.totalLeads || 0} icon="🎯" accent="#8b5cf6" />
        <StatCard label="New Leads" value={stats?.newLeads || 0} icon="✨" accent="#3b82f6" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Pipeline funnel */}
          <Card>
            <CardHeader title="Deal Pipeline Funnel" subtitle="Deals at each stage" />
            <div style={{ padding: 20, height: 320 }}>
              {funnel.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>No deals yet — move deals through the pipeline to see the funnel.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnel} layout="vertical" margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="stage" width={130} tick={{ fontFamily: 'Georgia, serif', fontSize: 13 }} />
                    <Tooltip
                      contentStyle={{ fontFamily: 'Georgia, serif', borderRadius: 8, border: '1px solid var(--line)' }}
                    />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                      {funnel.map((_, i) => (
                        <Cell key={i} fill={['#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#22c55e'][i]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* Upcoming tasks */}
          <Card>
            <CardHeader title="Upcoming Tasks & Deadlines" subtitle="Next due diligence due dates" />
            <div style={{ padding: '12px 20px' }}>
              {tasks.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                  No upcoming tasks. Add due diligence items to track deadlines.
                </div>
              ) : (
                tasks.map((t) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                    <span style={{ padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700, background: 'rgba(201,168,76,0.15)', color: 'var(--gold-dark)' }}>
                      {t.createdAt ? new Date(t.createdAt + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date'}
                    </span>
                    <span style={{ flex: 1, fontSize: 14, color: 'var(--text)' }}>{t.title}</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'capitalize' }}>{t.detail}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Right column: activity + quick actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Card>
            <CardHeader title="Quick Actions" />
            <div style={{ padding: '12px 20px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { href: '/listings', label: '+ New Listing', icon: '🏢' },
                { href: '/pipeline', label: '+ New Deal', icon: '🤝' },
                { href: '/leads', label: '+ Add Lead', icon: '🎯' },
                { href: '/cim', label: 'Generate CIM', icon: '📑' },
                { href: '/bov', label: 'Generate BOV', icon: '⚖️' },
                { href: '/documents', label: 'Upload Document', icon: '📁' },
              ].map((a) => (
                <Link key={a.href} href={a.href} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                  borderRadius: 8, border: '1px solid var(--line)', background: 'var(--cream)',
                  textDecoration: 'none', color: 'var(--navy)', fontSize: 14, fontWeight: 600,
                  transition: 'all 0.15s',
                }}>
                  <span style={{ fontSize: 18 }}>{a.icon}</span> {a.label}
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Recent Activity" />
            <div style={{ padding: '12px 20px 20px' }}>
              {activity.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                  No activity yet.
                </div>
              ) : (
                activity.map((a) => (
                  <div key={a.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                    <span style={{ fontSize: 16 }}>{a.kind === 'deal' ? '🤝' : a.kind === 'lead' ? '🎯' : '📝'}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {a.detail} · {a.createdAt ? timeAgo(a.createdAt) : ''}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(iso).toLocaleDateString()
}
