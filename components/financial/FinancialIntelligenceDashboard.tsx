'use client'

// =============================================================================
// FinancialIntelligenceDashboard — visualization of the AI-extracted financial
// intelligence: revenue timeline, SDE/EBITDA, add-backs, value range, ratios,
// trends and the set of documents that were analyzed.
// =============================================================================

import { useMemo } from 'react'
import type { FinancialIntelligence } from '@/lib/ai/types'

const money = (n: number | null | undefined): string =>
  n == null || isNaN(n) ? '—' : '$' + Math.round(n).toLocaleString()

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <div style={{ flex: 1, height: 8, background: '#eee9dd', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, (value / (max || 1)) * 100)}%`, height: '100%', background: 'linear-gradient(90deg, var(--navy), var(--gold))', borderRadius: 4 }} />
    </div>
  )
}

export default function FinancialIntelligenceDashboard({ intel }: { intel: FinancialIntelligence }) {
  const maxRevenue = useMemo(
    () => Math.max(1, ...intel.revenueByYear.map((r) => r.revenue)),
    [intel.revenueByYear],
  )
  const revenueGrowth = useMemo(() => {
    if (intel.revenueByYear.length < 2) return null
    const sorted = [...intel.revenueByYear].sort((a, b) => a.year - b.year)
    const first = sorted[0].revenue
    const last = sorted[sorted.length - 1].revenue
    if (!first) return null
    return ((last - first) / first) * 100
  }, [intel.revenueByYear])

  return (
    <div>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {[
          { label: 'Revenue', value: money(intel.revenueByYear[0]?.revenue ?? intel.sde), accent: 'var(--navy)' },
          { label: 'SDE', value: money(intel.sde), accent: 'var(--gold-dark)' },
          { label: 'EBITDA', value: money(intel.ebitda), accent: '#0e7490' },
          { label: 'Value Range', value: `${money(intel.valueRangeLow)} – ${money(intel.valueRangeHigh)}`, accent: '#7c3aed' },
          { label: 'Working Capital', value: money(intel.workingCapital), accent: '#1a3a8f' },
          { label: 'Debt', value: money(intel.debt), accent: '#b3261e' },
        ].map((k) => (
          <div key={k.label} style={{ background: 'var(--cream)', border: '1px solid var(--line)', borderLeft: `4px solid ${k.accent}`, borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--gold-dark)', fontWeight: 700, fontFamily: 'Georgia, serif' }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: k.accent, fontFamily: 'Georgia, serif', marginTop: 2, whiteSpace: 'nowrap' }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18, marginTop: 18 }}>
        {/* Revenue timeline */}
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontWeight: 700, color: 'var(--navy)', fontSize: 15, marginBottom: 2 }}>Revenue Timeline</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
            {revenueGrowth == null
              ? 'Single period — add more years for trend.'
              : revenueGrowth >= 0
                ? `↑ ${revenueGrowth.toFixed(0)}% over period`
                : `↓ ${Math.abs(revenueGrowth).toFixed(0)}% over period`}
          </div>
          {intel.revenueByYear.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13 }}>No revenue extracted.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...intel.revenueByYear].sort((a, b) => a.year - b.year).map((r) => (
              <div key={r.year}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--muted)' }}>{r.label}</span>
                  <span style={{ fontWeight: 700, color: 'var(--navy)' }}>{money(r.revenue)}</span>
                </div>
                <Bar value={r.revenue} max={maxRevenue} />
              </div>
            ))}
          </div>
        </div>

        {/* Add-backs */}
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontWeight: 700, color: 'var(--navy)', fontSize: 15, marginBottom: 2 }}>Add-Backs (Normalization)</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Discretionary / non-recurring items restored to earnings</div>
          {intel.addBacks.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13 }}>No add-backs identified.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {intel.addBacks.map((a, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5, borderBottom: '1px solid var(--line)', paddingBottom: 6 }}>
                <span style={{ color: 'var(--text)' }}>{a.label} <em style={{ color: 'var(--muted)', fontSize: 11 }}>{a.recurring ? '(recurring)' : '(one-time)'}</em></span>
                <span style={{ fontWeight: 700, color: '#0e7490', whiteSpace: 'nowrap' }}>+ {money(a.amount)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Ratios */}
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontWeight: 700, color: 'var(--navy)', fontSize: 15, marginBottom: 2 }}>Key Ratios</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Benchmarked financial health</div>
          {intel.ratios.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13 }}>No ratios extracted from source docs.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {intel.ratios.map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5, alignItems: 'center' }}>
                <span style={{ color: 'var(--text)' }}>{r.name}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 700, color: 'var(--navy)' }}>{r.value}</span>
                  <span style={{ width: 8, height: 8, borderRadius: 5, background: r.healthy ? '#16a34a' : '#b3261e', display: 'inline-block' }} title={r.note} />
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Trends */}
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontWeight: 700, color: 'var(--navy)', fontSize: 15, marginBottom: 2 }}>Trends &amp; Patterns</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Directional signals from the document set</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {intel.trends.map((t, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5 }}>
                <span style={{ color: 'var(--text)' }}>{t.label}</span>
                <span style={{ fontWeight: 700, color: t.direction === 'up' ? '#16a34a' : t.direction === 'down' ? '#b3261e' : 'var(--muted)', whiteSpace: 'nowrap' }}>
                  {t.direction === 'up' ? '↑' : t.direction === 'down' ? '↓' : '→'} {t.value}
                </span>
              </div>
            ))}
            {intel.trends.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13 }}>No trends extracted.</div>}
          </div>
        </div>
      </div>

      {/* Documents analyzed */}
      <div style={{ marginTop: 18, background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
        <div style={{ fontFamily: 'Georgia, serif', fontWeight: 700, color: 'var(--navy)', fontSize: 15, marginBottom: 10 }}>Documents Analyzed ({intel.documents.length})</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {intel.documents.map((d, i) => (
            <span key={i} title={`Confidence ${Math.round(d.confidence * 100)}%`} style={{ background: 'var(--cream)', border: '1px solid var(--line)', borderRadius: 8, padding: '5px 9px', fontSize: 12 }}>
              <span style={{ color: 'var(--gold-dark)', fontWeight: 700 }}>{d.typeLabel}</span>
              {' · '}
              <span style={{ color: 'var(--text)' }}>{d.fileName}</span>
            </span>
          ))}
          {intel.documents.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13 }}>No documents could be read (upload first).</div>}
        </div>
      </div>
    </div>
  )
}
