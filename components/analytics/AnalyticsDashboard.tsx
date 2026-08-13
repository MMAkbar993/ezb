'use client'

// ---------------------------------------------------------------------------
// AnalyticsDashboard — advanced analytics: pipeline value, lead funnel,
// broker performance, revenue/commission, MoM/YoY comparison, CSV export.
// Uses Recharts for visualizations (already a dependency).
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid, Legend, PieChart, Pie,
} from 'recharts'
import {
  fetchPipelineValueSeries, fetchLeadFunnel, fetchBrokerPerformance,
  fetchRevenueSeries, fetchComparison, fetchAnalyticsOverview,
  toCSV, downloadCSV, emptyOverview,
  type PipelineValuePoint, type FunnelPoint, type BrokerPerformance,
  type RevenueSeries, type PeriodComparison, type AnalyticsOverview,
} from '@/lib/analytics'
import { Card, CardHeader, StatCard, LoadingState } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { exportAnalyticsPdf } from '@/lib/analyticsPdf'

const COLORS = ['#0b1f3a', '#c9a84c', '#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b']

const money = (n: number): string => {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

export default function AnalyticsDashboard() {
  const toast = useToast()
  const [overview, setOverview] = useState<AnalyticsOverview>(emptyOverview())
  const [pipelineValue, setPipelineValue] = useState<PipelineValuePoint[]>([])
  const [funnel, setFunnel] = useState<FunnelPoint[]>([])
  const [brokers, setBrokers] = useState<BrokerPerformance[]>([])
  const [revenue, setRevenue] = useState<RevenueSeries[]>([])
  const [comparison, setComparison] = useState<PeriodComparison>({ currentValue: 0, previousValue: 0, changePct: 0 })
  const [compareMode, setCompareMode] = useState<'mom' | 'yoy'>('mom')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const [o, p, f, b, r, c] = await Promise.all([
        fetchAnalyticsOverview(), fetchPipelineValueSeries(), fetchLeadFunnel(),
        fetchBrokerPerformance(), fetchRevenueSeries(), fetchComparison('mom'),
      ])
      setOverview(o); setPipelineValue(p); setFunnel(f); setBrokers(b); setRevenue(r); setComparison(c)
      setLoading(false)
    })()
  }, [])

  const switchComparison = async (mode: 'mom' | 'yoy') => {
    setCompareMode(mode)
    const c = await fetchComparison(mode)
    setComparison(c)
  }

  const exportPipelineCSV = () => {
    downloadCSV('pipeline-value.csv', toCSV(['Month', 'Pipeline value', 'Deals'], pipelineValue.map((p) => [p.month, p.value, p.count])))
    toast('Pipeline value CSV downloaded', 'success')
  }
  const exportRevenueCSV = () => {
    downloadCSV('revenue.csv', toCSV(['Month', 'Revenue', 'Commissions'], revenue.map((r) => [r.month, r.revenue, r.commissions])))
    toast('Revenue CSV downloaded', 'success')
  }
  const exportBrokerCSV = () => {
    downloadCSV('broker-performance.csv', toCSV(['Broker', 'Deals', 'Revenue', 'Commissions'], brokers.map((b) => [b.name, b.deals, b.revenue, b.commissions])))
    toast('Broker performance CSV downloaded', 'success')
  }
  const exportLeadFunnelCSV = () => {
    downloadCSV('lead-funnel.csv', toCSV(['Stage', 'Count', '%'], funnel.map((f) => [f.stage, f.count, `${f.pct}%`])))
    toast('Lead funnel CSV downloaded', 'success')
  }
  const exportPDF = () => {
    try {
      exportAnalyticsPdf({
        overview, pipelineValue, funnel, brokers, revenue, comparison, compareMode,
        generatedAt: new Date(),
      })
      toast('Analytics report PDF downloaded', 'success')
    } catch {
      toast('PDF export failed', 'error')
    }
  }

  if (loading) return <LoadingState label="Crunching analytics…" />

  const comparisonTone = comparison.changePct >= 0 ? '#16a34a' : '#dc2626'

  return (
    <div>
      <header style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 26, color: 'var(--navy)', margin: 0 }}>Analytics</h1>
          <p style={{ color: 'var(--muted)', margin: '4px 0 0', fontSize: 14 }}>Deal pipeline value, lead conversion, broker performance &amp; revenue.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => switchComparison('mom')} style={segBtn(compareMode === 'mom')}>MoM</button>
          <button onClick={() => switchComparison('yoy')} style={segBtn(compareMode === 'yoy')}>YoY</button>
        </div>
      </header>

      {/* Overview stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 20 }}>
        <StatCard label="Pipeline Value" value={money(overview.totalPipelineValue)} icon="💰" />
        <StatCard label="Avg Deal Size" value={money(overview.avgDealSize)} icon="📈" />
        <StatCard label="Active Deals" value={overview.activeCount} icon="🔄" accent="#3b82f6" />
        <StatCard label="Closed Deals" value={overview.closedCount} icon="✅" accent="#22c55e" />
        <StatCard label="Total Leads" value={overview.leadTotal} icon="🎯" accent="#8b5cf6" />
        <StatCard label="Converted" value={overview.leadConverted} icon="🏆" accent="#c9a84c" />
      </div>

      {/* Period comparison banner */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--navy)' }}>
            {compareMode === 'mom' ? 'Month-over-Month' : 'Year-over-Year'}
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>This period</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>{money(comparison.currentValue)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Previous</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>{money(comparison.previousValue)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Change</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: comparisonTone }}>
              {comparison.changePct >= 0 ? '▲' : '▼'} {Math.abs(comparison.changePct)}%
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ExportBtn onClick={exportPipelineCSV} label="Pipeline" />
            <ExportBtn onClick={exportRevenueCSV} label="Revenue" />
            <ExportBtn onClick={exportBrokerCSV} label="Brokers" />
            <ExportBtn onClick={exportLeadFunnelCSV} label="Funnel" />
            <ExportBtn onClick={exportPDF} label="PDF" gold />
          </div>
          <span style={{ fontSize: 12, color: 'var(--muted-2)' }}>CSV + PDF export</span>
        </div>
      </Card>

      <div className="grid-2" style={{ gap: 20, alignItems: 'stretch' }}>
        {/* Pipeline value over time */}
        <Card>
          <CardHeader title="Deal Pipeline Value" subtitle="Active deal value by month" />
          <div style={{ padding: 16, height: 280 }}>
            {pipelineValue.length === 0 ? (
              <EmptyBox label="No deal pipeline data yet" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineValue} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="month" tick={{ fontFamily: 'Georgia, serif', fontSize: 12 }} />
                  <YAxis tickFormatter={(v: number) => money(v)} width={64} tick={{ fontFamily: 'Georgia, serif', fontSize: 12 }} />
                  <Tooltip formatter={(v: any) => money(Number(v))} contentStyle={{ fontFamily: 'Georgia, serif', borderRadius: 8, border: '1px solid var(--line)' }} />
                  <Bar dataKey="value" fill="#c9a84c" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Lead conversion funnel */}
        <Card>
          <CardHeader title="Lead Conversion Funnel" subtitle="Buyer + seller lead progression" />
          <div style={{ padding: 16, display: 'flex', gap: 16, alignItems: 'center', height: 280 }}>
            <div style={{ flex: 1 }}>
              {funnel.length === 0 ? (
                <EmptyBox label="No lead data yet" />
              ) : (
                funnel.map((f) => (
                  <div key={f.stage} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--muted)', marginBottom: 5 }}>
                      <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{f.stage}</span>
                      <span>{f.count} · {f.pct}%</span>
                    </div>
                    <div style={{ height: 16, background: 'var(--paper)', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${f.pct}%`, background: 'linear-gradient(90deg, var(--navy), #c9a84c)', borderRadius: 8 }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>

        {/* Revenue & commissions over time */}
        <Card>
          <CardHeader title="Revenue & Commissions" subtitle="Monthly totals" />
          <div style={{ padding: 16, height: 280 }}>
            {revenue.length === 0 ? (
              <EmptyBox label="No revenue data yet — run analytics_schema.sql" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenue} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="month" tick={{ fontFamily: 'Georgia, serif', fontSize: 12 }} />
                  <YAxis tickFormatter={(v: number) => money(v)} width={64} tick={{ fontFamily: 'Georgia, serif', fontSize: 12 }} />
                  <Tooltip formatter={(v: any) => money(Number(v))} contentStyle={{ fontFamily: 'Georgia, serif', borderRadius: 8, border: '1px solid var(--line)' }} />
                  <Legend wrapperStyle={{ fontFamily: 'Georgia, serif', fontSize: 12 }} />
                  <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#0b1f3a" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="commissions" name="Commissions" stroke="#c9a84c" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Broker performance */}
        <Card>
          <CardHeader title="Broker Performance" subtitle="Commissions by broker" />
          <div style={{ padding: 16, height: 280 }}>
            {brokers.length === 0 ? (
              <EmptyBox label="No commission data — run analytics_schema.sql" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={brokers} dataKey="commissions" nameKey="name" innerRadius={50} outerRadius={95} paddingAngle={2}>
                    {brokers.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => money(Number(v))} contentStyle={{ fontFamily: 'Georgia, serif', borderRadius: 8, border: '1px solid var(--line)' }} />
                  <Legend wrapperStyle={{ fontFamily: 'Georgia, serif', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Broker detail table */}
      <Card style={{ marginTop: 20 }}>
        <CardHeader title="Broker Detail" subtitle="Deals, revenue, commissions" />
        <div style={{ padding: 8, overflowX: 'auto' }}>
          {brokers.length === 0 ? (
            <div style={{ padding: 16, color: 'var(--muted)', fontSize: 13 }}>No commission records yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Georgia, serif', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--line)', textAlign: 'left' }}>
                  <th style={thStyle}>Broker</th>
                  <th style={thStyle}>Deals</th>
                  <th style={thStyle}>Revenue</th>
                  <th style={thStyle}>Commissions</th>
                </tr>
              </thead>
              <tbody>
                {brokers.map((b) => (
                  <tr key={b.name} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={tdStyle}><strong>{b.name}</strong></td>
                    <td style={tdStyle}>{b.deals}</td>
                    <td style={tdStyle}>{money(b.revenue)}</td>
                    <td style={tdStyle}><strong style={{ color: 'var(--navy)' }}>{money(b.commissions)}</strong></td>
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

const thStyle: React.CSSProperties = { padding: '10px 12px', fontWeight: 700, color: 'var(--navy)', fontSize: 12.5, textTransform: 'uppercase', letterSpacing: 0.5 }
const tdStyle: React.CSSProperties = { padding: '12px', color: 'var(--ink)' }

function EmptyBox({ label }: { label: string }) {
  return <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>{label}</div>
}

function ExportBtn({ onClick, label, gold }: { onClick: () => void; label: string; gold?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={
        gold
          ? { padding: '7px 12px', border: '1px solid var(--navy)', background: 'var(--navy)', color: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 12.5, fontWeight: 700 }
          : { padding: '7px 12px', border: '1px solid var(--gold)', background: 'transparent', color: 'var(--navy)', borderRadius: 6, cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }
      }
    >
      {label} ⤓
    </button>
  )
}

function segBtn(active: boolean): React.CSSProperties {
  return {
    padding: '7px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 700,
    border: `1px solid ${active ? 'var(--navy)' : 'var(--line)'}`,
    background: active ? 'var(--navy)' : '#fff', color: active ? '#fff' : 'var(--ink)', fontFamily: 'inherit',
  }
}
