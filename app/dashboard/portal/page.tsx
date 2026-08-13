'use client'

import { useEffect, useState, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, CardHeader, LoadingState } from '@/components/ui'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { fetchClientAccess, grantClientAccess, revokeClientAccess, type ClientAccess } from '@/lib/clientPortal'
import { supabase } from '@/lib/supabase/client'

const APP_URL = typeof window !== 'undefined' ? window.location.origin : ''

interface DealOption { id: string; title: string | null; status: string | null }

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
  const [deals, setDeals] = useState<DealOption[]>([])
  const [selected, setSelected] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [access, setAccess] = useState<ClientAccess[]>([])
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string>('')

  const loadAccess = useCallback(async (dealId: string) => {
    setAccess(await fetchClientAccess(dealId))
  }, [])

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('deals').select('id, title, status')
      setDeals((data || []) as DealOption[])
      if (!selected && data && data.length) {
        setSelected(data[0].id)
        loadAccess(data[0].id)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const switchDeal = (id: string) => { setSelected(id); loadAccess(id) }

  const handleGrant = async () => {
    if (!selected) { toast('Select a deal first', 'info'); return }
    if (!name.trim() || !email.trim() || !email.includes('@')) { toast('Enter client name + valid email', 'info'); return }
    setBusy(true)
    const created = await grantClientAccess({ dealId: selected, clientName: name.trim(), clientEmail: email.trim() })
    setBusy(false)
    if (created) {
      toast('Client access granted — share the link below')
      setName(''); setEmail('')
      loadAccess(selected)
    } else toast('Could not grant access (run sql/client_portal_schema.sql)', 'error')
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
        <CardHeader title="Grant client access" subtitle="Send a private portal link for a deal" />
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="portal-grid" style={{ gap: 12 }}>
            <select value={selected} onChange={(e) => switchDeal(e.target.value)} style={inputStyle}>
              <option value="">Select a deal…</option>
              {deals.map((d) => <option key={d.id} value={d.id}>{d.title || 'Untitled deal'} ({d.status})</option>)}
            </select>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Client name" style={inputStyle} />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Client email" style={inputStyle} />
          </div>
          <button onClick={handleGrant} disabled={busy} style={{ alignSelf: 'flex-start', padding: '11px 22px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Granting…' : 'Generate invite link'}
          </button>
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
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{a.client_name}</div>
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
