'use client'

// ===========================================================================
// TeamManagement — admin-only panel to view every team member (profiles) and
// change their role (agent -> broker -> admin). Only rendered for admins
// (see app/dashboard/settings/page.tsx). Writes go through
// /api/team/set-role (service-role route with its own admin check) rather
// than a direct client update, since profiles RLS only allows self-updates.
// ===========================================================================

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { getAccessToken } from '@/lib/financialFiles'
import { useRole, Role } from '@/lib/auth/RoleContext'
import { fetchCertificates, fetchProgress, type TrainingCertificate, type TrainingProgress } from '@/lib/training'

interface TeamMember {
  id: string
  email: string | null
  full_name: string | null
  role: Role
  status: string | null
}

interface TrainingSummary {
  completedLessons: number
  certificates: number
}

interface Invite {
  id: string
  email: string
  role: Role
  status: 'pending' | 'accepted' | 'revoked'
  created_at: string
  expires_at: string
}

const CARD = {
  background: 'var(--cream)', border: '1px solid var(--line)', borderRadius: 10, padding: 22,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 18,
} as const

const S = {
  sectionTitle: {
    fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--gold-dark)',
    fontWeight: 700, marginBottom: 4,
  },
  hint: { fontSize: 13, color: 'var(--muted)', marginBottom: 16 },
  row: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    padding: '12px 0', borderBottom: '1px solid var(--line)',
  } as React.CSSProperties,
  select: {
    padding: '7px 10px', borderRadius: 6, border: '1px solid var(--line)', background: '#fff',
    color: 'var(--text)', fontSize: 13.5, fontFamily: 'Georgia, serif', outline: 'none', cursor: 'pointer',
  } as React.CSSProperties,
  input: {
    padding: '9px 12px', borderRadius: 6, border: '1px solid var(--line)', background: '#fff',
    color: 'var(--text)', fontSize: 14, fontFamily: 'Georgia, serif', outline: 'none', flex: 1, minWidth: 160,
  } as React.CSSProperties,
  err: { color: '#b00020', fontSize: 13, marginTop: 8 },
  ok: { color: '#1e7e34', fontSize: 13, marginTop: 8 },
  btn: {
    background: 'linear-gradient(135deg, var(--gold), var(--gold-dark))', color: 'var(--navy)',
    fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 13.5, border: 'none',
    padding: '9px 18px', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap',
  } as React.CSSProperties,
  linkBtn: {
    background: 'transparent', color: 'var(--navy)', border: '1px solid var(--line)',
    fontFamily: 'Georgia, serif', fontSize: 12.5, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
  } as React.CSSProperties,
} as const

const ROLE_LABEL: Record<Role, string> = { agent: 'Agent', broker: 'Broker', admin: 'Admin / Owner' }

export default function TeamManagement() {
  const { role: myRole } = useRole()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [myId, setMyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [training, setTraining] = useState<Record<string, TrainingSummary>>({})

  const [invites, setInvites] = useState<Invite[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<Role>('agent')
  const [inviting, setInviting] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [inviteCopied, setInviteCopied] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setMyId(user?.id || null)
    const { data, error: err } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, status')
      .order('created_at', { ascending: true })
    if (err) { setError(err.message); setLoading(false); return }
    const list = (data as TeamMember[]) || []
    setMembers(list)
    setLoading(false)
    loadTrainingSummaries(list)
  }

  // Per-member training/certification status — requires the admin-read RLS
  // policy on training_certificates/training_progress (sql/team_admin_training_visibility.sql);
  // without it these just come back empty for anyone but the member themself.
  const loadTrainingSummaries = async (list: TeamMember[]) => {
    const entries = await Promise.all(list.map(async (m): Promise<[string, TrainingSummary]> => {
      const [progress, certs]: [TrainingProgress[], TrainingCertificate[]] = await Promise.all([
        fetchProgress(m.id), fetchCertificates(m.id),
      ])
      return [m.id, { completedLessons: progress.filter((p) => p.completed).length, certificates: certs.length }]
    }))
    setTraining(Object.fromEntries(entries))
  }

  const loadInvites = async () => {
    const token = await getAccessToken()
    if (!token) return
    const res = await fetch('/api/team/invite', { headers: { Authorization: 'Bearer ' + token } })
    const data = await res.json()
    if (data.ok) setInvites(data.invites)
  }

  useEffect(() => { load(); loadInvites() }, [])

  if (myRole !== 'admin') return null

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true)
    setError('')
    setInviteLink('')
    setInviteCopied(false)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('You need to be signed in.')
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Failed to create invite')
      const url = `${window.location.origin}/invite/${data.invite.token}`
      setInviteLink(url)
      setInviteEmail('')
      loadInvites()
    } catch (e: any) {
      setError(e?.message || 'Failed to create invite')
    } finally {
      setInviting(false)
    }
  }

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink)
    setInviteCopied(true)
  }

  const revokeInvite = async (id: string) => {
    const token = await getAccessToken()
    if (!token) return
    await fetch('/api/team/invite', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ id }),
    })
    loadInvites()
  }

  const changeRole = async (targetId: string, role: Role) => {
    setSavingId(targetId)
    setError('')
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('You need to be signed in.')
      const res = await fetch('/api/team/set-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ targetId, role }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Failed to update role')
      setMembers((prev) => prev.map((m) => (m.id === targetId ? { ...m, role } : m)))
    } catch (e: any) {
      setError(e?.message || 'Failed to update role')
    } finally {
      setSavingId(null)
    }
  }

  const changeStatus = async (targetId: string, status: 'active' | 'inactive') => {
    setStatusSavingId(targetId)
    setError('')
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('You need to be signed in.')
      const res = await fetch('/api/team/set-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ targetId, status }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Failed to update status')
      setMembers((prev) => prev.map((m) => (m.id === targetId ? { ...m, status } : m)))
    } catch (e: any) {
      setError(e?.message || 'Failed to update status')
    } finally {
      setStatusSavingId(null)
    }
  }

  return (
    <div style={CARD}>
      <div style={S.sectionTitle}>Team &amp; Access</div>
      <div style={S.hint}>
        Agents can only see and manage their own listings and leads. Brokers see everything an admin sees, except
        billing and team management. Admin/Owner has full access to everything. Promote an agent to broker as they progress.
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', fontSize: 14 }}>Loading team…</div>
      ) : members.length === 0 ? (
        <div style={{ color: 'var(--muted)', fontSize: 14 }}>No team members found.</div>
      ) : (
        members.map((m) => {
          const t = training[m.id]
          const isInactive = m.status === 'inactive'
          return (
          <div key={m.id} style={S.row}>
            <div>
              <div style={{ fontFamily: 'Georgia, serif', fontWeight: 600, color: isInactive ? 'var(--muted)' : 'var(--navy)', fontSize: 14.5 }}>
                {m.full_name || m.email || m.id}
                {m.id === myId && <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 12.5 }}> (you)</span>}
                {isInactive && <span style={{ color: '#b00020', fontWeight: 700, fontSize: 11, marginLeft: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Deactivated</span>}
              </div>
              {m.email && <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{m.email}</div>}
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                🎓 {t ? `${t.completedLessons} lessons complete · ${t.certificates} certificate${t.certificates === 1 ? '' : 's'}` : 'loading…'}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {m.id === myId ? (
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{ROLE_LABEL[m.role]}</span>
              ) : (
                <>
                  <button
                    type="button"
                    style={{ ...S.linkBtn, color: isInactive ? '#1e7e34' : '#b00020', borderColor: isInactive ? '#1e7e34' : '#f0c0c0' }}
                    disabled={statusSavingId === m.id}
                    onClick={() => changeStatus(m.id, isInactive ? 'active' : 'inactive')}
                  >
                    {statusSavingId === m.id ? '…' : isInactive ? 'Activate' : 'Deactivate'}
                  </button>
                  <select
                    style={S.select}
                    value={m.role}
                    disabled={savingId === m.id}
                    onChange={(e) => changeRole(m.id, e.target.value as Role)}
                  >
                    <option value="agent">Agent</option>
                    <option value="broker">Broker</option>
                    <option value="admin">Admin / Owner</option>
                  </select>
                </>
              )}
            </div>
          </div>
          )
        })
      )}

      {error && <div style={S.err}>⚠️ {error}</div>}

      <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontWeight: 600, color: 'var(--navy)', fontSize: 14.5, marginBottom: 4 }}>
          Invite a team member
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>
          Their role is set here and can't be changed by them — they just set a password and sign in.
        </div>
        <form onSubmit={sendInvite} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <input
            style={S.input}
            type="email"
            required
            placeholder="email@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <select style={S.select} value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Role)}>
            <option value="agent">Agent</option>
            <option value="broker">Broker</option>
            <option value="admin">Admin / Owner</option>
          </select>
          <button type="submit" style={S.btn} disabled={inviting}>
            {inviting ? 'Creating…' : 'Generate Invite Link'}
          </button>
        </form>

        {inviteLink && (
          <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 8, padding: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12.5, color: 'var(--text)', wordBreak: 'break-all', flex: 1, minWidth: 200 }}>{inviteLink}</div>
            <button type="button" style={S.linkBtn} onClick={copyInviteLink}>{inviteCopied ? '✓ Copied' : 'Copy Link'}</button>
          </div>
        )}

        {invites.filter((i) => i.status === 'pending').length > 0 && (
          <div>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', fontWeight: 700, marginBottom: 8 }}>
              Pending Invites
            </div>
            {invites.filter((i) => i.status === 'pending').map((inv) => (
              <div key={inv.id} style={S.row}>
                <div>
                  <div style={{ fontSize: 14, color: 'var(--text)' }}>{inv.email}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{ROLE_LABEL[inv.role]} · invited {new Date(inv.created_at).toLocaleDateString()}</div>
                </div>
                <button type="button" style={S.linkBtn} onClick={() => revokeInvite(inv.id)}>Revoke</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
