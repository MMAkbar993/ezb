'use client'

// ---------------------------------------------------------------------------
// AgencyTrialSignup — trial signup flow for a new agency.
//   - Agency name, email, password, preferred plan tier
//   - "Start free trial" → creates agency with trial dates (14d default), no card
//   - "Subscribe now" → creates agency as paid (Stripe payment collected on the
//     billing page; here we flag intent and route to billing after signup)
// Requires the user to already be authenticated (they sign in first, then pick
// their agency plan). Creates the agency (via API route) and links the current
// user as admin owner.
// ---------------------------------------------------------------------------

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { authedFetch } from '@/lib/apiFetch'

type Mode = 'trial' | 'subscribe'

export default function AgencyTrialSignup() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [tier, setTier] = useState<'starter' | 'professional' | 'enterprise'>('professional')
  const [mode, setMode] = useState<Mode>('trial')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth')
        return
      }
      const res = await authedFetch('/api/billing/create-agency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, tier, startTrial: mode === 'trial', profileId: user.id }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Failed to create agency')
      router.push(mode === 'trial' ? '/dashboard' : `/dashboard/agency/settings/billing?agencyId=${json.agencyId}`)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid var(--line)',
    fontSize: 15, background: '#fff', color: 'var(--ink)',
  }

  return (
    <div style={{ maxWidth: 440, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <div style={{ fontSize: 34 }}>📌</div>
        <h1 style={{ margin: '6px 0 4px', fontSize: 22 }}>Set up your agency</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>Start free or subscribe — you can change any time.</p>
      </div>

      {/* mode toggle */}
      <div className="grid-2" style={{ gap: 8, marginBottom: 18 }}>
        <button
          type="button" onClick={() => setMode('trial')}
          style={{
            padding: '13px', borderRadius: 12, cursor: 'pointer', fontWeight: 800, fontSize: 15,
            border: mode === 'trial' ? '2px solid var(--gold)' : '1px solid var(--line)',
            background: mode === 'trial' ? 'rgba(201,168,76,0.12)' : '#fff', color: 'var(--ink)',
          }}
        >
          Start Free Trial
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginTop: 3 }}>14 days · no card</div>
        </button>
        <button
          type="button" onClick={() => setMode('subscribe')}
          style={{
            padding: '13px', borderRadius: 12, cursor: 'pointer', fontWeight: 800, fontSize: 15,
            border: mode === 'subscribe' ? '2px solid var(--gold)' : '1px solid var(--line)',
            background: mode === 'subscribe' ? 'rgba(201,168,76,0.12)' : '#fff', color: 'var(--ink)',
          }}
        >
          Subscribe Now
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginTop: 3 }}>Skip the trial · from $9/mo</div>
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 5 }}>Agency name</label>
          <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Eastside Business Advisors" required />
        </div>

        {/* plan tier (only relevant when subscribing) */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 5 }}>Plan {mode === 'trial' ? `(after trial you'll pick — showing ${tier})` : ''}</label>
          <div className="grid-3" style={{ gap: 8 }}>
            {(['starter', 'professional', 'enterprise'] as const).map((t) => (
              <button
                type="button" key={t} onClick={() => setTier(t)}
                style={{
                  padding: '11px 6px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700, textTransform: 'capitalize',
                  border: tier === t ? '2px solid var(--navy)' : '1px solid var(--line)',
                  background: tier === t ? 'var(--navy)' : '#fff', color: tier === t ? '#fff' : 'var(--ink)',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {error && <div style={{ background: '#fdecec', color: '#b00020', padding: '10px 12px', borderRadius: 10, fontSize: 13 }}>{error}</div>}

        <button
          type="submit" disabled={loading}
          style={{
            padding: '14px', borderRadius: 12, background: 'var(--gold)', color: 'var(--navy)',
            fontWeight: 800, fontSize: 16, cursor: loading ? 'wait' : 'pointer', border: 'none', marginTop: 4,
          }}
        >
          {loading ? 'Creating…' : mode === 'trial' ? 'Start Free Trial' : `Subscribe to ${tier}`}
        </button>
      </form>
    </div>
  )
}
