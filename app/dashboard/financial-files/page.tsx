'use client'

// =============================================================================
// /dashboard/financial-files — Financial Files Dashboard (auto-generation).
// -----------------------------------------------------------------------------
// ONE-CLICK system: upload all financial files once, and the Recast -> BOV ->
// CIM -> BLI pipeline runs automatically. Unified view of every document
// (source + generated) with status tracking and a Download-All ZIP button.
// The old step-by-step manual workflow buttons have been removed.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, CardHeader, LoadingState } from '@/components/ui'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import OneClickUpload from '@/components/financial/OneClickUpload'
import AutoGenerationDashboard from '@/components/financial/AutoGenerationDashboard'
import AllDocumentsView from '@/components/financial/AllDocumentsView'
import type { AutoGenerateResult } from '@/lib/autoGenerateTypes'
import UniversalDocumentUpload, { type AnalyzeResponse } from '@/components/financial/UniversalDocumentUpload'
import FinancialIntelligenceDashboard from '@/components/financial/FinancialIntelligenceDashboard'
import FinancialSummaryView from '@/components/financial/FinancialSummaryView'
import type { FinancialIntelligence } from '@/lib/ai/types'
import type { FinancialSummaryReport } from '@/lib/ai/summaryGenerator'
import {
  FinancialDoc, fetchFinancialFiles, fetchDealOptions,
  deleteFinancialFile, getUserId, getAccessToken,
} from '@/lib/financialFiles'

export default function FinancialFilesPage() {
  return (
    <AppShell active="Financial Files">
      <ToastProvider>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <FinancialFilesDashboard />
        </div>
      </ToastProvider>
    </AppShell>
  )
}

interface DealOpt { id: string; title: string }

function FinancialFilesDashboard() {
  const toast = useToast()
  const [files, setFiles] = useState<FinancialDoc[]>([])
  const [deals, setDeals] = useState<DealOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<FinancialDoc | null>(null)
  const [selectedParent, setSelectedParent] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  // Auto-generation state
  const [genResult, setGenResult] = useState<AutoGenerateResult | null>(null)
  const [running, setRunning] = useState(false)
  // Financial Intelligence state
  const [intel, setIntel] = useState<FinancialIntelligence | null>(null)
  const [summary, setSummary] = useState<FinancialSummaryReport | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [f, d, u] = await Promise.all([fetchFinancialFiles(), fetchDealOptions(), getUserId()])
      setFiles(f)
      setDeals(d)
      setUserId(u)
      const { data: prof } = await (await import('@/lib/supabase/client')).supabase
        .from('profiles').select('role').eq('id', u || 'none').maybeSingle()
      setIsAdmin(prof?.role === 'broker' || prof?.role === 'admin')
    } catch (e: any) {
      toast(e?.message || 'Failed to load financial files', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const dealTitle = useMemo(() => {
    const m = new Map(deals.map((d) => [d.id, d.title]))
    return (id: string | null) => (id && m.get(id)) || (id ? id.slice(0, 8) : '—')
  }, [deals])

  const totals = useMemo(() => {
    const gen = files.filter((f) => f.category === 'generated_document')
    const src = files.filter((f) => f.category !== 'generated_document')
    return {
      generated: gen.length,
      uploaded: src.length,
      byStatus: files.reduce<Record<string, number>>((acc, f) => {
        acc[f.status] = (acc[f.status] || 0) + 1
        return acc
      }, {}),
    }
  }, [files])

  const runPipeline = useCallback(async (forParent?: string) => {
    const id = forParent || selectedParent
    if (!id) { toast('Select a listing / deal first', 'info'); return }
    setRunning(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('You need to be signed in to generate documents.')
      const res = await fetch('/api/financial/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ listingId: id }),
      })
      const data = (await res.json()) as AutoGenerateResult
      if (!data.ok) throw new Error(data.error || 'Generation failed')
      setGenResult(data)
      toast(`Generated ${data.artifacts.length} document(s)`, 'success')
      load()
    } catch (e: any) {
      toast(e?.message || 'Generation failed', 'error')
    } finally {
      setRunning(false)
    }
  }, [selectedParent, toast, load])

  const onDelete = async (doc: FinancialDoc) => {
    setDeleting(doc.id)
    const res = await deleteFinancialFile(doc)
    setDeleting(null)
    setConfirmDelete(null)
    if (res.success) { toast('File deleted'); load() }
    else toast(res.error || 'Delete failed — you may only delete files you uploaded', 'error')
  }

  if (loading) return <LoadingState label="Loading financial files…" />

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 6 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 27, color: 'var(--navy)', margin: 0 }}>Financial Files</h1>
          <p style={{ color: 'var(--muted)', margin: '4px 0 0', fontSize: 14 }}>
            Upload once — Recast, BOV, CIM &amp; BLI generate automatically.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={load}>↻ Refresh</button>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, margin: '18px 0' }}>
        {[
          { label: 'Uploaded Sources', value: String(totals.uploaded), color: 'var(--navy)' },
          { label: 'Generated Docs', value: String(totals.generated), color: 'var(--gold-dark)' },
          { label: 'Recast Done', value: String(totals.byStatus.recast_done || 0), color: '#a8872f' },
          { label: 'BOV Done', value: String(totals.byStatus.bov_done || 0), color: '#0e7490' },
          { label: 'CIM Done', value: String(totals.byStatus.cim_done || 0), color: '#1a3a8f' },
          { label: 'BLI Done', value: String(totals.byStatus.bli_done || 0), color: '#7c3aed' },
        ].map((k) => (
          <div key={k.label} className="kpi" style={{ background: 'var(--cream)', border: '1px solid var(--line)', borderLeft: `4px solid ${k.color}`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--gold-dark)', fontWeight: 700, fontFamily: 'Georgia, serif' }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: k.color, fontFamily: 'Georgia, serif', marginTop: 2 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* FINANCIAL INTELLIGENCE */}
      <Card style={{ marginBottom: 22 }}>
        <CardHeader title="Financial Intelligence (AI)" subtitle="Claude reads ANY financial document — detects type, extracts SDE/EBITDA/add-backs/ratios, and generates a comprehensive summary + dashboard" />
        <div style={{ padding: 18 }}>
          <UniversalDocumentUpload
            onAnalyzed={(r: AnalyzeResponse) => {
              setIntel(r.intelligence)
              setSummary(r.report)
              toast('Financial intelligence generated', 'success')
              load()
            }}
          />

          {intel && (
            <div style={{ marginTop: 22, borderTop: '1px solid var(--line)', paddingTop: 18 }}>
              <div style={{ fontFamily: 'Georgia, serif', fontWeight: 700, color: 'var(--navy)', fontSize: 16, marginBottom: 14 }}>
                📊 Intelligence for {intel.listingName}
              </div>
              <FinancialIntelligenceDashboard intel={intel} />
            </div>
          )}

          {summary && (
            <div style={{ marginTop: 22, borderTop: '1px solid var(--line)', paddingTop: 18 }}>
              <div style={{ fontFamily: 'Georgia, serif', fontWeight: 700, color: 'var(--navy)', fontSize: 16, marginBottom: 14 }}>
                📄 Comprehensive Financial Summary
              </div>
              <FinancialSummaryView report={summary} />
            </div>
          )}
        </div>
      </Card>

      {/* AUTO-GENERATE PIPELINE */}
      <Card style={{ marginBottom: 22 }}>
        <CardHeader title="Auto-Generation Pipeline" subtitle="Every upload automatically produces Recast, BOV, CIM and BLI — no manual steps" />
        <div style={{ padding: 18 }}>
          <AutoGenerationDashboard result={genResult} docs={files} onRunAgain={() => runPipeline()} running={running} />
        </div>
      </Card>

      {/* ONE-CLICK UPLOAD */}
      <Card style={{ marginBottom: 22 }}>
        <CardHeader title="One-Click Upload" subtitle="Drop all financial files — they're auto-tagged and processed into full documents" />
        <div style={{ padding: 18 }}>
          <OneClickUpload activeParentId={selectedParent} onGenerated={(r) => { setGenResult(r); toast(`Generated ${r.artifacts.length} document(s)`, 'success'); load() }} />
        </div>
      </Card>

      {/* Parent filter for uploads */}
      <Card style={{ marginBottom: 22 }}>
        <CardHeader title="Upload context" subtitle="Files uploaded below are attached to the selected deal / listing" />
        <div style={{ padding: 18 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', fontFamily: 'Georgia, serif' }}>Attach to</label>
            <select
              value={selectedParent}
              onChange={(e) => setSelectedParent(e.target.value)}
              className="select"
              style={{ flex: '1 1 300px', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', fontFamily: 'inherit', fontSize: 13.5 }}
            >
              <option value="">All deals / listings</option>
              {deals.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
            <button
              className="btn-primary"
              onClick={() => runPipeline(selectedParent)}
              disabled={running || !selectedParent}
              style={{ fontWeight: 700 }}
            >
              {running ? '⏳ Running…' : '🚀 Generate for selection'}
            </button>
          </div>
        </div>
      </Card>

      {/* UNIFIED DOCUMENT VIEW */}
      <Card>
        <CardHeader title="All Documents" subtitle="Uploaded sources + auto-generated Recast / BOV / CIM / BLI — download everything as ZIP" />
        <div style={{ padding: '4px 18px 18px' }}>
          <AllDocumentsView
            docs={files}
            onRefresh={load}
            onDelete={(f) => {
              const canDelete = isAdmin || !userId || f.uploaded_by === userId
              if (canDelete) setConfirmDelete(f)
              else toast('Only the uploader or a broker/admin can delete this file', 'info')
            }}
            dealTitle={dealTitle}
          />
        </div>
      </Card>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,20,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 'min(420px, 100%)', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 22 }}>🗑️</div>
            <h3 style={{ fontFamily: 'Georgia, serif', color: 'var(--navy)', margin: '10px 0 6px', fontSize: 19 }}>Delete file?</h3>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', margin: 0, lineHeight: 1.5, wordBreak: 'break-all' }}>
              <strong style={{ color: 'var(--text)' }}>{confirmDelete.file_name}</strong> will be permanently removed from storage and the database. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => onDelete(confirmDelete)} style={{ fontWeight: 700 }}>
                {deleting === confirmDelete.id ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
