'use client'

import { useCallback, useEffect, useState } from 'react'
import { DDStatus, DD_STATUSES, DDItem, fetchDDItems, createDDItem, updateDDItem, deleteDDItem, statusMeta, isOverdue } from '@/lib/dueDiligence'
import { fetchPipelineDeals, PipelineItem } from '@/lib/pipeline'
import { useToast } from '@/components/ui/Toast'
import { LoadingState, EmptyState, Card, Badge } from '@/components/ui'

export default function DueDiligenceDashboard() {
  const toast = useToast()
  const [deals, setDeals] = useState<PipelineItem[]>([])
  const [items, setItems] = useState<DDItem[]>([])
  const [selectedDealId, setSelectedDealId] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await fetchPipelineDeals()
      setDeals(d)
      if (d.length > 0 && !selectedDealId) setSelectedDealId(d[0].id)
      const it = await fetchDDItems(selectedDealId || undefined)
      setItems(it)
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [selectedDealId, toast])

  useEffect(() => { load() }, [load])

  const handleDealChange = async (dealId: string) => {
    setSelectedDealId(dealId)
    const it = await fetchDDItems(dealId).catch(() => [])
    setItems(it)
  }

  const handleCreate = async (input: { title: string; category?: string; due_date?: string }) => {
    if (!selectedDealId) { toast('Select a deal first', 'error'); return }
    await createDDItem({ deal_id: selectedDealId, title: input.title, category: input.category, due_date: input.due_date || null })
    toast('Checklist item added', 'success')
    setShowForm(false)
    setItems(await fetchDDItems(selectedDealId))
  }

  const handleStatus = async (item: DDItem, status: DDStatus) => {
    setItems((p) => p.map((i) => (i.id === item.id ? { ...i, status } : i)))
    try {
      await updateDDItem(item.id, { status })
    } catch (e: any) {
      toast(e.message, 'error')
    }
  }

  const handleNotes = async (item: DDItem, notes: string) => {
    setItems((p) => p.map((i) => (i.id === item.id ? { ...i, notes } : i)))
    try {
      await updateDDItem(item.id, { notes })
    } catch (e: any) {
      toast(e.message, 'error')
    }
  }

  const handleDelete = async (item: DDItem) => {
    if (!confirm(`Delete "${item.title}"?`)) return
    try {
      await deleteDDItem(item.id)
      setItems((p) => p.filter((i) => i.id !== item.id))
    } catch (e: any) {
      toast(e.message, 'error')
    }
  }

  const progress = items.length
    ? Math.round((items.filter((i) => i.status === 'approved' || i.status === 'waived').length / items.length) * 100)
    : 0
  const overdueCount = items.filter(isOverdue).length

  const dealName = deals.find((d) => d.id === selectedDealId)?.business_name || 'This deal'

  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>Due Diligence Tracker</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>Checklist per deal · track approvals, due dates, and notes</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)} disabled={!selectedDealId}>+ Add Checklist Item</button>
      </header>

      {/* Deal selector */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <label className="label">Select Deal</label>
        <select className="select" value={selectedDealId} onChange={(e) => handleDealChange(e.target.value)} style={{ maxWidth: 480 }}>
          <option value="">— Choose a deal —</option>
          {deals.map((d) => (
            <option key={d.id} value={d.id}>{d.business_name}</option>
          ))}
        </select>
        {deals.length === 0 && (
          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--muted)' }}>No deals in the pipeline yet. Create a deal to assign due diligence items.</div>
        )}
      </div>

      {loading ? <LoadingState /> : null}

      {!loading && selectedDealId && (
        <>
          {/* Progress */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
            <Card style={{ padding: 16 }}>
              <div className="section-title">Progress</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--navy)' }}>{progress}%</div>
              <div style={{ height: 8, background: 'var(--line)', borderRadius: 99, marginTop: 8 }}>
                <div style={{ height: 8, width: `${progress}%`, background: 'var(--gold)', borderRadius: 99 }} />
              </div>
            </Card>
            <Card style={{ padding: 16 }}>
              <div className="section-title">Total Items</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--navy)' }}>{items.length}</div>
            </Card>
            <Card style={{ padding: 16 }}>
              <div className="section-title">Overdue</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: overdueCount > 0 ? '#b91c1c' : '#22c55e' }}>{overdueCount}</div>
            </Card>
          </div>

          {/* Items */}
          {items.length === 0 ? (
            <EmptyState icon="🔍" title={`No checklist items for ${dealName}`} subtitle="Add a due diligence item to get started." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map((item) => {
                const meta = statusMeta(item.status)
                const overdue = isOverdue(item)
                return (
                  <Card key={item.id} style={{ padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
                      {/* Status */}
                      <select
                        className="select"
                        value={item.status}
                        onChange={(e) => handleStatus(item, e.target.value as DDStatus)}
                        style={{ width: 140, background: meta.color + '1a', color: meta.color, fontWeight: 700, borderColor: meta.color + '40' }}
                      >
                        {DD_STATUSES.map((s) => <option key={s.id} value={s.id} style={{ color: '#000' }}>{s.label}</option>)}
                      </select>

                      {/* Title + category */}
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--navy)' }}>{item.title}</span>
                          {item.category && <Badge color="#8b5cf6">{item.category}</Badge>}
                          {overdue && <Badge color="#ef4444">⚠ Overdue</Badge>}
                        </div>
                        {item.due_date && (
                          <div style={{ fontSize: 12, color: overdue ? '#b91c1c' : 'var(--muted)', marginTop: 4 }}>
                            Due {new Date(item.due_date + 'T00:00:00').toLocaleDateString()}
                          </div>
                        )}
                      </div>

                      {/* Notes */}
                      <input
                        className="input"
                        defaultValue={item.notes || ''}
                        onBlur={(e) => handleNotes(item, e.target.value)}
                        placeholder="Add notes..."
                        style={{ flex: 1, minWidth: 180 }}
                      />

                      <button className="btn btn-danger" onClick={() => handleDelete(item)}>🗑</button>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}

      {showForm && (
        <DDItemForm
          onClose={() => setShowForm(false)}
          onSubmit={handleCreate}
        />
      )}
    </div>
  )
}

function DDItemForm({ onClose, onSubmit }: { onClose: () => void; onSubmit: (input: { title: string; category?: string; due_date?: string }) => Promise<void> }) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('General')
  const [dueDate, setDueDate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setSubmitting(true)
    try {
      await onSubmit({ title, category, due_date: dueDate || undefined })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.55)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, maxWidth: 480, width: '100%', padding: 26 }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 20px', fontSize: 20, color: 'var(--navy)' }}>Add Checklist Item</h2>
        <form onSubmit={submit}>
          <div style={{ marginBottom: 16 }}>
            <label className="label">Item Title *</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Review financial statements" autoFocus />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div>
              <label className="label">Category</label>
              <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
                {['General', 'Financial', 'Legal', 'Tax', 'Operations', 'HR', 'Contracts'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Due Date</label>
              <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !title.trim()}>
              {submitting ? 'Adding...' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
