'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  DealStage,
  PipelineItem,
  PIPELINE_STAGES,
  fetchPipelineDeals,
  moveDealStage,
  deleteDeal,
  stageDurationDays,
} from '@/lib/pipeline'
import { createDeal, updateDeal } from '@/lib/pipeline'
import { fetchListings, Listing } from '@/lib/listings'
import { useToast } from '@/components/ui/Toast'
import { LoadingState, EmptyState, Card } from '@/components/ui'
import DealDetail from './DealDetail'
import DealFormModal from './DealFormModal'
import DealCard from './DealCard'

export default function DealPipeline() {
  const toast = useToast()
  const [deals, setDeals] = useState<PipelineItem[]>([])
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [dragging, setDragging] = useState<PipelineItem | null>(null)
  const [selectedDeal, setSelectedDeal] = useState<PipelineItem | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingDeal, setEditingDeal] = useState<PipelineItem | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [d, l] = await Promise.all([fetchPipelineDeals(), fetchListings()])
      setDeals(d)
      setListings(l)
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const dealsByStage = (stage: DealStage) => deals.filter((d) => d.stage === stage)

  // --- dnd-kit handlers ---
  const handleDragStart = (e: DragStartEvent) => {
    const deal = deals.find((d) => d.id === String(e.active.id))
    if (deal) setDragging(deal)
  }

  const handleDragEnd = async (e: DragEndEvent) => {
    setDragging(null)
    const dealId = String(e.active.id)
    const overStage = e.over?.id as DealStage | undefined
    if (!overStage) return
    const deal = deals.find((d) => d.id === dealId)
    if (!deal || deal.stage === overStage) return

    const prevStage = deal.stage
    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage: overStage } : d)))
    try {
      await moveDealStage(dealId, overStage)
      toast(`Moved to ${overStage.replace(/_/g, ' ')}`, 'success')
    } catch (err: any) {
      toast(err.message, 'error')
      setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage: prevStage } : d)))
    }
  }

  const handleSubmitDeal = async (input: { listing_id?: string; purchase_price?: number | null; status?: string }) => {
    if (editingDeal) {
      await updateDeal(editingDeal.id, {
        listing_id: input.listing_id,
        purchase_price: input.purchase_price ?? null,
        status: input.status as DealStage,
      })
      toast('Deal updated', 'success')
    } else {
      await createDeal({ listing_id: input.listing_id, status: (input.status || 'letter_of_intent') as DealStage, purchase_price: input.purchase_price ?? null })
      toast('Deal created', 'success')
    }
    setShowForm(false)
    setEditingDeal(null)
    await load()
  }

  const handleDelete = async (deal: PipelineItem) => {
    if (!confirm(`Delete deal for "${deal.business_name}"? This cannot be undone.`)) return
    try {
      await deleteDeal(deal.id)
      toast('Deal deleted', 'success')
      setSelectedDeal(null)
      await load()
    } catch (e: any) {
      toast(e.message, 'error')
    }
  }

  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>Deal Pipeline</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>
            {deals.length} deal{deals.length === 1 ? '' : 's'} · drag cards between stages
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={load}>↻ Refresh</button>
          <button className="btn btn-primary" onClick={() => { setEditingDeal(null); setShowForm(true) }}>
            + New Deal
          </button>
        </div>
      </header>

      {loading ? (
        <LoadingState label="Loading pipeline..." />
      ) : deals.length === 0 ? (
        <EmptyState icon="🎯" title="No deals yet" subtitle="Create a deal to start building your pipeline." />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={(e: DragOverEvent) => {}}
          onDragEnd={handleDragEnd}
        >
          <div className="kanban-scroll" style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8 }}>
            {PIPELINE_STAGES.map((stage) => {
              const stageDeals = dealsByStage(stage.id)
              return (
                <Card key={stage.id} style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', background: 'var(--cream)' }}>
                  {/* Header */}
                  <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: stageColor(stage.id) }} />
                    <span style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 14, color: 'var(--navy)', flex: 1 }}>{stage.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, background: 'var(--gold)', color: '#1a1a2e', padding: '2px 9px', borderRadius: 999 }}>
                      {stageDeals.length}
                    </span>
                  </div>
                  {/* Cards */}
                  <div style={{ flex: 1, padding: 10, minHeight: 120 }}>
                    {stageDeals.length === 0 ? (
                      <div style={{ border: '2px dashed var(--line)', borderRadius: 8, padding: '24px 12px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                        Drop deals here
                      </div>
                    ) : (
                      stageDeals.map((deal) => (
                        <DealCard
                          key={deal.id}
                          deal={deal}
                          onClick={() => setSelectedDeal(deal)}
                          onEdit={() => { setEditingDeal(deal); setShowForm(true) }}
                          stageDuration={stageDurationDays(deal)}
                        />
                      ))
                    )}
                  </div>
                </Card>
              )
            })}
          </div>

          <DragOverlay>
            {dragging ? (
              <div style={{ width: 240, background: '#fff', border: '2px solid var(--gold)', borderRadius: 10, padding: 12, boxShadow: '0 12px 30px rgba(26,26,46,0.25)', opacity: 0.95 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)' }}>{dragging.business_name || 'Unnamed'}</div>
                {dragging.asking_price && <div style={{ fontSize: 13, color: 'var(--gold-dark)', fontWeight: 700 }}>{fmt(dragging.asking_price)}</div>}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {selectedDeal && (
        <DealDetail
          deal={selectedDeal}
          onClose={() => setSelectedDeal(null)}
          onEdit={() => { setEditingDeal(selectedDeal); setShowForm(true) }}
          onDelete={() => handleDelete(selectedDeal)}
          onMoveStage={async (stage) => {
            const prev = selectedDeal
            setSelectedDeal({ ...selectedDeal, stage })
            setDeals((p) => p.map((d) => (d.id === selectedDeal.id ? { ...d, stage } : d)))
            try {
              await moveDealStage(selectedDeal.id, stage)
            } catch (e: any) {
              toast(e.message, 'error')
              setSelectedDeal(prev)
            }
          }}
        />
      )}

      {showForm && (
        <DealFormModal
          deal={editingDeal}
          listings={listings}
          onClose={() => { setShowForm(false); setEditingDeal(null) }}
          onSubmit={handleSubmitDeal}
        />
      )}
    </div>
  )
}

const fmt = (n: number | null | undefined): string => {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function stageColor(stage: DealStage): string {
  const map: Record<DealStage, string> = {
    letter_of_intent: '#3b82f6', under_contract: '#f59e0b', due_diligence: '#8b5cf6', closing: '#06b6d4', closed: '#22c55e',
  }
  return map[stage]
}
