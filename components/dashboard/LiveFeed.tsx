'use client'

// ---------------------------------------------------------------------------
// LiveFeed — a collapsible "live" indicator + recent realtime notifications.
// Uses the shared useLiveNotificationFeed hook from lib/realtime.ts.
// ---------------------------------------------------------------------------

import { useState } from 'react'
import { useLiveNotificationFeed, type RealtimeEvent } from '@/lib/realtime'
import { useToast } from '@/components/ui/Toast'

const KIND_ICON: Record<string, string> = {
  deals: '🤝', listings: '🏢', seller_leads: '🎯', buyer_leads: '🎯', social_posts: '📣',
}

export default function LiveFeed() {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const feed = useLiveNotificationFeed((n) => {
    toast(`Live: ${n.title}${n.detail ? ` — ${n.detail}` : ''}`, 'info')
  })

  const count = feed.filter((n) => n.id).length
  const active = feed.length > 0

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: active ? 'rgba(34,197,94,0.12)' : 'var(--card-bg)',
          color: active ? '#16a34a' : 'var(--ink)',
          border: `1px solid ${active ? '#86efac' : 'var(--line)'}`,
          borderRadius: 20, padding: '6px 14px', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 4, background: active ? '#22c55e' : '#9ca3af', display: 'inline-block', animation: active ? 'live-pulse 1.6s infinite' : undefined }} />
        Live
        {count > 0 && <span style={{ background: 'var(--gold)', color: '#0b1f3a', borderRadius: 10, padding: '0 7px', fontSize: 11 }}>{count}</span>}
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 320,
          background: '#fff', border: '1px solid var(--line)', borderRadius: 10,
          boxShadow: '0 10px 30px rgba(0,0,0,0.12)', zIndex: 40, overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', fontWeight: 600, fontSize: 13, color: 'var(--navy)', background: 'var(--paper)' }}>
            Activity feed
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {feed.length === 0 ? (
              <div style={{ padding: '22px 16px', color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>
                Waiting for live updates…
                <div style={{ fontSize: 12, marginTop: 4 }}>Realtime needs to be enabled on your tables (see Supabase → Replication).</div>
              </div>
            ) : (
              feed.map((n) => (
                <div key={n.id} style={{ display: 'flex', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--line)', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 16 }}>{KIND_ICON[n.table] || '🔔'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{n.title}</div>
                    {n.detail && <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.detail}</div>}
                    <div style={{ fontSize: 11, color: 'var(--muted-2)', textTransform: 'capitalize' }}>{String(n.evt).toLowerCase()}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
