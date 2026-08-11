'use client'

import { STATUS_STYLE } from '@/lib/workflow'

// ---------------------------------------------------------------------------
// StatusBadge — color-coded listing status badge.
// ---------------------------------------------------------------------------

export const NICE_STATUS: Record<string, string> = {
  draft: 'Draft', active: 'Active', under_loi: 'Under LOI',
  closed: 'Closed', withdrawn: 'Withdrawn',
}

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
      {NICE_STATUS[status || 'draft'] || 'Unknown'}
    </span>
  )
}
