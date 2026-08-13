'use client'

// ---------------------------------------------------------------------------
// ListingGenerationPanel — real financial document generation, embedded
// directly in the guided listing workflow (Steps 3-6: Recast, BOV, CIM,
// BLI). Upload source documents (tax returns, P&L, bank/billing statements)
// and run the same Recast -> BOV -> CIM -> BLI pipeline used by the
// standalone Financial tab (lib/autoGenerate.ts via /api/financial/generate)
// — replaces the old per-step manual-entry / stub-JSON generators, which
// never actually read uploaded documents and produced empty BOV/CIM/BLI.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react'
import MultiFileDropzone from '@/components/financial/MultiFileDropzone'
import AutoGenerationDashboard from '@/components/financial/AutoGenerationDashboard'
import { fetchFinancialFiles, triggerGeneration, type FinancialDoc } from '@/lib/financialFiles'
import type { AutoGenerateResult } from '@/lib/autoGenerateTypes'

export default function ListingGenerationPanel({ listingId }: { listingId: string }) {
  const [docs, setDocs] = useState<FinancialDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<AutoGenerateResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const all = await fetchFinancialFiles()
      setDocs(all.filter((d) => d.listing_id === listingId))
    } catch {
      setDocs([])
    } finally {
      setLoading(false)
    }
  }, [listingId])

  useEffect(() => { load() }, [load])

  const generate = async () => {
    setRunning(true)
    setError(null)
    try {
      const data = await triggerGeneration(listingId, null)
      setResult(data)
      await load()
    } catch (e: any) {
      setError(e?.message || 'Generation failed')
    } finally {
      setRunning(false)
    }
  }

  const sourceDocs = docs.filter((d) => d.category !== 'generated_document')

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>
          Upload financial documents {sourceDocs.length > 0 && <span style={{ fontWeight: 400, color: 'var(--muted)' }}>({sourceDocs.length} uploaded)</span>}
        </div>
        <MultiFileDropzone parentId={listingId} dealId={null} listingId={listingId} onUploaded={load} />
      </div>

      <button
        onClick={generate}
        disabled={running || loading}
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)', color: '#fff', border: 'none', borderRadius: 9,
          padding: '12px 22px', fontWeight: 800, fontSize: 14, cursor: running ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          width: '100%', marginBottom: 18,
        }}
      >
        {running ? '⏳ Running Recast → BOV → CIM → BLI…' : '🚀 Generate All Documents'}
      </button>

      {error && (
        <div style={{ marginBottom: 14, padding: '11px 14px', background: '#fdeaea', border: '1px solid #dc262655', borderRadius: 10, fontSize: 13, color: 'var(--text)' }}>
          ✕ {error}
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</div>
      ) : (
        <AutoGenerationDashboard result={result} docs={docs} onRunAgain={generate} running={running} />
      )}
    </div>
  )
}
