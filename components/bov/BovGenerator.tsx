'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { fetchListings, Listing } from '@/lib/listings'
import { BovContent, generateBovContent, fetchBovVersions, saveBovVersion, BovVersion } from '@/lib/bov'
import { exportBovToPdf } from '@/lib/pdfExport'
import { useToast } from '@/components/ui/Toast'
import { LoadingState, EmptyState } from '@/components/ui'

export default function BovGenerator() {
  const toast = useToast()
  const searchParams = useSearchParams()
  const [listings, setListings] = useState<Listing[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [content, setContent] = useState<BovContent | null>(null)
  const [versions, setVersions] = useState<BovVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    fetchListings()
      .then((l) => {
        setListings(l)
        setLoading(false)
        const initial = searchParams.get('listing') || l[0]?.id || ''
        if (initial) {
          const listing = l.find((x) => x.id === initial)
          if (listing) {
            setSelectedId(listing.id)
            setContent(generateBovContent(listing))
            fetchBovVersions(listing.id).then(setVersions).catch(() => setVersions([]))
          } else {
            setSelectedId(initial)
          }
        }
      })
      .catch((e) => { toast(e.message, 'error'); setLoading(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleGenerate = async (listingId: string) => {
    setSelectedId(listingId)
    setGenerating(true)
    try {
      const listing = listings.find((l) => l.id === listingId)
      if (!listing) throw new Error('Listing not found')
      setContent(generateBovContent(listing))
      setVersions(await fetchBovVersions(listingId).catch(() => []))
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!content || !selectedId) return
    try {
      const v = await saveBovVersion(selectedId, content, 'draft')
      setVersions((prev) => [v, ...prev])
      toast('BOV version saved', 'success')
    } catch (e: any) {
      toast(e.message, 'error')
    }
  }

  const row = (k: string, v: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f0ecdf' }}>
      <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>{k}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold-dark)' }}>{v}</span>
    </div>
  )

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26 }}>BOV Generator</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>
          Professional Broker Opinion of Value — valuation summary, multiples, comparables
        </p>
      </header>

      <div className="card" style={{ padding: 18, marginBottom: 24 }}>
        <label className="label">Select a Listing</label>
        <select
          className="select"
          value={selectedId}
          onChange={(e) => handleGenerate(e.target.value)}
          style={{ maxWidth: 480 }}
        >
          <option value="">— Choose a listing —</option>
          {listings.map((l) => (
            <option key={l.id} value={l.id}>{l.business_name} · {fmt(l.asking_price)}</option>
          ))}
        </select>
      </div>

      {loading && <LoadingState label="Loading listings..." />}
      {!loading && listings.length === 0 && (
        <EmptyState icon="🏢" title="No listings yet" subtitle="Create a listing to generate a BOV." />
      )}
      {generating && <LoadingState label="Generating BOV..." />}

      {content && !generating && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={handleSave}>💾 Save Version</button>
            <button className="btn btn-navy" onClick={() => exportBovToPdf(content)}>⬇️ Export PDF</button>
            {versions.length > 0 && <span className="section-title">Version {versions[0].version}</span>}
          </div>

          <div style={{ maxWidth: 820, margin: '0 auto' }}>
            <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 4, boxShadow: '0 12px 40px rgba(26,26,46,0.15)' }}>
              {/* Header band */}
              <div style={{ background: '#1a1a2e', padding: '30px 40px' }}>
                <div className="section-title" style={{ color: 'var(--gold-light)' }}>BROKER OPINION OF VALUE</div>
                <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginTop: 8 }}>{content.title}</div>
              </div>
              <div style={{ height: 3, background: 'var(--gold)' }} />

              <div style={{ padding: '30px 40px' }}>
                {/* Confidentiality notice */}
                <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', backgroundColor: 'var(--cream)', border: '1px solid var(--line)', borderRadius: 6, padding: 12, marginBottom: 24 }}>
                  🔒 CONFIDENTIAL — This document contains proprietary and confidential information. Any reproduction, distribution, or disclosure without prior written consent is strictly prohibited.
                </div>

                {/* Table of Contents */}
                <div className="section-title">Table of Contents</div>
                <hr className="divider-gold" />
                {['Executive Summary', ...content.sections.map((s) => s.title)].map((t, i) => (
                  <div key={t} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f0ecdf', fontSize: 13.5 }}>
                    <span>{i + 1}.  {t}</span>
                    <span style={{ color: 'var(--gold-dark)', fontWeight: 700 }}>{String(i + 1).padStart(2, '0')}</span>
                  </div>
                ))}

                {/* Valuation summary */}
                <div className="section-title" style={{ marginTop: 28 }}>Valuation Summary</div>
                <hr className="divider-gold" />
                {row('Business', content.businessName)}
                {row('Asking Price', fmt(content.askingPrice))}
                {row('Annual Revenue', fmt(content.revenue))}
                {row('SDE', fmt(content.sde))}
                {row('EBITDA', fmt(content.ebitda))}
                {row('Price / Revenue', content.revenueMultiple)}
                {row('Price / SDE', content.sdeMultiple)}
                {row('Price / EBITDA', content.ebitdaMultiple)}
                {row('Indicative Value Range', content.valuationRange)}

                {/* Full multi-section document (10+ pages) */}
                {content.sections.map((section, si) => (
                  <div key={section.id} style={{ marginTop: 34, paddingTop: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ background: 'var(--navy)', color: 'var(--gold-light)', borderRadius: 4, fontSize: 12, fontWeight: 700, padding: '4px 9px' }}>{String(si + 2).padStart(2, '0')}</span>
                      <div className="section-title" style={{ margin: 0 }}>{section.title}</div>
                    </div>
                    <hr className="divider-gold" />
                    {section.subsections.map((sub, k) => (
                      <div key={k} style={{ marginTop: sub.heading ? 16 : 8 }}>
                        {sub.heading && (
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--navy)', margin: '0 0 6px' }}>{sub.heading}</div>
                        )}
                        {sub.body.map((line, j) => (
                          <p key={j} style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text)', margin: '0 0 8px' }}>{line}</p>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}

                {/* Comparable transactions */}
                <div className="section-title" style={{ marginTop: 34 }}>Comparable Transactions</div>
                <hr className="divider-gold" />
                <div style={{ width: '100%', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--navy)', color: 'var(--gold-light)', textAlign: 'left' }}>
                        {['Business', 'Location', 'Price', 'Revenue', 'Multiple'].map((h) => (
                          <th key={h} style={{ padding: '9px 12px', fontWeight: 700 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {content.comparables.map((c, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f0ecdf' }}>
                          <td style={{ padding: '9px 12px', fontWeight: 600 }}>{c.business}</td>
                          <td style={{ padding: '9px 12px' }}>{c.location}</td>
                          <td style={{ padding: '9px 12px' }}>{fmt(c.price)}</td>
                          <td style={{ padding: '9px 12px' }}>{fmt(c.revenue)}</td>
                          <td style={{ padding: '9px 12px', fontWeight: 700, color: 'var(--gold-dark)' }}>{c.multiple ? c.multiple.toFixed(2) + 'x' : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Assumptions */}
                <div className="section-title" style={{ marginTop: 34 }}>Assumptions & Methodology</div>
                <hr className="divider-gold" />
                {content.assumptions.map((a, i) => (
                  <p key={i} style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text)', margin: '8px 0' }}>• {a}</p>
                ))}

                {/* Next steps note */}
                <div className="section-title" style={{ marginTop: 26 }}>Confidentiality & Next Steps</div>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text)', backgroundColor: 'var(--cream)', border: '1px solid var(--line)', borderRadius: 6, padding: 14 }}>
                  By accepting this document, you agree to treat its contents as confidential and to use the information solely to evaluate a potential acquisition. Neither this document nor its contents constitute an offer to sell. For qualified buyers: execute the Confidentiality Agreement, access the secure data room, complete management Q&amp;A, and submit an indicative offer.
                </p>

                {/* Disclaimer */}
                <p style={{ fontSize: 11.5, color: 'var(--muted)', fontStyle: 'italic', marginTop: 24, lineHeight: 1.6, borderTop: '1px solid var(--line)', paddingTop: 16 }}>
                  Disclaimer: {content.disclaimer}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const fmt = (n: number | null | undefined): string => {
  if (n === null || n === undefined || isNaN(n)) return '$—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
