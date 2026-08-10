'use client'

// =============================================================================
// Supabase Realtime helper + React hooks
// -----------------------------------------------------------------------------
// Wraps Supabase Realtime channels for live data updates across the platform:
//   * useRealtimeQuery — subscribe to table changes and re-run a fetch
//   * useRealtimeChannel — low-level subscription with a callback
//   * liveNotificationStore — a tiny pub/sub for toast-style notifications
//
// IMPORTANT: Realtime requires Postgres changes to be enabled on the tables in
// Supabase (Database → Replication → enable for deals, listings, seller_leads,
// buyer_leads, social_posts, etc.). The hook degrades gracefully (no-ops) when
// the channel errors, so the UI still works without it.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export type RealtimeEvent =
  | 'INSERT'
  | 'UPDATE'
  | 'DELETE'
  | '*'

/** A registry of listeners so multiple components share one channel. */
const listeners = new Map<string, Set<(payload: any) => void>>()
const channels = new Map<string, any>()

/** Subscribe (or attach) a listener to a table's realtime changes. */
export function subscribeToTable(
  table: string,
  filter?: Record<string, string>,
  onEvent?: (payload: { evt: RealtimeEvent; table: string; newRow?: any; oldRow?: any }) => void,
): () => void {
  const key = filter ? `${table}:${JSON.stringify(filter)}` : table
  const cbSet = listeners.get(key) || new Set()
  listeners.set(key, cbSet)
  const wrapped = (payload: any) => {
    const evt = (String(payload?.eventType || '').toUpperCase()) as RealtimeEvent
    onEvent?.({ evt, table, newRow: payload?.new, oldRow: payload?.old })
  }
  cbSet.add(wrapped)

  // Open the shared channel once.
  if (!channels.has(key)) {
    let query = supabase.channel(`realtime-${key}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, ...filter }, (payload) => {
        const evt = String(payload.eventType || '').toUpperCase() as RealtimeEvent
        const set = listeners.get(key)
        set?.forEach((fn) => fn({ evt, table, newRow: payload.new, oldRow: payload.old }))
      })
      .subscribe((status: any) => {
        // If the table isn't realtime-enabled, we get an error or ignored.
        if (status === 'SUBSCRIBED') return
      })
    channels.set(key, query)
  }

  return () => {
    cbSet.delete(wrapped)
    if (cbSet.size === 0) {
      const ch = channels.get(key)
      if (ch) {
        supabase.removeChannel(ch).catch(() => {})
        channels.delete(key)
      }
      listeners.delete(key)
    }
  }
}

/**
 * useRealtimeQuery — subscribes to a table and re-fetches when data changes.
 *   const { items, loading, refetch } = useRealtimeQuery('deals', (c) => c.select('*'))
 */
export function useRealtimeQuery<T = any>(
  table: string,
  buildQuery?: (q: any) => any,
  deps: any[] = [],
) {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const buildRef = useRef(buildQuery)
  buildRef.current = buildQuery

  const refetch = useCallback(async () => {
    let q: any = supabase.from(table)
    if (buildRef.current) q = buildRef.current(q)
    const { data, error } = await q
    if (!error) setItems((data as T[]) || [])
    setLoading(false)
  }, [table])

  useEffect(() => {
    setLoading(true)
    refetch()
    const unsub = subscribeToTable(
      table,
      undefined,
      () => { refetch() },
    )
    return () => { unsub() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, ...deps])

  return { items, loading, refetch }
}

/**
 * useRealtimeListener — invoke callback whenever a table changes (optionally filtered).
 */
export function useRealtimeListener(
  table: string,
  onEvent: (payload: { evt: RealtimeEvent; table: string; newRow?: any; oldRow?: any }) => void,
  filter?: Record<string, string>,
) {
  const cbRef = useRef(onEvent)
  cbRef.current = onEvent
  useEffect(() => {
    return subscribeToTable(table, filter, (p) => cbRef.current(p))
  }, [table, filter && JSON.stringify(filter)])
}

// --- Live notification pub/sub ----------------------------------------------
/** A lightweight store for toast-style live notifications. */
type Notif = { id: number; title: string; detail?: string; table: string; evt: RealtimeEvent }
const notifListeners = new Set<(n: Notif) => void>()
let notifId = 0

/** Register a handler for live notifications. Returns an unsubscribe fn. */
export function onLiveNotification(cb: (n: Notif) => void): () => void {
  notifListeners.add(cb)
  return () => notifListeners.delete(cb)
}

/** Subscribe to common business tables. Hook used in the dashboard shell. */
export function useLiveNotifications(onNotif?: (n: Notif) => void) {
  useEffect(() => {
    const tables = ['deals', 'seller_leads', 'buyer_leads', 'listings', 'social_posts']
    let unsubs: (() => void)[] = []
    const handler = (payload: { evt: RealtimeEvent; table: string; newRow?: any }) => {
      if (payload.evt === '*' || payload.evt === 'INSERT') {
        const n: Notif = { id: ++notifId, title: labelFor(payload.table), detail: detailFor(payload), table: payload.table, evt: payload.evt }
        notifListeners.forEach((fn) => fn(n))
        onNotif?.(n)
      }
    }
    tables.forEach((t) => unsubs.push(subscribeToTable(t, undefined, handler)))
    return () => unsubs.forEach((u) => u())
  }, [])
}

function labelFor(table: string): string {
  const map: Record<string, string> = {
    deals: 'New deal activity', listings: 'Listing updated',
    seller_leads: 'New seller lead', buyer_leads: 'New buyer lead',
    social_posts: 'Social post update',
  }
  return map[table] || `Update in ${table}`
}

function detailFor(p: any): string {
  const r = p.newRow || {}
  return r.business_name || r.title || r.name || r.id || ''
}

// Hook to consume live notifications in a component.
export function useLiveNotificationFeed(cb?: (n: Notif) => void): Notif[] {
  const [feed, setFeed] = useState<Notif[]>([])
  useEffect(() => {
    const un = onLiveNotification((n) => {
      setFeed((prev) => [n, ...prev].slice(0, 20))
      cb?.(n)
    })
    return un
  }, [])
  return feed
}
