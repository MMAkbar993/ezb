'use client'

// =============================================================================
// FinancialSummaryView — renders the comprehensive financial summary report:
// an executive overview plus structured sections (revenue history, expenses,
// add-backs, cash flow / working capital / debt, ratios, trends, valuation).
// =============================================================================

import { useMemo } from 'react'
import type { FinancialSummaryReport } from '../../lib/ai/summaryGenerator'

export default function FinancialSummaryView({ report }: { report: FinancialSummaryReport }) {
  const stats = useMemo(() => {
    const s = report.sections || []
    const revenue = s.find((x) => x.id === 'revenue')
    const valuation = s.find((x) => x.id === 'valuation')
    return { revenueRows: revenue?.table?.rows || [], valuationRows: valuation?.table?.rows || [] }
  }, [report])

  return (
    <div>
      {/* Executive summary */}
      <div style={{ background: 'linear-gradient(135deg, var(--navy), var(--navy-3))', color: '#fff', borderRadius: 12, padding: '20px 22px', marginBottom: 18 }}>
        <div style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 16, color: 'var(--gold-light)', marginBottom: 8 }}>Executive Financial Summary</div>
        <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0, color: '#eae7f2' }}>{report.executiveSummary}</p>
        <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap', fontSize: 12 }}>
          {stats.valuationRows.slice(0, 2).map((r: any, i: number) => (
            <span key={i} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 6, padding: '2px 8px' }}>
              <span style={{ color: 'var(--gold-light)' }}>{r[0]}:</span> <strong>{r[1]}</strong>
            </span>
          ))}
          <span style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 6, padding: '2px 8px' }}>
            Generated {new Date(report.generatedAt).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Structured sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {report.sections.map((sec, i) => (
          <section key={sec.id} style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--cream)' }}>
              <span style={{ minWidth: 26, height: 26, borderRadius: 13, background: 'var(--navy)', color: 'var(--gold-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, fontFamily: 'Georgia, serif' }}>
                {i + 1}
              </span>
              <h3 style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 15, color: 'var(--navy)', margin: 0 }}>{sec.title}</h3>
            </div>
            <div style={{ padding: 14 }}>
              {sec.paragraphs.map((p, j) => <p key={j} style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text)', margin: '0 0 8px' }}>{p}</p>)}

              {sec.bullets && sec.bullets.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, marginTop: 8 }}>
                  {sec.bullets.map((b, j) => (
                    <div key={j} style={{ background: 'var(--cream)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', fontFamily: 'Georgia, serif', fontWeight: 700 }}>{b.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginTop: 2 }}>{b.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {sec.table && sec.table.rows.length > 0 && (
                <div style={{ overflowX: 'auto', marginTop: sec.bullets?.length ? 10 : 6 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>
                        {sec.table.columns.map((c, j) => (
                          <th key={j} style={{ textAlign: 'left', fontFamily: 'Georgia, serif', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--gold-dark)', borderBottom: '2px solid var(--gold)', padding: '6px 8px', whiteSpace: 'nowrap' }}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sec.table.rows.map((row, j) => (
                        <tr key={j} style={{ background: j % 2 ? '#faf9f4' : '#fff' }}>
                          {row.map((cell, k) => (
                            <td key={k} style={{ padding: '6px 8px', borderBottom: '1px solid var(--line)', color: k === 0 ? 'var(--navy)' : 'var(--text)', fontWeight: k === 0 ? 600 : 400, whiteSpace: k > 0 ? 'nowrap' : undefined }}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
