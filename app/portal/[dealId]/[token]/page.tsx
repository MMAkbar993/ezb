'use client'

// ---------------------------------------------------------------------------
// /portal/[dealId]/[token] — Client-facing portal.
// Token-gated: the client accesses their deal's progress, milestones,
// documents, uploads DD docs, and messages their broker — no login needed.
// Branded navy/gold, client-friendly (not the broker AppShell).
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  fetchPortalSnapshot, sendPortalMessage,
  type PortalDeal, type PortalMilestone, type PortalMessageUpdate,
} from '@/lib/clientPortal'
import { ToastProvider, useToast } from '@/components/ui/Toast'

const STAGE_LABEL: Record<string, { label: string; color: string }> = {
  new: { label: 'New', color: '#3b82f6' },
  qualified: { label: 'Qualified', color: '#8b5cf6' },
  due_diligence: { label: 'Due Diligence', color: '#f59e0b' },
  negotiation: { label: 'Negotiation', color: '#06b6d4' },
  closing: { label: 'Closing', color: '#c9a84c' },
  closed: { label: 'Closed', color: '#22c55e' },
  loi: { label: 'Letter of Intent', color: '#f59e0b' },
  under_contract: { label: 'Under Contract', color: '#06b6d4' },
  lost: { label: 'Lost', color: '#dc2626' },
}

const money = (n: number | null | undefined): string => {
  if (n == null) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

export default function ClientPortalPage() {
  return (
    <ToastProvider>
      <PortalBody />
    </ToastProvider>
  )
}

function PortalBody() {
  const toast = useToast()
  const params = useParams()
  const dealId = String(params.dealId || '')
  const token = String(params.token || '')

  const [authorized, setAuthorized] = useState<null | boolean>(null)
  const [clientName, setClientName] = useState('')
  const [deal, setDeal] = useState<PortalDeal | null>(null)
  const [documents, setDocuments] = useState<any[]>([])
  const [milestones, setMilestones] = useState<PortalMilestone[]>([])
  const [messages, setMessages] = useState<PortalMessageUpdate[]>([])
  const [msg, setMsg] = useState('')
  const [uploading, setUploading] = useState(false)
  const msgEndRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const snap = await fetchPortalSnapshot(dealId, token)
    if (!snap) { setAuthorized(false); return }
    setAuthorized(true)
    setClientName(snap.clientName)
    setDeal(snap.deal); setDocuments(snap.documents); setMilestones(snap.milestones); setMessages(snap.messages)
  }, [dealId, token])

  const handleUpload = async (file: File) => {
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    form.append('kind', 'Client Upload')
    const ok = await fetch(`/api/portal?dealId=${encodeURIComponent(dealId)}&token=${encodeURIComponent(token)}`, {
      method: 'POST', body: form,
    }).then((r) => r.ok).catch(() => false)
    setUploading(false)
    if (ok) { toast('Document uploaded'); load() } else toast('Upload failed — storage may not be set up', 'error')
  }

  const handleSend = async () => {
    if (!msg.trim()) return
    const done = await sendPortalMessage(dealId, token, msg.trim(), clientName)
    if (done) { setMessages((p) => [...p, done]); setMsg(''); toast('Message sent') } else toast('Could not send message', 'error')
  }


  useEffect(() => { load() }, [load])

  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  // --- Unauthorized ------------------------------------------------------
  if (authorized === false) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)', padding: 20 }}>
        <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <h1 style={{ fontFamily: 'Georgia, serif', color: 'var(--navy)', fontSize: 24, margin: '0 0 8px' }}>Access link invalid</h1>
          <p style={{ color: 'var(--muted)', fontSize: 15 }}>This client portal link is invalid or has been revoked. Please contact your broker for a current link.</p>
        </div>
      </div>
    )
  }

  if (authorized === null) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)' }}>
        <span className="spinner" style={{ width: 30, height: 30, border: '3px solid var(--line)', borderTopColor: 'var(--navy)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  const stage = deal ? STAGE_LABEL[deal.status] || { label: deal.status, color: '#0b1f3a' } : null

  // --- Authorized client portal ------------------------------------------
  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      {/* Header */}
      <header style={{ background: 'linear-gradient(135deg, var(--navy) 0%, var(--navy-2) 100%)', color: '#fff', padding: '34px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ fontSize: 12, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--gold-light)' }}>CONCORD Client Portal</div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, margin: '10px 0 6px' }}>{deal?.title || 'Your transaction'}</h1>
          {stage && (
            <span style={{ display: 'inline-block', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
              Status: {stage.label}
            </span>
          )}
          <div style={{ marginTop: 14, display: 'flex', gap: 28, color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>
            <div><div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.6 }}>Est. value</div><div style={{ fontWeight: 700, fontSize: 18 }}>{money(deal?.purchase_price)}</div></div>
            <div><div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.6 }}>Welcome</div><div style={{ fontWeight: 700 }}>{clientName}</div></div>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
          {/* Milestones */}
          <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: 20 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: 'var(--navy)', margin: '0 0 4px' }}>Transaction milestones</h2>
            <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 16px' }}>Key steps and due-diligence items for your deal.</p>
            {milestones.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>No milestones published yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {milestones.map((m, i) => {
                  const done = m.status === 'approved' || m.status === 'waived' || m.status === 'completed'
                  const pending = m.status === 'pending' || m.status === 'in_review'
                  return (
                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 22, height: 22, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: done ? '#22c55e' : pending ? '#f59e0b' : 'var(--line)', color: done ? '#fff' : '#1a1a2e' }}>
                        {done ? '✓' : i + 1}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{m.title || 'Item'}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                          {m.date ? `${m.date}` : ''}{m.status ? ` · ${m.status.replace('_', ' ')}` : ''}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Documents + upload */}
          <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: 20 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: 'var(--navy)', margin: '0 0 4px' }}>Documents</h2>
            <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 12px' }}>Deal documents &amp; your uploads for due diligence.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {documents.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: 13 }}>No documents shared yet.</p>
              ) : (
                documents.slice(0, 8).map((d) => (
                  <a key={d.id} href={d.file_url || '#'} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 8, textDecoration: 'none', color: 'inherit' }}>
                    <span style={{ fontSize: 16 }}>📄</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.file_name || d.name || 'Document'}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{d.category || 'Shared'}</div>
                    </div>
                    <span style={{ color: 'var(--navy)', fontSize: 13 }}>↗</span>
                  </a>
                ))
              )}
            </div>

            {/* Upload */}
            <label style={uploadBtn}>{uploading ? 'Uploading…' : '+ Upload document'}</label>
            <input
              type="file"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                await handleUpload(f)
                e.target.value = ''
              }}
            />
            <p style={{ fontSize: 12, color: 'var(--muted-2)', margin: '8px 0 0' }}>Share contracts, financials, or other due-diligence documents. Files are private to this deal.</p>
          </div>

          {/* Chat */}
          <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: 20, gridColumn: '1 / -1' }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: 'var(--navy)', margin: '0 0 4px' }}>Message your broker</h2>
            <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 14px' }}>Ask questions about your transaction anytime.</p>
            <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              {messages.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>No messages yet — start the conversation.</p>}
              {messages.map((m) => (
                <div key={m.id} style={{ alignSelf: m.author === 'client' ? 'flex-end' : 'flex-start', maxWidth: '78%' }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--muted)', marginBottom: 3 }}>
                    {m.author === 'client' ? (m.author_name || 'You') : (m.author_name || 'Your broker')}
                  </div>
                  <div style={{ padding: '10px 14px', borderRadius: 12, fontSize: 14, background: m.author === 'client' ? 'var(--navy)' : 'var(--paper)', color: m.author === 'client' ? '#fff' : 'var(--ink)', border: m.author === 'client' ? 'none' : '1px solid var(--line)' }}>
                    {m.body}
                  </div>
                </div>
              ))}
              <div ref={msgEndRef} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && msg.trim()) handleSend()
                }}
                placeholder="Type your message…"
                style={{ flex: 1, padding: '11px 14px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 14, fontFamily: 'inherit' }}
              />
              <button
                onClick={handleSend}
                style={{ padding: '11px 20px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
              >Send</button>
            </div>
          </div>
        </div>
      </div>

      <footer style={{ textAlign: 'center', padding: '20px', color: 'var(--muted-2)', fontSize: 12 }}>
        CONCORD Deal Platform · Secure client portal
      </footer>
      <style>{`@media (max-width: 720px){ .portal-grid{grid-template-columns:1fr} }`}</style>
    </div>
  )
}

const uploadBtn: React.CSSProperties = {
  display: 'inline-block', padding: '10px 16px', background: 'transparent', color: 'var(--navy)',
  border: '1px solid var(--gold)', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13.5,
}
