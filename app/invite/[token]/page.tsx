'use client'

// ---------------------------------------------------------------------------
// /invite/[token] — no-login page for a new team member to accept an
// admin-issued invite. The role shown here is fixed (set by the admin at
// invite time, see app/api/team/invite/route.ts) — this page never lets the
// person choose or change it. On success, signs them in and sends them to
// the dashboard.
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

const ROLE_LABEL: Record<string, string> = { agent: 'Agent', broker: 'Broker', admin: 'Admin / Owner' }

export default function InviteAcceptPage() {
  const params = useParams()
  const router = useRouter()
  const token = String(params.token)

  const [invite, setInvite] = useState<{ email: string; role: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/team/invite/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) { setError(data.error || 'This invite link is invalid.'); return }
        setInvite({ email: data.email, role: data.role })
      })
      .catch(() => setError('Something went wrong loading this invite.'))
      .finally(() => setLoading(false))
  }, [token])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) { setError('Please enter your full name.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/team/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, fullName: fullName.trim() }),
      })
      const data = await res.json()
      if (!data.ok) { setError(data.error || 'Could not create your account.'); return }

      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: data.email, password })
      if (signInErr) { router.replace('/auth'); return }
      router.replace('/dashboard')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: '#0b1f3a' }}>Loading…</div>
  }

  if (error && !invite) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0b1f3a,#14294f)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: '#fff', borderRadius: 10, padding: 32, maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>⚠️</div>
          <div style={{ fontFamily: 'Georgia,serif', fontSize: 18, color: '#0b1f3a', fontWeight: 700, marginBottom: 8 }}>Invite not valid</div>
          <div style={{ fontSize: 13.5, color: '#6b7280' }}>{error}</div>
        </div>
      </div>
    )
  }

  if (!invite) return null

  return (
    <div style={{ minHeight: '100vh', background: '#f7f6f2' }}>
      <div style={{ background: 'linear-gradient(135deg,#0b1f3a,#14294f)', padding: '26px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', fontFamily: 'Georgia,serif' }}>CONCORD <span style={{ color: '#c9a84c' }}>· EZ Business Advisors</span></div>
        <div style={{ fontSize: 13, color: '#c9c9d8', marginTop: 4 }}>Team Invitation</div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '28px 20px 60px' }}>
        <div style={{ background: '#fff', border: '1px solid #ece8dc', borderRadius: 12, padding: 28 }}>
          <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 20, color: '#0b1f3a', margin: '0 0 6px' }}>You're invited</h1>
          <p style={{ fontSize: 13.5, color: '#6b7280', margin: '0 0 20px' }}>
            Joining as <strong>{invite.email}</strong>, role: <strong>{ROLE_LABEL[invite.role] || invite.role}</strong>. Set your name and a password to create your account.
          </p>

          <form onSubmit={submit}>
            <div style={{ marginBottom: 14 }}>
              <label className="label">Full Name</label>
              <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="label">Password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="label">Confirm Password</label>
              <input className="input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} />
            </div>

            {error && <div style={{ marginBottom: 14, background: '#fee2e2', color: '#b91c1c', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>{error}</div>}

            <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: '100%' }}>
              {submitting ? 'Creating account…' : 'Create Account & Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
