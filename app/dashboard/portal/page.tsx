'use client'

import { useEffect, useState, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, CardHeader, LoadingState } from '@/components/ui'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { fetchClientAccess, grantClientAccess, revokeClientAccess, type ClientAccess } from '@/lib/clientPortal'
import { fetchDocumentGroups, setDocumentVisibility, type DocumentItem } from '@/lib/documents'
import { ensureDealForListing } from '@/lib/pipeline'
import { supabase } from '@/lib/supabase/client'

const APP_URL = typeof window !== 'undefined' ? window.location.origin : ''

interface ListingOption { id: string; business_name: string | null; status: string | null }

export default function PortalPage() {
  return (
    <AppShell active="Client Portal">
      <ToastProvider>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 26, color: 'var(--navy)', marginBottom: 4 }}>Client Portal</h1>
          <p style={{ color: 'var(--muted)', marginBottom: 20 }}>Grant clients private access to their deal — they get a secure link to track progress, upload documents, and message you.</p>
          <PortalManager />
        </div>
      </ToastProvider>
    </AppShell>
  )
}

function PortalManager() {
  const toast = useToast()
  const [listings, setListings] = useState<ListingOption[]>([])
  const [selected, setSelected] = useState('')  // selected LISTING id — a deal may not exist for it yet
  const [dealId, setDealId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [partyType, setPartyType] = useState<'seller' | 'buyer'>('seller')
  const [access, setAccess] = useState<ClientAccess[]>([])
  const [allGroups, setAllGroups] = useState<{ parentId: string; documents: DocumentItem[] }[]>([])
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string>('')

  const dealDocs = allGroups.find((g) => g.parentId === selected)?.documents.filter((d) => d.source === 'financial' || d.source === 'deal') || []

  // Documents are listing-scoped (financial_documents) or deal-scoped
  // (deal_documents) — neither requires a deal to exist for the listing to
  // show its uploaded/generated documents here, on purpose: a broker should
  // be able to see and pre-share a listing's financials before a formal deal
  // (LOI+) exists, and regardless of the listing's active/pending/sold status.
  const loadAccess = useCallback(async (listingId: string) => {
    const { data: deal } = await supabase.from('deals').select('id').eq('listing_id', listingId).maybeSingle()
    setDealId(deal?.id || null)
    setAccess(deal?.id ? await fetchClientAccess(deal.id) : [])
  }, [])

  const toggleDocVisibility = async (doc: DocumentItem, key: 'visibleToSeller' | 'visibleToBuyer') => {
    const patch = { [key]: !doc[key] } as { visibleToSeller?: boolean; visibleToBuyer?: boolean }
    setAllGroups((prev) => prev.map((g) => (
      g.parentId !== selected ? g : { ...g, documents: g.documents.map((d) => (d.id === doc.id ? { ...d, ...patch } : d)) }
    )))
    const result = await setDocumentVisibility(doc, patch)
    if (!result.success) toast(result.error || 'Could not update sharing', 'error')
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('listings').select('id, business_name, status').order('business_name')
      const rows = (data || []) as ListingOption[]
      setListings(rows)
      if (!selected && rows.length) { setSelected(rows[0].id); loadAccess(rows[0].id) }
    })()
    fetchDocumentGroups().then(setAllGroups).finally(() => setLoadingDocs(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const switchListing = (id: string) => { setSelected(id); loadAccess(id) }

  const handleGrant = async () => {
    if (!selected) { toast('Select a listing first', 'info'); return }
    if (!name.trim() || !email.trim() || !email.includes('@')) { toast('Enter client name + valid email', 'info'); return }
    setBusy(true)
    // A listing may not have a deal yet (deals only auto-create once a
    // listing goes active) — ensure one now instead of blocking the broker
    // from sharing documents on an earlier-stage listing.
    const deal = dealId ? { id: dealId } : await ensureDealForListing(selected)
    if (!deal) { setBusy(false); toast('Could not set up this listing for sharing', 'error'); return }
    setDealId(deal.id)
    const created = await grantClientAccess({ dealId: deal.id, clientName: name.trim(), clientEmail: email.trim(), partyType })
    setBusy(false)
    if (created) {
      toast(`${partyType === 'buyer' ? 'Buyer' : 'Seller'} access granted — share the link below`)
      setName(''); setEmail('')
      loadAccess(selected)
    } else toast('Could not grant access (run sql/client_portal_role.sql)', 'error')
  }

  const handleRevoke = async (id: string) => {
    const ok = await revokeClientAccess(id)
    if (ok) { toast('Access revoked'); loadAccess(selected) } else toast('Revoke failed', 'error')
  }

  const copyLink = (a: ClientAccess) => {
    const link = `${APP_URL}/portal/${a.deal_id}/${a.token}`
    if (navigator.clipboard) { navigator.clipboard.writeText(link).catch(() => {}) }
    setCopied(a.id)
    toast('Invite link copied')
    setTimeout(() => setCopied(''), 1800)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Grant access */}
      <Card>
        <CardHeader title="Grant client access" subtitle="Send a private portal link for a listing's deal" />
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="portal-grid" style={{ gap: 12 }}>
            <select value={selected} onChange={(e) => switchListing(e.target.value)} style={inputStyle}>
              <option value="">Select a listing…</option>
              {listings.map((l) => <option key={l.id} value={l.id}>{l.business_name || 'Untitled listing'} ({l.status})</option>)}
            </select>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Client name" style={inputStyle} />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Client email" style={inputStyle} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['seller', 'buyer'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPartyType(p)}
                style={{
                  padding: '7px 16px', borderRadius: 999, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  border: partyType === p ? '2px solid var(--gold-dark)' : '1px solid var(--line)',
                  background: partyType === p ? 'rgba(201,168,76,0.15)' : '#fff',
                  color: partyType === p ? 'var(--gold-dark)' : 'var(--muted)',
                }}
              >
                {p === 'seller' ? 'Seller' : 'Buyer'}
              </button>
            ))}
          </div>
          <button onClick={handleGrant} disabled={busy} style={{ alignSelf: 'flex-start', padding: '11px 22px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Granting…' : `Generate ${partyType} invite link`}
          </button>
        </div>
      </Card>

      {/* Deal documents — control what the seller/buyer portal links can see.
          Pulled from every financial (listing-scoped) and deal document for
          this listing, regardless of the listing's status (active, pending,
          sold) or whether a formal deal has been created yet. */}
      <Card>
        <CardHeader title="Financial & deal documents" subtitle="Choose what the seller and buyer can see through their portal link" />
        <div style={{ padding: 12 }}>
          {loadingDocs ? (
            <div style={{ padding: 16, color: 'var(--muted)', fontSize: 13.5 }}>Loading documents…</div>
          ) : dealDocs.length === 0 ? (
            <div style={{ padding: 16, color: 'var(--muted)', fontSize: 13.5 }}>No financial or deal documents uploaded for this listing yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dealDocs.map((d) => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.fileName || 'Document'}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{d.category || 'General'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {shareChip('Seller', d.visibleToSeller, () => toggleDocVisibility(d, 'visibleToSeller'))}
                    {shareChip('Buyer', d.visibleToBuyer, () => toggleDocVisibility(d, 'visibleToBuyer'))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Active access */}
      <Card>
        <CardHeader title="Active client access" subtitle="Shared portal links for this deal" />
        <div style={{ padding: 12 }}>
          {access.length === 0 ? (
            <div style={{ padding: 16, color: 'var(--muted)', fontSize: 13.5 }}>No clients granted access to this deal yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {access.filter((a) => a.status === 'active').map((a) => (
                <div key={a.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 12, border: '1px solid var(--line)', borderRadius: 8 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 19, background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>👤</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{a.client_name}</div>
                      <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: a.party_type === 'buyer' ? '#1d4ed8' : '#15803d', background: a.party_type === 'buyer' ? '#dbeafe' : '#dcfce7', padding: '2px 8px', borderRadius: 999 }}>
                        {a.party_type === 'buyer' ? 'Buyer' : 'Seller'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.client_email}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{APP_URL}/portal/{a.deal_id}/{a.token.slice(0, 18)}…</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => copyLink(a)} style={smallBtn(copied === a.id ? '#16a34a' : 'var(--navy)')}>{copied === a.id ? 'Copied ✓' : 'Copy link'}</button>
                    <button onClick={() => handleRevoke(a.id)} style={{ ...smallBtn('#dc2626'), color: '#dc2626', borderColor: '#fecaca' }}>Revoke</button>
                  </div>
                </div>
              ))}
              {access.length === 0 || !access.some((a) => a.status === 'active') ? null : (
                <div style={{ fontSize: 12, color: 'var(--muted-2)' }}>{access.filter((a) => a.status === 'active').length} active · {access.length} total</div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader title="How it works" />
        <div style={{ padding: '6px 18px 18px', fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6 }}>
          Clients open their unique link to view live deal status, milestones, shared documents, and a private message thread with you. They can also upload contracts and financials for due diligence — no account needed. Revoke a link anytime to cut off access.
        </div>
      </Card>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '11px 12px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 14, fontFamily: 'inherit', background: '#fff', color: 'var(--ink)',
}
const smallBtn = (color: string): React.CSSProperties => ({
  padding: '7px 12px', background: 'transparent', color, border: `1px solid ${color}`, borderRadius: 6, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
})
function shareChip(label: string, active: boolean, onClick: () => void): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '3px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
        border: `1px solid ${active ? '#16a34a' : 'var(--line)'}`,
        background: active ? '#dcfce7' : '#fff',
        color: active ? '#15803d' : 'var(--muted)',
      }}
    >
      {label}
    </button>
  )
}
