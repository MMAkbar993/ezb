'use client'

import { STATUS_STYLE } from '@/lib/workflow'

// ---------------------------------------------------------------------------
// StatusBadge — color-coded listing status badge. Labels come from
// STATUS_STYLE (lib/workflow.ts) — the single source of truth for listing
// status display text, so it never drifts out of sync across the app.
// ---------------------------------------------------------------------------

export default function StatusBadge({ status, size = 'md' }: { status: string | null | undefined; size?: 'sm' | 'md' | 'lg' }) {
  const s = status || 'draft'
  const style = STATUS_STYLE[s] || STATUS_STYLE.draft
  const dims = size === 'sm' ? { padding: '2px 8px', fontSize: 11 } : size === 'lg' ? { padding: '6px 14px', fontSize: 13.5 } : { padding: '4px 10px', fontSize: 12 }
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 20, fontWeight: 700,
        color: style.color, background: style.bg, whiteSpace: 'nowrap', letterSpacing: 0.2,
        ...dims,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 3, background: style.color, display: 'inline-block' }} />
      {style.label}
    </span>
  )
}
