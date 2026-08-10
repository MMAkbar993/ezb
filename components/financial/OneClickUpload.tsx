'use client'

// =============================================================================
// OneClickUpload — single upload + "everything generated" flow.
// -----------------------------------------------------------------------------
// A unified entry point: pick a listing/deal, upload all financial files in one
// action, then auto-trigger the Recast -> BOV -> CIM -> BLI pipeline. All
// generated documents land in the financial files folder automatically.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import MultiFileDropzone from '@/components/financial/MultiFileDropzone'
import { fetchDealOptions, getAccessToken } from '@/lib/financialFiles'
import type { AutoGenerateResult } from '@/lib/autoGenerateTypes'

interface Option {
  id: string
  title: string
}

interface Props {
  onGenerated: (result: AutoGenerateResult) => void
  activeParentId: string
}

export default function OneClickUpload({ onGenerated, activeParentId }: Props) {
  const [options, setOptions] = useState<Option[]>([])
  const [selected, setSelected] = useState('')
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadOptions = useCallback(async () => {
    try {
      const d = await fetchDealOptions()
      setOptions(d)
      // Default to the active parent filter, else the first option
      if (!selected) {
        const match = d.find((o) => o.id === activeParentId)
        setSelected(match ? match.id : (d[0]?.id ?? ''))
      }
    } catch {
      setOptions([])
    }
  }, [selected, activeParentId])

  useEffect(() => { loadOptions() }, [loadOptions])

  const selectedTitle = useMemo(() => {
    const o = options.find((x) => x.id === selected)
    return o?.title || ''
  }, [options, selected])

  const generate = async () => {
    if (!selected || running) return
    setRunning(true)
    setStatus('Running Recast → BOV → CIM → BLI…')
    setError(null)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('You need to be signed in to generate documents.')
      const res = await fetch('/api/financial/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ listingId: selected }),
      })
      const data = (await res.json()) as AutoGenerateResult
      if (!data.ok) {
        throw new Error(data.error || 'Generation failed')
      }
      setStatus(`Done — ${data.artifacts.length} document(s) generated`)
      onGenerated(data)
    } catch (e: any) {
      setError(e?.message || 'Generation failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div>
      {/* Listing picker */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', fontFamily: 'Georgia, serif' }}>
          Generate for
        </label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="select"
          style={{ flex: '1 1 280px', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', fontFamily: 'inherit', fontSize: 13.5, background: '#fff' }}
        >
          <option value="">— Select a listing / deal —</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.title}</option>
          ))}
        </select>
      </div>

      {/* Single upload surface */}
      <MultiFileDropzone
        parentId={selected || 'general'}
        dealId={selected || null}
        listingId={selected || null}
        onUploaded={() => {}}
      />

      {/* Auto-generate all documents */}
      <div
        style={{
          marginTop: 16, padding: '16px 18px', borderRadius: 12,
          background: 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)',
          color: '#fff', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14,
        }}
      >
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 700, fontFamily: 'Georgia, serif', fontSize: 15.5, display: 'flex', alignItems: 'center', gap: 8 }}>
            ⚡ Auto-Generate Everything
          </div>
          <div style={{ fontSize: 12.5, color: '#c9c9d8', marginTop: 3 }}>
            Recast P&amp;L · BOV (10+ pg) · CIM (25+ sections) · BLI — all in one click
            {selectedTitle ? ` for “${selectedTitle}”` : ''}.
          </div>
        </div>
        <button
          onClick={generate}
          disabled={!selected || running}
          style={{
            background: 'var(--gold)', color: 'var(--navy)', border: 'none', borderRadius: 9,
            padding: '11px 20px', fontWeight: 800, fontSize: 14, cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {running ? '⏳ Generating…' : '🚀 Generate All Documents'}
        </button>
      </div>

      {/* Status / error */}
      {status && !error && (
        <div style={{ marginTop: 12, padding: '11px 14px', background: '#e8f7ee', border: '1px solid #16a34a55', borderRadius: 10, fontSize: 13, color: 'var(--text)', fontFamily: 'Georgia, serif' }}>
          ✓ {status}
        </div>
      )}
      {error && (
        <div style={{ marginTop: 12, padding: '11px 14px', background: '#fdeaea', border: '1px solid #dc262655', borderRadius: 10, fontSize: 13, color: 'var(--text)', fontFamily: 'Georgia, serif' }}>
          ✕ {error}
        </div>
      )}
    </div>
  )
}
