'use client'

// ---------------------------------------------------------------------------
// TrialStatusBadge — compact status pill for an agency's trial/plan:
//   Green  — Active (X days left)
//   Yellow — Ending soon (≤3 days)
//   Red    — Expired / locked
//   Grey   — Not on trial / paid
// Pure presentational from a TrialState. Used in the dashboard banner and the
// admin agency list.
// ---------------------------------------------------------------------------

import type { TrialState } from '@/lib/trial'

export default function TrialStatusBadge({ state, size = 'md' }: { state: TrialState; size?: 'sm' | 'md' }) {
  const cfg = badgeConfig(state)
  const padding = size === 'sm' ? '3px 8px' : '5px 11px'
  const fontSize = size === 'sm' ? 10.5 : 12

  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding,
        borderRadius: 99, fontWeight: 700, fontSize, lineHeight: 1,
        background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  )
}

interface BadgeCfg { label: string; bg: string; color: string; border: string; dot: string }

function badgeConfig(state: TrialState): BadgeCfg {
  switch (state.status) {
    case 'active':
      return { label: `Active · ${state.daysRemaining}d left`, bg: '#e6f4ea', color: '#1e7e34', border: '#b7e1c3', dot: '#1e7e34' }
    case 'ending_soon':
      return { label: `Ending soon · ${state.daysRemaining}d left`, bg: '#fef7e0', color: '#9a6a00', border: '#f0e0a8', dot: '#d9a400' }
    case 'expired':
      return { label: 'Expired', bg: '#fdecec', color: '#b00020', border: '#f5c6c6', dot: '#b00020' }
    case 'grace':
      return { label: 'Grace (read-only)', bg: '#fef7e0', color: '#9a6a00', border: '#f0e0a8', dot: '#d9a400' }
    case 'locked':
      return { label: 'Locked', bg: '#fdecec', color: '#b00020', border: '#f5c6c6', dot: '#b00020' }
    case 'paid':
      return { label: 'Paid · ' + planName(state.planType), bg: '#e6f4ea', color: '#1e7e34', border: '#b7e1c3', dot: '#1e7e34' }
    default:
      return { label: 'Not on trial', bg: '#eef0f2', color: '#5f6368', border: '#d9dce0', dot: '#9aa0a6' }
  }
}

function planName(p: string): string {
  const map: Record<string, string> = { starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise', free: 'Free' }
  return map[p] || p
}
