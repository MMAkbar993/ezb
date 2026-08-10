'use client'

import { WORKFLOW_STEPS } from '@/lib/workflow'

// ---------------------------------------------------------------------------
// WorkflowDashboard — visual 10-step progress tracker.
// Shows completed / current / locked steps as a horizontal stepper (vertical
// on mobile). Clicking a completed or unlocked step navigates to it.
// ---------------------------------------------------------------------------

export default function WorkflowDashboard({
  currentStep,
  completedSteps,
  onNavigate,
  listingId,
}: {
  currentStep: number
  completedSteps?: number[]
  onNavigate?: (step: number) => void
  listingId?: string
}) {
  const done = new Set((completedSteps || []).map(Number))
  const current = Math.max(1, Math.min(10, currentStep))
  const pct = Math.round((done.size / 10) * 100)

  return (
    <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', fontFamily: 'Georgia, serif' }}>Listing Workflow</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{done.size} of 10 steps complete</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 160, height: 6, background: 'var(--paper)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, var(--navy), #c9a84c)', transition: 'width 0.4s' }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>{pct}%</span>
        </div>
      </div>

      {/* Stepper */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {WORKFLOW_STEPS.map((s) => {
          const isDone = done.has(s.step)
          const isCurrent = s.step === current && !isDone
          const interactive = isDone || isCurrent
          return (
            <button
              key={s.step}
              disabled={!interactive || !onNavigate}
              onClick={() => onNavigate?.(s.step)}
              title={`${s.step}. ${s.label} — ${s.desc}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                borderRadius: 20, border: `1.5px solid ${isDone ? '#22c55e' : isCurrent ? 'var(--gold)' : 'var(--line)'}`,
                background: isDone ? '#e8f7ee' : isCurrent ? 'rgba(201,168,76,0.12)' : '#fafafc',
                color: isDone ? '#15803d' : isCurrent ? 'var(--navy)' : 'var(--muted)',
                cursor: interactive && onNavigate ? 'pointer' : 'default',
                fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
                opacity: isDone || isCurrent ? 1 : 0.75,
              }}
            >
              <span style={{ fontSize: 14 }}>{isDone ? '✓' : s.icon}</span>
              {s.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
