'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Agency, AgencyMember, AgencyRole, AGENCY_ROLES,
  fetchAgencies, fetchAgencyMembers, createAgency, updateAgency, deleteAgency,
  addAgencyMember, updateAgencyMemberRole, removeAgencyMember,
} from '@/lib/agencies'
import { useToast } from '@/components/ui/Toast'
import { LoadingState, EmptyState, Card, CardHeader, Badge } from '@/components/ui'

export default function AgencyAdmin() {
  const toast = useToast()
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [selected, setSelected] = useState<Agency | null>(null)
  const [members, setMembers] = useState<AgencyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)

  const load = useCallback(async () => {
    try {
      const a = await fetchAgencies()
      setAgencies(a)
      if (a.length > 0 && !selected) setSelected(a[0])
    } catch (e: any) { toast(e.message, 'error') } finally { setLoading(false) }
  }, [selected, toast])

  useEffect(() => { load() }, [load])

  const selectAgency = async (a: Agency) => {
    setSelected(a)
    setMembers(await fetchAgencyMembers(a.id))
  }

  const handleCreate = async (input: Partial<Agency>) => {
    try {
      const a = await createAgency(input)
      toast('Agency created', 'success')
      setShowCreate(false)
      setAgencies((prev) => [a, ...prev])
      setSelected(a)
    } catch (e: any) { toast(e.message, 'error') }
  }

  const handleUpdate = async (input: Partial<Agency>) => {
    if (!selected) return
    try {
      await updateAgency(selected.id, input)
      const updated = { ...selected, ...input }
      setSelected(updated)
      setAgencies((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
      toast('Agency updated', 'success')
    } catch (e: any) { toast(e.message, 'error') }
  }

  const handleDelete = async () => {
    if (!selected) return
    if (!confirm(`Delete agency "${selected.name}"? This cannot be undone.`)) return
    try {
      await deleteAgency(selected.id)
      toast('Agency deleted', 'success')
      setSelected(null)
      setAgencies((prev) => prev.filter((a) => a.id !== selected.id))
    } catch (e: any) { toast(e.message, 'error') }
  }

  const handleAddMember = async (profileId: string, role: AgencyRole) => {
    if (!selected) return
    try {
      await addAgencyMember(selected.id, profileId, role)
      toast('Member added', 'success')
      setShowAddMember(false)
      setMembers(await fetchAgencyMembers(selected.id))
    } catch (e: any) { toast(e.message, 'error') }
  }

  const roleColor = (r: AgencyRole) => r === 'admin' ? '#b91c1c' : r === 'broker' ? '#1a1a2e' : '#64748b'

  if (loading) return <LoadingState label="Loading agency admin..." />

  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>Agency Admin</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>
            Multi-broker agencies · white-label branding · role-based permissions · subdomains
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Agency</button>
      </header>

      {agencies.length === 0 ? (
        <EmptyState icon="🏛️" title="No agencies yet" subtitle="Create an agency to manage multiple brokers with white-label branding." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start' }}>
          {/* Agency list */}
          <Card style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', fontWeight: 700, color: 'var(--navy)' }}>Agencies</div>
            <div>
              {agencies.map((a) => (
                <button
                  key={a.id}
                  onClick={() => selectAgency(a)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '13px 18px', border: 'none', borderBottom: '1px solid var(--line)', background: selected?.id === a.id ? 'rgba(201,168,76,0.12)' : '#fff', cursor: 'pointer', textAlign: 'left' }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: 99, background: a.accent_color || '#c9a84c', flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{a.slug ? `${a.slug}.concordplatform.com` : a.domain || 'No domain'}</div>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Selected agency detail */}
          {selected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Branding */}
              <Card>
                <CardHeader title={`${selected.name} — White-Label Branding`} subtitle="Customize subdomain, colors, and logo" />
                <AgencyBrandingForm
                  agency={selected}
                  onSave={handleUpdate}
                  onDelete={handleDelete}
                />
              </Card>

              {/* Members */}
              <Card>
                <CardHeader
                  title="Team Members"
                  subtitle="Brokers with role-based permissions"
                  right={<button className="btn btn-navy" style={{ padding: '7px 14px', fontSize: 12 }} onClick={() => setShowAddMember(true)}>+ Add Member</button>}
                />
                <div style={{ padding: '12px 20px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {members.length === 0 ? (
                    <div style={{ color: 'var(--muted)', fontSize: 13, padding: 12 }}>No members yet. Add brokers to this agency.</div>
                  ) : (
                    members.map((m) => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 99, background: roleColor(m.role) }} />
                        <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{m.profile_id.slice(0, 8)}…</span>
                        {m.is_owner && <Badge color="#c9a84c">Owner</Badge>}
                        <select
                          className="select"
                          value={m.role}
                          disabled={!!m.is_owner}
                          onChange={(e) => updateAgencyMemberRole(m.id, e.target.value as AgencyRole).then(() => toast('Role updated', 'success')).catch((e: any) => toast(e.message, 'error'))}
                          style={{ width: 130, fontSize: 13 }}
                        >
                          {AGENCY_ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                        </select>
                        {!m.is_owner && (
                          <button className="btn btn-danger" style={{ padding: '4px 8px' }} onClick={() => removeAgencyMember(m.id).then(async () => { toast('Member removed', 'success'); setMembers(await fetchAgencyMembers(selected.id)) }).catch((e: any) => toast(e.message, 'error'))}>🗑</button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {showCreate && <CreateAgencyModal onClose={() => setShowCreate(false)} onSubmit={handleCreate} />}
      {showAddMember && selected && <AddMemberModal onClose={() => setShowAddMember(false)} onSubmit={handleAddMember} agencyName={selected.name} />}
    </div>
  )
}

// --- Branding form ---
function AgencyBrandingForm({ agency, onSave, onDelete }: { agency: Agency; onSave: (i: Partial<Agency>) => Promise<void>; onDelete: () => Promise<void> }) {
  const toast = useToast()
  const [name, setName] = useState(agency.name || '')
  const [slug, setSlug] = useState(agency.slug || '')
  const [domain, setDomain] = useState(agency.domain || '')
  const [brand, setBrand] = useState(agency.brand_color || '#1a1a2e')
  const [accent, setAccent] = useState(agency.accent_color || '#c9a84c')
  const [logo, setLogo] = useState(agency.logo_url || '')
  const [about, setAbout] = useState(agency.about || '')
  const [saving, setSaving] = useState(false)

  return (
    <div style={{ padding: '16px 20px 20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="label">Agency Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Subdomain</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input className="input" value={slug} onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9-]/gi, '').toLowerCase())} placeholder="agencyname" />
            <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>.concordplatform.com</span>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <label className="label">Custom Domain (optional)</label>
        <input className="input" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="brokerage.com" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
        <div>
          <label className="label">Brand Color</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="color" value={brand} onChange={(e) => setBrand(e.target.value)} style={{ width: 44, height: 38, border: 'none', cursor: 'pointer', background: 'none' }} />
            <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} style={{ flex: 1 }} />
          </div>
        </div>
        <div>
          <label className="label">Accent Color</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} style={{ width: 44, height: 38, border: 'none', cursor: 'pointer', background: 'none' }} />
            <input className="input" value={accent} onChange={(e) => setAccent(e.target.value)} style={{ flex: 1 }} />
          </div>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <label className="label">Logo URL</label>
        <input className="input" value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://…/logo.png" />
      </div>
      <div style={{ marginTop: 12 }}>
        <label className="label">About</label>
        <textarea className="textarea" rows={3} value={about} onChange={(e) => setAbout(e.target.value)} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
        <button className="btn btn-danger" onClick={async () => { if (confirm('Delete this agency?')) await onDelete() }}>Delete Agency</button>
        <button
          className="btn btn-primary"
          disabled={saving || !name.trim()}
          onClick={async () => {
            setSaving(true)
            await onSave({ name, slug: slug || null, domain: domain || null, brand_color: brand, accent_color: accent, logo_url: logo || null, about: about || null })
            setSaving(false)
          }}
        >
          {saving ? 'Saving...' : 'Save Branding'}
        </button>
      </div>
    </div>
  )
}

function CreateAgencyModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (i: Partial<Agency>) => Promise<void> }) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.55)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, maxWidth: 440, width: '100%', padding: 26 }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 20px', fontSize: 20, color: 'var(--navy)' }}>Create Agency</h2>
        <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSubmit({ name, slug: slug || null }) }}>
          <div style={{ marginBottom: 14 }}>
            <label className="label">Agency Name *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label className="label">Subdomain</label>
            <input className="input" value={slug} onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9-]/gi, '').toLowerCase())} placeholder="agencyname" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={!name.trim()}>Create</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddMemberModal({ onClose, onSubmit, agencyName }: { onClose: () => void; onSubmit: (profileId: string, role: AgencyRole) => Promise<void>; agencyName: string }) {
  const [profileId, setProfileId] = useState('')
  const [role, setRole] = useState<AgencyRole>('broker')
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.55)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, maxWidth: 440, width: '100%', padding: 26 }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 4px', fontSize: 20, color: 'var(--navy)' }}>Add Member to {agencyName}</h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 20px' }}>Enter the user's profile ID (from Supabase Auth users).</p>
        <form onSubmit={(e) => { e.preventDefault(); if (profileId.trim()) onSubmit(profileId, role) }}>
          <div style={{ marginBottom: 14 }}>
            <label className="label">Profile ID *</label>
            <input className="input" value={profileId} onChange={(e) => setProfileId(e.target.value)} placeholder="uuid" autoFocus />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label className="label">Role</label>
            <select className="select" value={role} onChange={(e) => setRole(e.target.value as AgencyRole)}>
              {AGENCY_ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add</button>
          </div>
        </form>
      </div>
    </div>
  )
}
