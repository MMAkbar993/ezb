'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Listing, fetchListings, createListing, updateListing, deleteListing, duplicateListing, fmtMoney, LISTING_STATUSES } from '@/lib/listings'
import { useToast } from '@/components/ui/Toast'
import { LoadingState, EmptyState, Card } from '@/components/ui'
import ListingFormModal from './ListingFormModal'
import StatusBadge from './StatusBadge'
import { STATUS_STYLE } from '@/lib/workflow'
import { queueAutoPosts } from '@/lib/services/social'
import { supabase } from '@/lib/supabase/client'
import { useRole } from '@/lib/auth/RoleContext'

interface TeamOption { id: string; full_name: string | null; email: string | null }

export default function ListingsDashboard() {
  const toast = useToast()
  const { isBrokerOrAdmin } = useRole()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Listing | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [workflows, setWorkflows] = useState<Record<string, { current_step: number; completed_at: string | null }>>({})
  const [team, setTeam] = useState<TeamOption[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await fetchListings()
      setListings(rows)
      // Bulk-fetch workflow progress so each card can offer "Continue Setup"
      // for listings that haven't finished the guided workflow — previously
      // this page had no link back into it at all once you left mid-flow.
      const ids = rows.map((l) => l.id)
      if (ids.length > 0) {
        const { data: wf } = await supabase.from('listing_workflows').select('listing_id, current_step, completed_at').in('listing_id', ids)
        const map: Record<string, { current_step: number; completed_at: string | null }> = {}
        for (const w of wf || []) map[w.listing_id] = { current_step: w.current_step, completed_at: w.completed_at }
        setWorkflows(map)
      } else {
        setWorkflows({})
      }
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!isBrokerOrAdmin) return
    supabase.from('profiles').select('id, full_name, email').order('full_name').then(({ data }) => {
      setTeam(data || [])
    })
  }, [isBrokerOrAdmin])

  const handleAgentChange = async (listing: Listing, agentId: string) => {
    // listings.agent_id is NOT NULL, so the picker only ever offers real team members.
    if (!agentId) return
    setListings((p) => p.map((l) => (l.id === listing.id ? { ...l, agent_id: agentId } : l)))
    try {
      await updateListing(listing.id, { agent_id: agentId })
      toast('Assigned agent updated', 'success')
    } catch (e: any) {
      toast(e.message, 'error')
    }
  }

  const handleSubmit = async (input: Partial<Listing>) => {
    if (editing) {
      await updateListing(editing.id, input)
      toast('Listing updated', 'success')
    } else {
      const created = await createListing(input)
      toast('Listing created', 'success')
      // Auto-post to connected social platforms on new listing upload (fire-and-forget).
      try {
        const { data } = await supabase.auth.getUser()
        if (data.user?.id) {
          const queued = await queueAutoPosts(data.user.id, {
            id: created.id,
            business_name: created.business_name,
            headline: created.headline,
            industry: created.industry,
            location_general: created.location_general,
            asking_price: created.asking_price,
            annual_revenue: created.annual_revenue,
            sde: created.sde,
            image_urls: created.image_urls,
            primary_image_url: created.primary_image_url,
          })
          if (queued.length > 0) {
            toast(`Social: queued ${queued.length} post(s)`, 'success')
          }
        }
      } catch {
        // Auto-post failure should never block listing creation.
      }
    }
    setShowForm(false)
    setEditing(null)
    await load()
  }

  const handleDelete = async (listing: Listing) => {
    if (!confirm(`Delete listing "${listing.business_name}"?`)) return
    try {
      await deleteListing(listing.id)
      toast('Listing deleted', 'success')
      await load()
    } catch (e: any) {
      toast(e.message, 'error')
    }
  }

  const handleDuplicate = async (listing: Listing) => {
    try {
      await duplicateListing(listing.id)
      toast('Listing duplicated', 'success')
      await load()
    } catch (e: any) {
      toast(e.message, 'error')
    }
  }

  const handleStatus = async (listing: Listing, status: string) => {
    setListings((p) => p.map((l) => (l.id === listing.id ? { ...l, status } : l)))
    try {
      await updateListing(listing.id, { status })
      toast(`Status → ${status}`, 'success')
    } catch (e: any) {
      toast(e.message, 'error')
    }
  }

  const filtered = statusFilter === 'all' ? listings : listings.filter((l) => l.status === statusFilter)

  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>Listings</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>
            {listings.length} total · {listings.filter((l) => l.status === 'active').length} active
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={load}>↻ Refresh</button>
          <button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true) }}>+ New Listing</button>
        </div>
      </header>

      {/* Status filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <FilterPill active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>All</FilterPill>
        {LISTING_STATUSES.map((s) => (
          <FilterPill key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>{STATUS_STYLE[s]?.label || s}</FilterPill>
        ))}
      </div>

      {loading ? <LoadingState /> : null}

      {!loading && filtered.length === 0 ? (
        <EmptyState icon="🏢" title="No listings found" subtitle="Create a listing to get started." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {!loading && filtered.map((listing) => (
            <Card key={listing.id} style={{ overflow: 'hidden' }}>
              {/* Image */}
              <div style={{ height: 140, background: 'var(--navy)', position: 'relative' }}>
                {listing.primary_image_url ? (
                  <img src={listing.primary_image_url} alt={listing.business_name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--gold-light)', fontSize: 32 }}>🏢</div>
                )}
                <div style={{ position: 'absolute', top: 10, left: 10 }}>
                  <StatusBadge status={listing.status} />
                </div>
              </div>

              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {listing.business_name || 'Unnamed listing'}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                      {listing.industry || ''}{listing.location_general ? ` · ${listing.location_general}` : ''}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--gold-dark)', fontSize: 15, whiteSpace: 'nowrap' }}>{fmtMoney(listing.asking_price)}</div>
                </div>

                {listing.headline && (
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {listing.headline}
                  </div>
                )}

                {/* Metrics */}
                <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
                  <span>Rev {listing.annual_revenue ? fmtMoney(listing.annual_revenue) : '—'}</span>
                  <span>SDE {listing.sde ? fmtMoney(listing.sde) : '—'}</span>
                  {listing.ebitda ? <span>EBITDA {fmtMoney(listing.ebitda)}</span> : null}
                </div>

                {/* Actions */}
                {!workflows[listing.id]?.completed_at && (
                  <Link
                    href={`/dashboard/listings/${listing.id}/workflow`}
                    className="btn btn-primary"
                    style={{ display: 'flex', justifyContent: 'center', padding: '8px 10px', fontSize: 13, marginTop: 14 }}
                  >
                    ▶ Continue Setup{workflows[listing.id] ? ` (Step ${workflows[listing.id].current_step}/10)` : ''}
                  </Link>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <Link href={`/cim?listing=${listing.id}`} className="btn btn-navy" style={{ flex: 1, justifyContent: 'center', padding: '8px 10px', fontSize: 13 }}>📑 CIM</Link>
                  <Link href={`/bov?listing=${listing.id}`} className="btn btn-navy" style={{ flex: 1, justifyContent: 'center', padding: '8px 10px', fontSize: 13 }}>⚖️ BOV</Link>
                  {/* Edit reopens the SAME guided workflow this listing was
                      created in (same page "Continue Setup" uses above) —
                      previously this opened a separate quick-edit popup
                      instead, so clicking Edit never actually took you back
                      into the listing's workflow/status controls. */}
                  <Link href={`/dashboard/listings/${listing.id}/workflow`} className="btn btn-ghost" title="Edit listing">✎</Link>
                  <button className="btn btn-ghost" title="Duplicate listing" onClick={() => handleDuplicate(listing)}>⧉</button>
                  <button className="btn btn-danger" onClick={() => handleDelete(listing)}>🗑</button>
                </div>

                {/* Status change */}
                <select
                  className="select"
                  value={listing.status || 'draft'}
                  onChange={(e) => handleStatus(listing, e.target.value)}
                  style={{ marginTop: 10, fontSize: 13 }}
                >
                  {LISTING_STATUSES.map((s) => <option key={s} value={s}>{STATUS_STYLE[s]?.label || s}</option>)}
                </select>

                {/* Assigned agent (admin/broker only — RLS permits reassignment) */}
                {isBrokerOrAdmin && (
                  <select
                    className="select"
                    value={listing.agent_id || ''}
                    onChange={(e) => handleAgentChange(listing, e.target.value)}
                    style={{ marginTop: 8, fontSize: 13 }}
                  >
                    {!listing.agent_id && <option value="">Unassigned</option>}
                    {team.map((m) => (
                      <option key={m.id} value={m.id}>{m.full_name || m.email || m.id}</option>
                    ))}
                  </select>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <ListingFormModal
          listing={editing}
          onClose={() => { setShowForm(false); setEditing(null); load() }}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  )
}

function FilterPill({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 14px', borderRadius: 999, cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: 13, fontWeight: 600,
        border: active ? '2px solid var(--gold-dark)' : '1px solid var(--line)',
        background: active ? 'rgba(201,168,76,0.15)' : '#fff',
        color: active ? 'var(--gold-dark)' : 'var(--muted)',
      }}
    >
      {children}
    </button>
  )
}
