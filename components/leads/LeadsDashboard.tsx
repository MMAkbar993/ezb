'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  UnifiedLead, LeadKind, LeadStatus, LEAD_STATUSES, statusMeta,
  fetchAllLeads, createLead, updateLead, deleteLead, convertLeadToDeal,
  fetchLeadActivities, addLeadActivity, LeadActivity, initials,
} from '@/lib/leads2'
import { fetchListings, Listing } from '@/lib/listings'
import { useToast } from '@/components/ui/Toast'
import { LoadingState, EmptyState, Card, Badge } from '@/components/ui'
import LeadFormModal from './LeadFormModal'

type KindFilter = 'all' | 'buyer' | 'seller'
type StatusFilter = LeadStatus | 'all'

export default function LeadsDashboard() {
  const toast = useToast()
  const [leads, setLeads] = useState<UnifiedLead[]>([])
  const [listings, setListings] = useState<Listing[]>([])
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<UnifiedLead | null>(null)

  const [selected, setSelected] = useState<UnifiedLead | null>(null)
  const [activities, setActivities] = useState<LeadActivity[]>([])
  const [converting, setConverting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [l, ls] = await Promise.all([fetchAllLeads(), fetchListings()])
      setLeads(l)
      setListings(ls)
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const openDetail = async (lead: UnifiedLead) => {
    setSelected(lead)
    setActivities(await fetchLeadActivities(lead.id))
  }

  const handleCreate = async (input: { kind: LeadKind; business_name?: string; email?: string; phone?: string; status?: LeadStatus }) => {
    const created = await createLead(input.kind, input)
    setShowForm(false)
    setLeads((p) => [created, ...p])
    toast('Lead created', 'success')
  }

  const handleUpdate = async (input: { kind: LeadKind; business_name?: string; email?: string; phone?: string; status?: LeadStatus }) => {
    if (!editing) return
    const updated = await updateLead(editing.kind, editing.id, input)
    setLeads((p) => p.map((l) => (l.kind === updated.kind && l.id === updated.id ? updated : l)))
    if (selected && selected.id === updated.id && selected.kind === updated.kind) setSelected(updated)
    setShowForm(false)
    setEditing(null)
    toast('Lead updated', 'success')
  }

  const handleDelete = async (lead: UnifiedLead) => {
    if (!confirm(`Delete ${lead.kind} lead${lead.business_name ? ` "${lead.business_name}"` : ''}?`)) return
    try {
      await deleteLead(lead.kind, lead.id)
      setLeads((p) => p.filter((l) => !(l.kind === lead.kind && l.id === lead.id)))
      if (selected && selected.id === lead.id) setSelected(null)
      toast('Lead deleted', 'success')
    } catch (e: any) {
      toast(e.message, 'error')
    }
  }

  const handleStatus = async (lead: UnifiedLead, status: LeadStatus) => {
    const prev = lead.status
    const patch = (s: string) => setLeads((p) => p.map((l) => (l.kind === lead.kind && l.id === lead.id ? { ...l, status: s } : l)))
    patch(status)
    if (selected?.id === lead.id) setSelected({ ...selected, status })
    try {
      await updateLead(lead.kind, lead.id, { status })
      await addLeadActivity(lead.id, 'status', `Status changed to ${status.replace(/_/g, ' ')}`)
    } catch (e: any) {
      toast(e.message, 'error')
      patch(prev)
    }
  }

  const handleConvert = async () => {
    if (!selected) return
    setConverting(true)
    try {
      const { dealId } = await convertLeadToDeal(selected)
      toast(`Converted to deal ${dealId.slice(0, 8)}`, 'success')
      await load()
      setSelected(null)
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setConverting(false)
    }
  }

  const filtered = leads.filter((l) => {
    if (kindFilter !== 'all' && l.kind !== kindFilter) return false
    if (statusFilter !== 'all' && l.status !== statusFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      const hay = [l.business_name, l.email, l.phone].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  const countKind = (k: 'buyer' | 'seller') => leads.filter((l) => l.kind === k).length

  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>Lead Management</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>
            {leads.length} total · {countKind('buyer')} buyers · {countKind('seller')} sellers
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true) }}>+ Add Lead</button>
      </header>

      {/* Filters */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by business, email, phone..."
            style={{ flex: 1, minWidth: 220 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <FilterPill active={kindFilter === 'all'} onClick={() => setKindFilter('all')}>All</FilterPill>
            <FilterPill active={kindFilter === 'buyer'} onClick={() => setKindFilter('buyer')}>👤 Buyers</FilterPill>
            <FilterPill active={kindFilter === 'seller'} onClick={() => setKindFilter('seller')}>🏢 Sellers</FilterPill>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <FilterPill active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>All Statuses</FilterPill>
          {LEAD_STATUSES.map((s) => (
            <FilterPill key={s.id} active={statusFilter === s.id} onClick={() => setStatusFilter(s.id)} color={s.color}>
              {s.label}
            </FilterPill>
          ))}
        </div>
      </div>

      {loading ? <LoadingState /> : null}

      {!loading && filtered.length === 0 ? (
        <EmptyState icon="🎯" title="No leads found" subtitle="Add a lead or adjust your filters." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {!loading && filtered.map((lead) => {
            const meta = statusMeta(lead.status)
            return (
              <Card key={`${lead.kind}-${lead.id}`} style={{ padding: 16, cursor: 'pointer' }} onClick={() => openDetail(lead)}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Badge color={lead.kind === 'buyer' ? '#3b82f6' : '#8b5cf6'}>
                    {lead.kind === 'buyer' ? '👤 Buyer' : '🏢 Seller'}
                  </Badge>
                  <Badge color={meta.color}>{meta.label}</Badge>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--navy)', color: 'var(--gold-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                    {lead.business_name ? initials(lead.business_name) : lead.email?.slice(0, 2).toUpperCase() || '?'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 15 }}>
                      {lead.business_name || lead.email || 'Unnamed lead'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {lead.phone || '—'} · {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : ''}
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <LeadFormModal
          lead={editing}
          mode={editing ? editing.kind : 'seller'}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSubmit={editing ? handleUpdate : handleCreate}
        />
      )}

      {/* Detail drawer */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.55)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }} onClick={() => setSelected(null)}>
          <div style={{ background: '#fff', width: 440, maxWidth: '100%', height: '100%', boxShadow: '-20px 0 60px rgba(26,26,46,0.4)', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ background: 'var(--navy)', color: '#fff', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0, fontSize: 18, color: '#fff' }}>{selected.business_name || selected.email || 'Lead'}</h2>
                <button onClick={() => setSelected(null)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>
                {selected.kind === 'seller' ? 'Seller Lead' : 'Buyer Lead'} · {selected.email || 'no email'} · {selected.phone || 'no phone'}
              </div>
              <div style={{ marginTop: 10 }}>
                <Badge color={statusMeta(selected.status).color}>{statusMeta(selected.status).label}</Badge>
              </div>
            </div>

            <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
              {/* Status */}
              <div className="section-title" style={{ marginBottom: 8 }}>Status</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                {LEAD_STATUSES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleStatus(selected, s.id)}
                    style={{
                      padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: 12.5, fontWeight: 600,
                      border: selected.status === s.id ? `2px solid ${s.color}` : '1px solid var(--line)',
                      background: selected.status === s.id ? s.color + '1a' : '#fff',
                      color: selected.status === s.id ? s.color : 'var(--muted)',
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Convert to deal */}
              <div className="section-title" style={{ marginBottom: 8 }}>Actions</div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <button className="btn btn-navy" style={{ flex: 1 }} onClick={handleConvert} disabled={converting}>
                  {converting ? 'Converting...' : '🎯 Convert to Deal'}
                </button>
                <button className="btn btn-ghost" onClick={() => { setEditing(selected); setShowForm(true) }}>Edit</button>
                <button className="btn btn-danger" onClick={() => handleDelete(selected)}>Delete</button>
              </div>

              {/* Activities */}
              <div className="section-title" style={{ marginBottom: 10 }}>Activity Notes</div>
              <ActivityNoteForm leadId={selected.id} onAdded={(a) => setActivities((p) => [a, ...p])} />
              <div style={{ marginTop: 12 }}>
                {activities.length === 0 ? (
                  <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: 16, border: '2px dashed var(--line)', borderRadius: 8 }}>
                    No activity yet. (Run the lead_activities SQL to enable logging.)
                  </div>
                ) : (
                  activities.map((a) => (
                    <div key={a.id} style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, marginBottom: 8, background: 'var(--cream)' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold-dark)', background: 'rgba(201,168,76,0.15)', padding: '2px 8px', borderRadius: 999, textTransform: 'capitalize' }}>{a.type}</span>
                        {a.created_at && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{timeAgo(a.created_at)}</span>}
                      </div>
                      <div style={{ fontSize: 13.5, color: 'var(--text)' }}>{a.description}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FilterPill({ children, active, onClick, color }: { children: React.ReactNode; active: boolean; onClick: () => void; color?: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 14px', borderRadius: 999, cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: 13, fontWeight: 600,
        border: active ? `2px solid ${color || 'var(--gold-dark)'}` : '1px solid var(--line)',
        background: active ? (color || 'var(--gold)') + '1a' : '#fff',
        color: active ? (color || 'var(--gold-dark)') : 'var(--muted)',
      }}
    >
      {children}
    </button>
  )
}

function ActivityNoteForm({ leadId, onAdded }: { leadId: string; onAdded: (a: LeadActivity) => void }) {
  const toast = useToast()
  const [text, setText] = useState('')
  const [type, setType] = useState('note')
  const [adding, setAdding] = useState(false)

  const add = async () => {
    if (!text.trim()) return
    setAdding(true)
    const a = await addLeadActivity(leadId, type, text.trim())
    setAdding(false)
    if (a) { onAdded(a); setText('') }
    else toast('Could not log activity — run lead_activities SQL', 'error')
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input
        className="input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a note..."
        onKeyDown={(e) => e.key === 'Enter' && add()}
        style={{ flex: 1 }}
      />
      <select className="select" value={type} onChange={(e) => setType(e.target.value)} style={{ width: 110 }}>
        {['note', 'call', 'email', 'meeting'].map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <button className="btn btn-navy" onClick={add} disabled={adding || !text.trim()}>Add</button>
    </div>
  )
}

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(iso).toLocaleDateString()
}
