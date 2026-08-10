'use client'

import { RecastResult, ADD_BACK_CATEGORIES, fmt$, fmt$K, ENTITY_TYPES } from '@/lib/recast'
import { exportRecastToPdf } from '@/lib/pdfExport'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'

interface Props {
  result: RecastResult
  onClose: () => void
}

/** Professional recasted financial report — before/after comparison, broker-grade. */
export default function RecastReport({ result, onClose }: Props) {
  const entityLabel = ENTITY_TYPES.find((t) => t.id === result.entityType)?.label || result.entityType
  const yearsSorted = result.years.slice().sort((a, b) => b.year - a.year)

  // Chart data — as-reported net income vs recast SDE across years
  const chartData = yearsSorted.map((y) => ({
    name: y.label,
    'As-Reported': Math.round(y.asReported.netIncome),
    'Recast SDE': Math.round(y.recast.sde),
  }))

  const handleExport = () => {
    exportRecastToPdf(result)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.6)', zIndex: 1200, overflowY: 'auto', padding: '30px 16px' }} onClick={onClose}>
      <div style={{ background: '#fff', maxWidth: 900, margin: '0 auto', borderRadius: 12, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }} onClick={(e) => e.stopPropagation()}>
        {/* Cover */}
        <div style={{ background: 'var(--navy)', padding: '34px 40px', color: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700, letterSpacing: 1 }}>{result.businessName}</div>
              <div style={{ color: 'var(--gold)', letterSpacing: '0.2em', fontSize: 11, textTransform: 'uppercase', marginTop: 4 }}>Recasted Financial Statement</div>
            </div>
            <button className="btn btn-ghost" onClick={handleExport} style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>⬇️ Export PDF</button>
            <button className="btn btn-ghost" onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>✕ Close</button>
          </div>
          <div style={{ height: 2, background: 'var(--gold)', marginTop: 16 }} />
          <div style={{ display: 'flex', gap: 24, marginTop: 18, fontSize: 13 }}>
            <div><span style={{ color: 'rgba(255,255,255,0.6)' }}>Entity:</span> <strong style={{ color: 'var(--gold-light)' }}>{entityLabel}</strong></div>
            <div><span style={{ color: 'rgba(255,255,255,0.6)' }}>Currency:</span> <strong style={{ color: 'var(--gold-light)' }}>{result.currency}</strong></div>
            <div><span style={{ color: 'rgba(255,255,255,0.6)' }}>Periods:</span> <strong style={{ color: 'var(--gold-light)' }}>{result.years.length} fiscal years</strong></div>
          </div>
        </div>

        <div style={{ padding: '0 40px 40px' }}>
          {/* Key summary metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, margin: '24px 0' }}>
            <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 18, background: 'var(--cream)' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Average SDE</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--gold-dark)', fontFamily: 'Georgia, serif' }}>{fmt$(result.avgSDE, result.currency)}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Seller's Discretionary Earnings</div>
            </div>
            <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 18, background: 'var(--cream)' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Average EBITDA</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--navy)', fontFamily: 'Georgia, serif' }}>{fmt$(result.avgEBITDA, result.currency)}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Earnings Before Interest, Tax, D&A</div>
            </div>
            <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Trend</div>
              <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', fontFamily: 'Georgia, serif', marginTop: 6, lineHeight: 1.4 }}>{result.trendNote}</div>
            </div>
          </div>

          {/* Before vs After chart */}
          {chartData.length > 0 && (
            <div style={{ marginBottom: 28, background: 'var(--cream)', border: '1px solid var(--line)', borderRadius: 10, padding: 20 }}>
              <h3 style={{ fontSize: 18, color: 'var(--navy)', margin: '0 0 6px', fontFamily: 'Georgia, serif' }}>Before vs After — Visual Comparison</h3>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 16px' }}>
                As-reported net income vs recast SDE — illustrates the full impact of add-backs.
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 10, right: 12, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e0d3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fontFamily: 'Georgia, serif', fill: '#7a7a8a' }} />
                  <YAxis tickFormatter={(v) => fmt$(v)} tick={{ fontSize: 11, fill: '#7a7a8a' }} />
                  <Tooltip
                    formatter={(value: any) => fmt$(Number(value))}
                    contentStyle={{ fontFamily: 'Georgia, serif', border: '1px solid var(--line)', borderRadius: 8 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'Georgia, serif' }} />
                  <Bar dataKey="As-Reported" fill="#a8872f" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Recast SDE" fill="#1a1a2e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Per-year before/after table */}
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 18, color: 'var(--navy)', margin: '0 0 12px', fontFamily: 'Georgia, serif' }}>Before vs After — Recast Comparison</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--navy)' }}>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 13, color: 'var(--navy)' }}>Metric</th>
                    {yearsSorted.map((y) => <th key={y.year} style={{ textAlign: 'right', padding: '10px 12px', fontSize: 13, color: 'var(--navy)' }}>{y.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--line)', background: 'rgba(201,168,76,0.06)' }}>
                    <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700 }}>Revenue</td>
                    {yearsSorted.map((y) => <td key={y.year} style={{ padding: '10px 12px', textAlign: 'right', fontSize: 14, fontWeight: 700 }}>{fmt$K(y.recast.revenue, result.currency)}</td>)}
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--muted)' }}>As-Reported Net Income</td>
                    {yearsSorted.map((y) => <td key={y.year} style={{ padding: '10px 12px', textAlign: 'right', fontSize: 14 }}>{fmt$K(y.asReported.netIncome, result.currency)}</td>)}
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: 'var(--gold-dark)' }}>+ Add-backs</td>
                    {yearsSorted.map((y) => <td key={y.year} style={{ padding: '10px 12px', textAlign: 'right', fontSize: 14, fontWeight: 700, color: 'var(--gold-dark)' }}>+{fmt$K(y.totalAddBacks, result.currency)}</td>)}
                  </tr>
                  <tr style={{ borderTop: '2px solid var(--gold)', background: 'rgba(201,168,76,0.12)' }}>
                    <td style={{ padding: '10px 12px', fontSize: 14, fontWeight: 800, color: 'var(--navy)' }}>Recast SDE</td>
                    {yearsSorted.map((y) => <td key={y.year} style={{ padding: '10px 12px', textAlign: 'right', fontSize: 16, fontWeight: 800, color: 'var(--gold-dark)' }}>{fmt$(y.recast.sde, result.currency)}</td>)}
                  </tr>
                  <tr style={{ background: 'rgba(26,26,46,0.04)' }}>
                    <td style={{ padding: '10px 12px', fontSize: 14, fontWeight: 800, color: 'var(--navy)' }}>Recast EBITDA</td>
                    {yearsSorted.map((y) => <td key={y.year} style={{ padding: '10px 12px', textAlign: 'right', fontSize: 16, fontWeight: 800, color: 'var(--navy)' }}>{fmt$(y.recast.ebitda, result.currency)}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Add-back detail */}
          <div>
            <h3 style={{ fontSize: 18, color: 'var(--navy)', margin: '0 0 12px', fontFamily: 'Georgia, serif' }}>Add-Back Detail</h3>
            {yearsSorted.map((y) => (
              <div key={y.year} style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)', marginBottom: 6 }}>{y.label} — {fmt$(y.totalAddBacks, result.currency)} total add-backs</div>
                {y.addBackDetail.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>No add-backs recorded for this period.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {y.addBackDetail.map((d) => {
                      const catLabel = ADD_BACK_CATEGORIES.find((c) => c.id === d.category)?.label || d.category
                      return (
                        <div key={d.category} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--cream)', borderRadius: 6, fontSize: 13 }}>
                          <span style={{ fontWeight: 600 }}>{catLabel}</span>
                          <span style={{ fontWeight: 700, color: 'var(--gold-dark)' }}>+{fmt$(d.amount, result.currency)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, color: 'var(--muted)', borderTop: '1px solid var(--line)', marginTop: 24, paddingTop: 16, lineHeight: 1.6 }}>
            <strong>Disclaimer:</strong> This recast is an estimate prepared for business-valuation purposes and may not reflect GAAP financial statements.
            Add-backs are subject to buyer and lender verification. Figures include owner compensation, non-recurring, discretionary and
            non-arm's-length adjustments as standard industry practice for SDE/EBITDA normalization.
          </div>
        </div>
      </div>
    </div>
  )
}
