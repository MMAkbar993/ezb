'use client'

// =============================================================================
// /dashboard/financial — ONE simple financial tab.
// -----------------------------------------------------------------------------
// Replaces the separate Financial Files / Financial Recast / CIM Generator /
// BOV Generator tabs and their manual entry forms (add-backs, fiscal-year
// rows, OCR-pending busywork). Pick a listing, drop in any financial
// documents (tax returns, P&L, bank statements, balance sheets — anything),
// click Generate — Claude extracts the numbers, the deterministic engine
// recasts them, and Recast/BOV/CIM/BLI come out the other end, linked to
// that listing. No manual data entry.
// =============================================================================

import { useCallback, useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, CardHeader, LoadingState } from '@/components/ui'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import OneClickUpload from '@/components/financial/OneClickUpload'
import AutoGenerationDashboard from '@/components/financial/AutoGenerationDashboard'
import type { AutoGenerateResult } from '@/lib/autoGenerateTypes'
import { FinancialDoc, fetchFinancialFiles, type DealOption } from '@/lib/financialFiles'

export default function FinancialPage() {
  return (
    <AppShell active="Financial">
      <ToastProvider>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <FinancialDashboard />
        </div>
      </ToastProvider>
    </AppShell>
  )
}

function FinancialDashboard() {
  const toast = useToast()
  const [files, setFiles] = useState<FinancialDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [genResult, setGenResult] = useState<AutoGenerateResult | null>(null)
  const [running, setRunning] = useState(false)
  const [activeOption, setActiveOption] = useState<DealOption | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setFiles(await fetchFinancialFiles())
    } catch (e: any) {
      toast(e?.message || 'Failed to load', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingState label="Loading…" />

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 27, color: 'var(--navy)', margin: 0 }}>Financial</h1>
        <p style={{ color: 'var(--muted)', margin: '4px 0 0', fontSize: 14 }}>
          Pick a listing, drop in any financial documents, and click Generate. Claude reads the numbers, the recast
          engine normalizes them, and Recast, BOV, CIM &amp; BLI come out automatically — linked to that listing.
        </p>
      </div>

      <Card style={{ marginBottom: 22 }}>
        <div style={{ padding: 18 }}>
          <OneClickUpload
            activeParentId=""
            onGenerated={(r) => { setGenResult(r); setRunning(false); toast(`Generated ${r.artifacts.length} document(s)`, 'success'); load() }}
            onSelectionChange={setActiveOption}
          />
        </div>
      </Card>

      {(() => {
        if (!activeOption) return null
        const scoped = files.filter((f) => f.listing_id === activeOption.listingId)
        const resultForActive = genResult?.listingId === activeOption.listingId ? genResult : null
        if (!resultForActive && !scoped.some((f) => f.category === 'generated_document')) return null
        return (
          <Card>
            <CardHeader title="Results" subtitle={`Recast, BOV, CIM & BLI for "${activeOption.title}"`} />
            <div style={{ padding: 18 }}>
              <AutoGenerationDashboard result={resultForActive} docs={scoped} onRunAgain={() => {}} running={running} />
            </div>
          </Card>
        )
      })()}
    </div>
  )
}
