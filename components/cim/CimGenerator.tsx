'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { fetchListings, Listing } from '@/lib/listings'
import { CimContent, generateCimContent, fetchCimVersions, saveCimVersion, CimVersion } from '@/lib/cim'
import { exportCimToPdf } from '@/lib/pdfExport'
import { useToast } from '@/components/ui/Toast'
import { LoadingState, EmptyState } from '@/components/ui'

export default function CimGenerator() {
  const toast = useToast()
  const searchParams = useSearchParams()
  const [listings, setListings] = useState<Listing[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [content, setContent] = useState<CimContent | null>(null)
  const [versions, setVersions] = useState<CimVersion[]>([])
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
            setContent(generateCimContent(listing))
            fetchCimVersions(listing.id).then(setVersions).catch(() => setVersions([]))
          } else {
            setSelectedId(initial)
          }
        }
      })
      .catch((e) => { toast(e.message, 'error'); setLoading(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadVersions = useCallback(async (listingId: string) => {
    try {
      setVersions(await fetchCimVersions(listingId))
    } catch { setVersions([]) }
  }, [])

  const handleGenerate = async (listingId: string) => {
    setSelectedId(listingId)
    setGenerating(true)
    try {
      const listing = listings.find((l) => l.id === listingId)
      if (!listing) throw new Error('Listing not found')
      const c = generateCimContent(listing)
      setContent(c)
      await loadVersions(listingId)
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setGenerating(false)
    }
  }

  const handleSaveVersion = async () => {
    if (!content || !selectedId) return
    try {
      const v = await saveCimVersion(selectedId, content, 'draft')
      setVersions((prev) => [v, ...prev])
      toast('CIM version saved', 'success')
    } catch (e: any) {
      toast(e.message, 'error')
    }
  }

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26 }}>CIM Generator</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>
          Professional Confidential Information Memorandum — auto-generated from listing data
        </p>
      </header>

      {/* Selector */}
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
        <EmptyState icon="🏢" title="No listings yet" subtitle="Create a listing to generate a CIM." />
      )}

      {generating && <LoadingState label="Generating CIM..." />}

      {content && !generating && (
        <>
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={handleSaveVersion}>💾 Save Version</button>
            <button className="btn btn-navy" onClick={() => exportCimToPdf(content)}>⬇️ Export PDF</button>
            <button className="btn btn-ghost" onClick={async () => {
              try {
                const link = `${window.location.origin}/share/cim/${selectedId}`
                if (navigator.clipboard) await navigator.clipboard.writeText(link)
                toast('Share link copied to clipboard', 'success')
              } catch { toast('Could not copy link', 'error') }
            }}>🔗 Copy Share Link</button>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Generated {content.generatedAt}</span>
            <div style={{ flex: 1 }} />
            {versions.length > 0 && (
              <span className="section-title">Version {versions[0].version} · {versions.length} total</span>
            )}
          </div>

          {/* Print-styled preview */}
          <div style={{ maxWidth: 820, margin: '0 auto' }}>
            <div
              style={{
                background: '#fff', border: '1px solid var(--line)', borderRadius: 4,
                boxShadow: '0 12px 40px rgba(26,26,46,0.15)', overflow: 'hidden',
                position: 'relative',
              }}
            >
              {/* Watermark */}
              {content.confidential && (
                <div
                  style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transform: 'rotate(-30deg)', pointerEvents: 'none', zIndex: 5,
                  }}
                >
                  <div style={{ fontSize: 90, fontWeight: 700, color: 'rgba(201,168,76,0.08)', letterSpacing: 8 }}>
                    CONFIDENTIAL
                  </div>
                </div>
              )}

              {/* Cover */}
              <div style={{ background: '#1a1a2e', color: '#fff', padding: '120px 60px', position: 'relative' }}>
                <div style={{ height: 2.5, width: '100%', background: 'var(--gold)', position: 'absolute', top: '46%', left: 0 }} />
                <h2 style={{ color: 'var(--gold-light)', fontSize: 32, margin: 0 }}>{content.title}</h2>
                <div style={{ color: '#fff', fontSize: 18, marginTop: 14 }}>{content.subtitle}</div>
                <div style={{ color: 'var(--gold)', fontSize: 11, letterSpacing: 3, marginTop: 26 }}>CONFIDENTIAL INFORMATION MEMORANDUM</div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 18 }}>Prepared: {content.generatedAt}</div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 8 }}>CONCORD DEAL PLATFORM</div>
              </div>

              {/* TOC */}
              <div style={{ padding: '40px 60px' }}>
                <div className="section-title" style={{ fontSize: 12 }}>Table of Contents</div>
                <hr className="divider-gold" />
                {content.sections.map((s) => (
                  <div key={s.id} style={{ padding: '9px 0', borderBottom: '1px solid #f0ecdf', color: 'var(--navy)', fontWeight: 600, fontSize: 14 }}>
                    {s.title}
                  </div>
                ))}
              </div>

              {/* Sections */}
              {content.sections.map((section) => (
                <div key={section.id} style={{ padding: '40px 60px', borderTop: '1px solid var(--line)' }}>
                  <div
                    style={{
                      background: 'var(--navy)', color: 'var(--gold-light)', padding: '14px 20px',
                      borderRadius: 4, fontSize: 16, fontWeight: 700, marginBottom: 20,
                    }}
                  >
                    {section.title}
                  </div>
                  {section.subsections.map((sub, i) => (
                    <div key={i} style={{ marginBottom: 18 }}>
                      <h3 style={{ fontSize: 14, color: 'var(--navy)', margin: '0 0 6px' }}>{sub.heading}</h3>
                      {sub.body.map((line, j) => (
                        <p key={j} style={{ margin: '6px 0', fontSize: 13.5, lineHeight: 1.55, color: 'var(--text)' }}>
                          {line}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              ))}

              {/* Disclaimer */}
              <div style={{ padding: '40px 60px', borderTop: '1px solid var(--line)', background: '#faf9f4' }}>
                <div className="section-title">Confidentiality</div>
                <hr className="divider-gold" />
                <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                  This document is confidential and proprietary to the seller and its advisor. It is provided solely for the
                  purpose of evaluating a potential transaction and may not be reproduced, distributed, or used for any other
                  purpose without the prior written consent of the seller. This memorandum does not constitute an offer to sell.
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
