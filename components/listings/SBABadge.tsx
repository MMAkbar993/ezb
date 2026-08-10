'use client'

// ---------------------------------------------------------------------------
// SBABadge — SBA Qualified / Eligible badge (or "Optional" state).
// ---------------------------------------------------------------------------

export default function SBABadge({
  eligible,
  reviewed = false,
}: {
  eligible: boolean | null | undefined
  reviewed?: boolean
}) {
  if (eligible === true) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 20, padding: '3px 10px', fontSize: 11.5, fontWeight: 700, background: '#e8f7ee', color: '#16a34a', letterSpacing: 0.2 }}>
        🏦 SBA Eligible
      </span>
    )
  }
  if (eligible === false && reviewed) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 20, padding: '3px 10px', fontSize: 11.5, fontWeight: 700, background: '#fdf3e3', color: '#b45309', letterSpacing: 0.2 }}>
        🏦 Not SBA Eligible
      </span>
    )
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 20, padding: '3px 10px', fontSize: 11.5, fontWeight: 700, background: '#f3f3f6', color: '#7a7a8a', letterSpacing: 0.2 }}>
      🏦 SBA Optional
    </span>
  )
}
