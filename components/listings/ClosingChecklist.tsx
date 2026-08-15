'use client'

// ===========================================================================
// ClosingChecklist — listing-scoped closing task tracker, embedded directly
// in Step 10 (Deal Closing) rather than requiring the broker to navigate to
// the standalone /due-diligence page and pick a deal from a dropdown. Reuses
// the existing due_diligence_items table/CRUD layer (lib/dueDiligence.ts) —
// no new schema. ensureDealForListing() guarantees a `deals` row exists
// before any item is created, since a brand-new draft listing may not have
// one yet (deals only auto-create once a listing goes 'active').
// ===========================================================================

import { useEffect, useState } from 'react'
import { fetchDDItems, createDDItem, updateDDItem, deleteDDItem, DD_STATUSES, statusMeta, isOverdue, type DDItem } from '@/lib/dueDiligence'
import { ensureDealForListing } from '@/lib/pipeline'
import { stepField, stepBtn } from '@/components/listings/StepShell'
import { useToast } from '@/components/ui/Toast'

// The blueprint's named closing tasks — one click adds all five instead of
// the broker retyping them per deal.
const STANDARD_CLOSING_TASKS = [
  'Title Search',
  'UCC Filings',
  'Lease Assignment',
  'Liquor License Transfer',
  'Escrow Setup',
]

export default function ClosingChecklist({ listingId }: { listingId: string }) {
  const toast = useToast()
  const [dealId, setDealId] = useState<string | null>(null)
  const [items, setItems] = useState<DDItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState({ title: '', assignee: '', due_date: '' })

  const load = async () => {
    setLoading(true)
    try {
      const deal = await ensureDealForListing(listingId)
      if (!deal) { setLoading(false); return }
      setDealId(deal.id)
      setItems(await fetchDDItems(deal.id))
    } catch {
      // Non-fatal — closing can proceed without a checklist.
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [listingId])

  const addStandardTasks = async () => {
    if (!dealId) return
    setBusy(true)
    try {
      const existingTitles = new Set(items.map((i) => i.title))
      const toAdd = STANDARD_CLOSING_TASKS.filter((t) => !existingTitles.has(t))
      if (toAdd.length === 0) { toast('Standard closing tasks are already on the list', 'info'); return }
      await Promise.all(toAdd.map((title) => createDDItem({ deal_id: dealId, title, category: 'Closing' })))
      await load()
      toast(`Added ${toAdd.length} standard closing task(s)`, 'success')
    } catch (e: any) {
      toast(e.message || 'Failed to add tasks', 'error')
    } finally {
      setBusy(false)
    }
  }

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dealId || !draft.title.trim()) return
    setBusy(true)
    try {
      await createDDItem({ deal_id: dealId, title: draft.title.trim(), category: 'Closing', assignee: draft.assignee.trim() || null, due_date: draft.due_date || null })
      setDraft({ title: '', assignee: '', due_date: '' })
      await load()
    } catch (e: any) {
      toast(e.message || 'Failed to add task', 'error')
    } finally {
      setBusy(false)
    }
  }

  const setStatus = async (item: DDItem, status: string) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status } : i)))
    try { await updateDDItem(item.id, { status: status as any }) } catch { load() }
  }

  const remove = async (item: DDItem) => {
    if (!confirm(`Remove "${item.title}" from the checklist?`)) return
    try { await deleteDDItem(item.id); await load() } catch (e: any) { toast(e.message || 'Failed to remove', 'error') }
  }

  if (loading) return null

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 16, marginBottom: 20, background: 'var(--paper)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>Closing Checklist</div>
        <button type="button" onClick={addStandardTasks} disabled={busy || !dealId} style={{ ...stepBtn(false), fontSize: 12.5, padding: '6px 12px' }}>
          + Add standard closing tasks
        </button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 12px' }}>
        Title search, UCC filings, lease assignment, licenses, escrow — track who owns each step and its status.
      </p>

      {items.length === 0 && <div style={{ padding: '10px 0', fontSize: 13, color: 'var(--muted)' }}>No closing tasks yet.</div>}
      {items.map((item) => {
        const meta = statusMeta(item.status)
        const overdue = isOverdue(item)
        return (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 600 }}>{item.title}</div>
              <div style={{ fontSize: 11.5, color: overdue ? '#b91c1c' : 'var(--muted)' }}>
                {item.assignee ? `${item.assignee} · ` : ''}{item.due_date ? `Due ${new Date(item.due_date + 'T00:00:00').toLocaleDateString()}` : 'No due date'}{overdue ? ' · overdue' : ''}
              </div>
            </div>
            <select value={item.status} onChange={(e) => setStatus(item, e.target.value)} style={{ ...stepField, width: 130, padding: '6px 8px', fontSize: 12.5, color: meta.color }}>
              {DD_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <button type="button" onClick={() => remove(item)} style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: 13 }}>🗑</button>
          </div>
        )
      })}

      <form onSubmit={addTask} style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="New task" style={{ ...stepField, flex: 2, minWidth: 140 }} />
        <input value={draft.assignee} onChange={(e) => setDraft({ ...draft, assignee: e.target.value })} placeholder="Assignee" style={{ ...stepField, flex: 1, minWidth: 100 }} />
        <input type="date" value={draft.due_date} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} style={{ ...stepField, width: 150 }} />
        <button type="submit" disabled={busy || !draft.title.trim()} style={stepBtn(true)}>+ Add</button>
      </form>
    </div>
  )
}
