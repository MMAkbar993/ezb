'use client'

// =============================================================================
// UniversalDocumentUpload — drop ANY financial document (all 15+ types) and it
// is auto-detected, auto-tagged, uploaded to the data room, and analyzed by the
// intelligence engine (Claude). Single flow: pick files → see live type
// detection → one click uploads + analyzes → emits the intelligence bundle.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  detectUniversalDocTypeClient,
  UNIVERSAL_TYPE_SHORT_LABELS,
} from '@/lib/financialExtractor'
import { UNIVERSAL_DOC_TYPE_INFO, type UniversalDocType } from '@/lib/ai/types'
import { getAccessToken, fetchDealOptions, uploadFinancialFiles, formatBytes, type DealOption } from '@/lib/financialFiles'
import type { FinancialIntelligence } from '@/lib/ai/types'
import type { FinancialSummaryReport } from '@/lib/ai/summaryGenerator'
import type { AiExtractionOutput } from '../../lib/ai/financialExtractor'

export interface AnalyzeResponse {
  ok: boolean
  error?: string
  extraction: AiExtractionOutput
  report: FinancialSummaryReport
  intelligence: FinancialIntelligence
}

export default function UniversalDocumentUpload({
  onAnalyzed,
}: {
  onAnalyzed?: (r: AnalyzeResponse) => void
}) {
  const [deals, setDeals] = useState<DealOption[]>([])
  const [selected, setSelected] = useState('')
  const [queue, setQueue] = useState<File[]>([])
  const [busy, setBusy] = useState<'upload' | 'analyze' | null>(null)
  const [step, setStep] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ fileName: string; percent: number }[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchDealOptions().then(setDeals).catch(() => setDeals([]))
  }, [])

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return
    setQueue((prev) => {
      const seen = new Set(prev.map((f) => f.name + '|' + f.size))
      const unique = Array.from(list).filter((f) => !seen.has(f.name + '|' + f.size))
      return [...prev, ...unique]
    })
    setError(null)
  }

  const onRemove = useCallback((name: string) => {
    setQueue((prev) => prev.filter((f) => f.name !== name))
  }, [])

  const detected = useMemo(
    () =>
      queue.map((f) => ({
        name: f.name,
        size: f.size,
        type: detectUniversalDocTypeClient(f.name),
      })),
    [queue],
  )

  const areaCounts = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const d of detected) {
      const area = UNIVERSAL_DOC_TYPE_INFO[d.type].area
      acc[area] = (acc[area] || 0) + 1
    }
    return acc
  }, [detected])

  const AREA_LABELS: Record<string, string> = {
    tax: '🧾 Tax',
    financials: '📊 Core Financials',
    cash: '💵 Cash',
    operations: '⚙️ Operations',
    planning: '🧠 Planning',
  }

  const selectedOption = useMemo(() => deals.find((d) => d.id === selected) || null, [deals, selected])

  const run = useCallback(async () => {
    if (!selectedOption) { setError('Select a listing / deal to attach the analysis to.'); return }
    if (!queue.length) { setError('Add at least one document first.'); return }
    const token = await getAccessToken()
    if (!token) { setError('You must be signed in to analyze documents.'); return }

    setBusy('upload'); setError(null); setStep(`Uploading ${queue.length} document(s)…`)
    const upload = await uploadFinancialFiles(
      { dealId: selectedOption.dealId, listingId: selectedOption.listingId, parentId: selected },
      queue,
      (p) => setProgress(p.map((x) => ({ fileName: x.fileName, percent: x.percent }))),
    )
    if (upload.ok === 0) { setBusy(null); setError(upload.errors[0] || 'Upload failed.'); return }

    setBusy('analyze'); setStep('🧠 Claude reading and extracting financial data…')
    try {
      const res = await fetch('/api/financial/intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ listingId: selectedOption.listingId }),
      })
      const data = (await res.json()) as AnalyzeResponse
      if (!data.ok) throw new Error(data.error || 'Analysis failed')
      onAnalyzed?.(data)
      setQueue([]); setProgress([])
    } catch (e: any) {
      setError(e?.message || 'Analysis failed')
    } finally {
      setBusy(null); setStep('')
    }
  }, [selected, queue, onAnalyzed])

  const AreaDot = ({ type }: { type: UniversalDocType }) => (
    <span style={{ background: 'var(--navy)', color: '#fff', borderRadius: 5, padding: '1px 6px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {UNIVERSAL_TYPE_SHORT_LABELS[type]}
    </span>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        <div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 19, color: 'var(--navy)', margin: 0 }}>Universal Financial Intelligence</h2>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
            Reads <strong>any</strong> financial document — tax returns, P&amp;L, balance sheets, bank statements, AR/AP, payroll, projections &amp; more.
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--gold-dark)', fontFamily: 'Georgia, serif', textAlign: 'right' }}>
          Auto-detect · Auto-tag · AI-extract<br />Claude-powered
        </div>
      </div>

      {/* Listing selector */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, margin: '14px 0' }}>
        <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', fontFamily: 'Georgia, serif' }}>Attach to</label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="select"
          disabled={!!busy}
          style={{ flex: '1 1 260px', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', fontFamily: 'inherit', fontSize: 13.5 }}
        >
          <option value="">Select a listing / deal…</option>
          {deals.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
        </select>
      </div>

      {/* Dropzone */}
      <div
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
        style={{
          border: '2px dashed var(--gold)', borderRadius: 12, background: 'var(--cream)',
          padding: '26px 18px', textAlign: 'center', cursor: busy ? 'not-allowed' : 'pointer', transition: 'all .15s',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.csv,.tsv,.txt,.xls,.xlsx,.doc,.docx,image/*"
          style={{ display: 'none' }}
          onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
        />
        <div style={{ fontSize: 28, marginBottom: 4 }}>📥</div>
        <div style={{ fontFamily: 'Georgia, serif', color: 'var(--navy)', fontWeight: 600 }}>Drag &amp; drop financial documents here, or click to browse</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
          PDF · CSV · Excel · Word · Text — any format, auto-detected
        </div>
      </div>

      {/* Detected queue */}
      {detected.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--gold-dark)', fontWeight: 700, fontFamily: 'Georgia, serif', marginBottom: 8 }}>
            Auto-detected types ({detected.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {detected.map((d) => {
              const p = progress.find((x) => x.fileName === d.name)
              return (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--cream)', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 10px', fontSize: 12.5 }}>
                  <AreaDot type={d.type} />
                  <span style={{ color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                  <span style={{ color: 'var(--muted)', fontSize: 11.5 }}>{formatBytes(d.size)}</span>
                  {p && <span style={{ color: 'var(--gold-dark)', fontSize: 11.5, minWidth: 44, textAlign: 'right' }}>{p.percent}%</span>}
                  {!busy && (
                    <button onClick={() => onRemove(d.name)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 14, lineHeight: 1 }} title="Remove">×</button>
                  )}
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {Object.entries(areaCounts).map(([area, count]) => (
              <span key={area} style={{ fontSize: 12, color: 'var(--muted)', background: '#f1efe7', borderRadius: 6, padding: '2px 8px' }}>
                {AREA_LABELS[area] || area}: <strong style={{ color: 'var(--navy)' }}>{count}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', maxWidth: 380 }}>
          Uploads to the data room, then Claude extracts revenue, expenses, SDE/EBITDA, add-backs, ratios, trends &amp; a professional summary.
        </div>
        <button
          onClick={run}
          disabled={!!busy || !selected || !queue.length}
          className="btn-primary"
          style={{ fontWeight: 700, padding: '10px 18px' }}
        >
          {busy ? `${step}` : '🚀 Upload & Analyze'}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 12, background: '#fdecea', border: '1px solid #f5c6c0', color: '#b3261e', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  )
}
