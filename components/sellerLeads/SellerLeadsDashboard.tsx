'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  SellerLead,
  LeadActivity,
  LeadStatus,
  LEAD_STATUSES,
  statusMeta,
  fetchSellerLeads,
  createSellerLead,
  updateSellerLead,
  updateSellerLeadStatus,
  deleteSellerLead,
  fetchLeadActivities,
  formatDate,
  initials,
} from '@/lib/sellerLeads'
import SellerLeadFormModal from './SellerLeadFormModal'
import ActivityLog from './ActivityLog'

type StatusFilter = LeadStatus | 'all'

export default function SellerLeadsDashboard() {
  const [leads, setLeads] = useState<SellerLead[]>([])
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<SellerLead | null>(null)

  const [selectedLead, setSelectedLead] = useState<SellerLead | null>(null)
  const [activities, setActivities] = useState<LeadActivity[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setLeads(await fetchSellerLeads())
    } catch (err: any) {
      setError(err.message || 'Failed to load seller leads')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Open a lead's detail + activities
  const openDetail = async (lead: SellerLead) => {
    setSelectedLead(lead)
    setDetailLoading(true)
    setActivities(await fetchLeadActivities(lead.id))
    setDetailLoading(false)
  }

  const closeDetail = () => {
    setSelectedLead(null)
    setActivities([])
  }

  const handleCreate = async (input: any) => {
    const created = await createSellerLead(input)
    setShowForm(false)
    setLeads((prev) => [created, ...prev])
  }

  const handleEdit = async (input: any) => {
    if (!editing) return
    const updated = await updateSellerLead(editing.id, input)
    setEditing(null)
    setShowForm(false)
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
    if (selectedLead?.id === updated.id) {
      setSelectedLead(updated)
    }
  }

  const handleDelete = async (lead: SellerLead) => {
    if (!confirm(`Delete seller lead "${lead.business_name}"? This cannot be undone.`)) return
    setError('')
    try {
      await deleteSellerLead(lead.id)
      setLeads((prev) => prev.filter((l) => l.id !== lead.id))
      if (selectedLead?.id === lead.id) closeDetail()
    } catch (err: any) {
      setError(err.message || 'Failed to delete seller lead')
    }
  }

  const handleStatusChange = async (lead: SellerLead, status: LeadStatus) => {
    const prev = lead.status
    setLeads((prevList) => prevList.map((l) => (l.id === lead.id ? { ...l, status } : l)))
    if (selectedLead?.id === lead.id) setSelectedLead({ ...selectedLead, status })
    try {
      await updateSellerLeadStatus(lead.id, status)
    } catch (err: any) {
      setError(err.message || 'Failed to update status')
      setLeads((prevList) => prevList.map((l) => (l.id === lead.id ? { ...l, status: prev } : l)))
      if (selectedLead?.id === lead.id) setSelectedLead({ ...selectedLead, status: prev })
    }
  }

  // Filtering: by status + text search
  const filtered = leads.filter((l) => {
    if (filter !== 'all' && (l.status || 'new') !== filter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      const hay = [l.business_name, l.email, l.phone].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  const countFor = (s: string) => leads.filter((l) => (l.status || 'new') === s).length

  return (
    <div style={{ padding: '24px', minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>Seller Leads</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>{leads.length} total seller leads</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          style={{ padding: '10px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
        >
          + Add Seller Lead
        </button>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
          {error}
          <button onClick={() => setError('')} style={{ marginLeft: '12px', background: 'transparent', border: '1px solid #b91c1c', color: '#b91c1c', borderRadius: '6px', padding: '2px 10px', cursor: 'pointer', fontSize: '13px' }}>Dismiss</button>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by business, email, or phone..."
          style={{ flex: 1, minWidth: '240px', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px' }}
        />
        <button
          onClick={() => setFilter('all')}
          style={{ padding: '6px 14px', borderRadius: '999px', border: filter === 'all' ? '2px solid #475569' : '1px solid #e2e8f0', background: filter === 'all' ? '#e2e8f0' : '#fff', color: '#334155', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >
          All ({leads.length})
        </button>
        {LEAD_STATUSES.map((s) => {
          const active = filter === s.id
          return (
            <button
              key={s.id}
              onClick={() => setFilter(s.id)}
              style={{ padding: '6px 14px', borderRadius: '999px', border: active ? `2px solid ${s.color}` : '1px solid #e2e8f0', background: active ? s.color + '1a' : '#fff', color: active ? s.color : '#64748b', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              {s.label} ({countFor(s.id)})
            </button>
          )
        })}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px', color: '#64748b' }}>Loading seller leads...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', border: '2px dashed #e2e8f0', borderRadius: '12px', color: '#94a3b8' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏢</div>
          <div style={{ fontWeight: 600, color: '#64748b' }}>No seller leads found</div>
          <div style={{ fontSize: '14px', marginTop: '4px' }}>Adjust your filters or add a new seller lead.</div>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div className="table-scroll">
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1.5fr', gap: '12px', padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 640 }}>
            <div>Business</div>
            <div>Email</div>
            <div>Phone</div>
            <div>Status</div>
            <div style={{ textAlign: 'right' }}>Actions</div>
          </div>

          {filtered.map((lead) => {
            const meta = statusMeta(lead.status)
            return (
              <div key={lead.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1.5fr', gap: '12px', padding: '12px 16px', borderBottom: '1px solid #f1f5f9', alignItems: 'center', minWidth: 640 }}>
                {/* Business */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => openDetail(lead)}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', color: '#15803d', flexShrink: 0 }}>
                    {initials(lead.business_name)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a' }}>{lead.business_name}</div>
                    <div style={{ fontSize: '11px', color: '#cbd5e1' }}>{formatDate(lead.created_at)}</div>
                  </div>
                </div>
                <div style={{ fontSize: '13px', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.email || '—'}</div>
                <div style={{ fontSize: '13px', color: '#475569' }}>{lead.phone || '—'}</div>
                <div>
                  <span style={{ backgroundColor: meta.color + '1a', color: meta.color, fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '999px' }}>
                    {meta.label}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                  <select
                    value={lead.status}
                    onChange={(e) => handleStatusChange(lead, e.target.value as LeadStatus)}
                    style={{ padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', color: '#334155' }}
                  >
                    {LEAD_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                  <button onClick={() => { setEditing(lead); setShowForm(true) }} style={{ padding: '6px 10px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', color: '#334155' }}>Edit</button>
                  <button onClick={() => handleDelete(lead)} style={{ padding: '6px 10px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', color: '#b91c1c' }}>Delete</button>
                </div>
              </div>
            )
          })}
          </div>
        </div>
      )}

      {/* Create/Edit modal */}
      {showForm && (
        <SellerLeadFormModal
          lead={editing}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSubmit={editing ? handleEdit : handleCreate}
        />
      )}

      {/* Detail drawer with activity log */}
      {selectedLead && (
        <div
          onClick={closeDetail}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', width: '420px', maxWidth: '100%', height: '100%', boxShadow: '-20px 0 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}
          >
            {/* Drawer header */}
            <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', color: '#fff', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{selectedLead.business_name}</h2>
                <button onClick={closeDetail} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ marginTop: '8px', fontSize: '13px', color: '#cbd5e1' }}>
                {selectedLead.email || 'No email'} · {selectedLead.phone || 'No phone'}
              </div>
            </div>

            {/* Drawer body */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              {/* Status inline editor */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Status</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {LEAD_STATUSES.map((s) => {
                    const active = statusMeta(selectedLead.status).id === s.id
                    return (
                      <button
                        key={s.id}
                        onClick={() => handleStatusChange(selectedLead, s.id)}
                        style={{ padding: '6px 12px', borderRadius: '999px', border: active ? `2px solid ${s.color}` : '1px solid #e2e8f0', background: active ? s.color + '1a' : '#fff', color: active ? s.color : '#64748b', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        {s.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Activity log */}
              {detailLoading ? (
                <div style={{ color: '#94a3b8', fontSize: '14px' }}>Loading activity...</div>
              ) : (
                <ActivityLog
                  leadId={selectedLead.id}
                  activities={activities}
                  onActivityAdded={(a) => setActivities((prev) => [a, ...prev])}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
