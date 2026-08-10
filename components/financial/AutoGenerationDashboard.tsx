'use client'

// =============================================================================
// AutoGenerationDashboard — live status of the one-click auto-generation
// pipeline (Recast -> BOV -> CIM -> BLI). Shows a step tracker, the generated
// artifacts produced by the latest run, and per-document status pills.
// =============================================================================

import { useMemo, useState } from 'react'
import { PIPELINE_STEPS, type AutoGenerateResult } from '@/lib/autoGenerateTypes'
import type { FinancialDoc, FinancialStatus } from '@/lib/financialFiles'
import { StatusPill } from '@/components/financial/FilesUI'

type StageState = 'pending' | 'running' | 'done' | 'failed'

interface Props {
  /** Latest pipeline result (after a One-Click run). */
  result: AutoGenerateResult | null
  /** All financial docs to reflect overall completion + failure state. */
  docs: FinancialDoc[]
  onRunAgain: () => void
  running: boolean
}

export default function AutoGenerationDashboard({ result, docs, onRunAgain, running }: Props) {
  const [selected, setSelected] = useState<string | null>(result?.artifacts[0]?.docId ?? null)

  // Derive per-stage state from the generated documents present in `docs`.
  const stages = useMemo(() => {
    const byStatus = new Map<FinancialStatus, number>()
    for (const d of docs) {
      if (d.category !== 'generated_document') continue
      byStatus.set(d.status, (byStatus.get(d.status) || 0) + 1)
    }
    const has = (s: FinancialStatus) => (byStatus.get(s) || 0) > 0
    const failed = docs.some((d) => d.status === 'failed')

    return PIPELINE_STEPS.map((step, i) => {
      let state: StageState = 'pending'
      if (has(step.status)) state = 'done'
      else if (failed || (result && (result.notes || []).some((n) => n.includes(step.stage)))) state = 'failed'
      else if (result && result.artifacts.some((a) => a.stage === step.stage)) state = 'done'
      return { ...step, state, has: has(step.status) }
    })
  }, [docs, result])

  const completion = useMemo(() => {
    const done = stages.filter((s) => s.state === 'done').length
    return { done, total: stages.length, pct: Math.round((done / stages.length) * 100) }
  }, [stages])

  // Artifacts to preview/download
  const artifacts = result?.artifacts || []
  const selectedArtifact = artifacts.find((a) => a.docId === selected) || artifacts[0] || null

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
      {/* Header */}
      <div style={{ padding: '16px 18px', background: 'var(--navy)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontFamily: 'Georgia, serif', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            ⚙️ Auto-Generation Pipeline
          </div>
          <div style={{ fontSize: 12.5, color: '#c9c9d8', marginTop: 2 }}>
            {result ? `Latest run for “${result.listingName}”` : 'No run yet — use Upload & Generate to start.'}
          </div>
        </div>
        <button
          onClick={onRunAgain}
          disabled={running}
          style={{
            background: 'var(--gold)', color: 'var(--navy)', border: 'none', borderRadius: 8,
            padding: '9px 16px', fontWeight: 800, fontSize: 13, cursor: running ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          }}
        >
          {running ? '⏳ Running…' : '↻ Run Pipeline'}
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ padding: '14px 18px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--muted)', marginBottom: 4, fontFamily: 'Georgia, serif' }}>
          <span>Pipeline completion</span>
          <span style={{ fontWeight: 700, color: 'var(--navy)' }}>{completion.done}/{completion.total} · {completion.pct}%</span>
        </div>
        <div style={{ height: 8, background: 'var(--line)', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${completion.pct}%`, background: 'linear-gradient(90deg, #a8872f, #c9a84c)', transition: 'width 0.4s' }} />
        </div>
      </div>

      {/* Step tracker */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, padding: 16 }}>
        {stages.map((step) => (
          <div
            key={step.stage}
            style={{
              border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px',
              background: step.state === 'done' ? '#e8f7ee' : step.state === 'failed' ? '#fdeaea' : '#faf9f5',
              borderLeft: `4px solid ${step.state === 'done' ? '#16a34a' : step.state === 'failed' ? '#dc2626' : '#a8872f'}`,
              minHeight: 84, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontFamily: 'Georgia, serif', fontSize: 13.5, color: 'var(--navy)' }}>
              <span style={{ fontSize: 16 }}>{step.icon}</span>
              <span>
                {step.stage.toUpperCase()}
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>{step.label.split(' (')[0]}</div>
            <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: step.state === 'done' ? '#16a34a' : step.state === 'failed' ? '#dc2626' : '#a8872f' }}>
              {step.state === 'done' ? '✓ Complete' : step.state === 'failed' ? '✕ Failed' : step.has ? '✓ Done' : '○ Pending'}
            </div>
          </div>
        ))}
      </div>

      {/* Artifacts detail */}
      {artifacts.length > 0 && (
        <div style={{ padding: '0 18px 18px' }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--gold-dark)', fontWeight: 700, fontFamily: 'Georgia, serif', marginBottom: 10 }}>
            Generated Documents
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {artifacts.map((a) => (
              <a
                key={a.docId}
                href={a.publicUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => setSelected(a.docId)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                  border: '1px solid var(--line)', borderRadius: 10, textDecoration: 'none',
                  background: selectedArtifact?.docId === a.docId ? 'rgba(201,168,76,0.10)' : '#fff',
                  borderLeft: `4px solid ${a.stage === 'recast' ? '#a8872f' : a.stage === 'bov' ? '#0f3460' : a.stage === 'cim' ? '#1a3a8f' : '#0e7490'}`,
                }}
              >
                <span style={{ fontSize: 24 }}>{PIPELINE_STEPS.find((s) => s.stage === a.stage)?.icon || '📄'}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 13.5, fontFamily: 'Georgia, serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={a.fileName}>
                    {a.title.split(' — ')[1] || a.fileName}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{a.statusLabel} · ⬇️ open PDF</div>
                </div>
              </a>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            {PIPELINE_STEPS.map((s) => {
              const art = artifacts.find((a) => a.stage === s.stage)
              return art ? (
                <StatusPill key={s.stage} status={art.status as FinancialStatus} />
              ) : null
            })}
          </div>
        </div>
      )}
    </div>
  )
}
