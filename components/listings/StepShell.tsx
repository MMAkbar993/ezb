'use client'

import type { ReactNode, CSSProperties } from 'react'
import StatusBadge from '@/components/listings/StatusBadge'

// ---------------------------------------------------------------------------
// Shared scaffolding for the 10 workflow steps — consistent navy/gold layout
// with an icon header, description, children content, and Next/Back/Complete.
// ---------------------------------------------------------------------------

export const stepField: CSSProperties = {
  width: '100%', padding: '11px 12px', borderRadius: 8, border: '1px solid var(--line)',
  fontSize: 14, fontFamily: 'inherit', background: '#fff', color: 'var(--ink)', boxSizing: 'border-box',
}
export const stepLabel: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 14,
}
export const stepBtn = (primary = true): CSSProperties => ({
  padding: '11px 22px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14, fontFamily: 'inherit',
  background: primary ? 'var(--navy)' : 'transparent', color: primary ? '#fff' : 'var(--navy)',
  border: primary ? 'none' : '1px solid var(--gold)',
})

export function StepShell({
  step, title, description, children, status, onBack, onNext, nextDisabled, nextLabel = 'Save & continue',
}: {
  step: number
  title: string
  description: string
  children: ReactNode
  status?: string | null
  onBack?: () => void
  onNext?: () => void
  nextDisabled?: boolean
  nextLabel?: string
}) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, background: 'var(--paper)' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--navy)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, fontFamily: 'Georgia, serif', flexShrink: 0 }}>
            {step}
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--gold-dark)', fontWeight: 700, marginBottom: 2 }}>Step {step} of 10</div>
            <h3 style={{ margin: 0, fontSize: 19, fontFamily: 'Georgia, serif', color: 'var(--navy)' }}>{title}</h3>
            <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--muted)' }}>{description}</p>
          </div>
        </div>
        {status && <StatusBadge status={status} />}
      </div>

      {/* Body */}
      <div style={{ padding: 22 }}>{children}</div>

      {/* Footer */}
      <div style={{ padding: '14px 22px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        {onBack ? (
          <button onClick={onBack} style={stepBtn(false)}>← Back</button>
        ) : <span />}
        {onNext && (
          <button onClick={onNext} disabled={nextDisabled} style={{ ...stepBtn(true), opacity: nextDisabled ? 0.5 : 1, cursor: nextDisabled ? 'not-allowed' : 'pointer' }}>
            {nextLabel} →
          </button>
        )}
      </div>
    </div>
  )
}
