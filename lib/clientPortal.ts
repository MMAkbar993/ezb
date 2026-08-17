'use client'

// =============================================================================
// Client Portal service
// -----------------------------------------------------------------------------
// Token-gated access for external business clients (no broker-account login
// required). The client receives a private URL /portal/<dealId>/<token>; the
// token is validated SERVER-SIDE in app/api/portal/route.ts (service role,
// never exposed to the browser).
//
// This module provides:
//   * Broker-side management (anon client, RLS): grant/revoke/list access
//   * makeToken() — deterministic-ish token generator for shareable links
//   * Client-side API wrappers that call /api/portal (GET/POST)
// =============================================================================

import { supabase } from '@/lib/supabase/client'

// -- Token helper ------------------------------------------------------------
export function makeToken(dealId: string, email: string): string {
  try {
    const raw = `${dealId}:${email}:${Date.now()}`
    if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(raw))).replace(/[^a-zA-Z0-9]/g, '').slice(0, 40)
    return raw.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40)
  } catch {
    return `${dealId}${email}`.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40)
  }
}

// -- Types -------------------------------------------------------------------
export interface ClientAccess {
  id: string
  deal_id: string
  client_name: string
  client_email: string
  token: string
  status: string
  party_type: 'seller' | 'buyer'
  created_at?: string
}

export interface PortalMessageUpdate {
  id?: string
  deal_id: string
  author: 'client' | 'broker'
  author_name?: string
  body: string
  created_at?: string
}

export interface PortalMilestone {
  title?: string
  date?: string
  status?: string
  detail?: string
}

export interface PortalDeal {
  id: string
  title: string
  status: string
  purchase_price: number | null
  created_at?: string
  updated_at?: string
  listing_id?: string | null
}

export interface PortalSnapshot {
  ok: boolean
  clientName: string
  partyType?: 'seller' | 'buyer'
  deal: PortalDeal | null
  documents: any[]
  milestones: PortalMilestone[]
  messages: PortalMessageUpdate[]
}

// -- Broker-side management (anon client, RLS) --------------------------------
export async function grantClientAccess(input: { dealId: string; clientName: string; clientEmail: string; partyType?: 'seller' | 'buyer' }): Promise<ClientAccess | null> {
  try {
    const token = makeToken(input.dealId, input.clientEmail)
    const { data, error } = await supabase.from('client_portal_access').insert({
      deal_id: input.dealId, client_name: input.clientName, client_email: input.clientEmail, token,
      party_type: input.partyType || 'seller',
    }).select().single()
    if (error) { console.error('[portal] grant', error); return null }
    return data as unknown as ClientAccess
  } catch {
    return null
  }
}

export async function fetchClientAccess(dealId: string): Promise<ClientAccess[]> {
  try {
    const { data } = await supabase.from('client_portal_access').select('*').eq('deal_id', dealId).order('created_at', { ascending: false })
    return (data || []) as unknown as ClientAccess[]
  } catch {
    return []
  }
}

export async function revokeClientAccess(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('client_portal_access').update({ status: 'revoked' }).eq('id', id)
    return !error
  } catch {
    return false
  }
}

// -- Client-side API wrappers (token-authenticated, server-validated) --------
/** Load the full portal snapshot for a deal+token pair. */
export async function fetchPortalSnapshot(dealId: string, token: string): Promise<PortalSnapshot | null> {
  try {
    const res = await fetch(`/api/portal?dealId=${encodeURIComponent(dealId)}&token=${encodeURIComponent(token)}`, { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as PortalSnapshot
  } catch {
    return null
  }
}

/** Delete a document the client themself uploaded (server enforces ownership). */
export async function deletePortalDocument(dealId: string, token: string, docId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId, token, action: 'delete', docId }),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Send a message as the client (server-validated with the token). */
export async function sendPortalMessage(dealId: string, token: string, body: string, clientName: string): Promise<PortalMessageUpdate | null> {
  try {
    const res = await fetch('/api/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId, token, action: 'message', body, clientName }),
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.message as PortalMessageUpdate
  } catch {
    return null
  }
}
