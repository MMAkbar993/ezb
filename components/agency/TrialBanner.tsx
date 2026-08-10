'use client'

// ---------------------------------------------------------------------------
// TrialBanner — agency-view trial status banner shown on the dashboard.
// Shows days remaining, a progress bar vs trial length, what's included during
// the trial (5 listings / 20 leads / 5 deals / 3 agents / 100MB), and an
// "Upgrade Now" CTA (calls the convert-trial route). Auto-dismissible.
// Rendered read-only guidance when the trial has entered grace/locked mode.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react'
import {
  getMyTrialState, enforceLimits, statusFromAgency, FEATURE_MATRIX,
  type TrialState, type UsageLimits, type FeatureKey,
} from '@/lib/trial'
import { fetchUserAgencyContext, type Agency } from '@/lib/agencies'
import { authedFetch } from '@/lib/apiFetch'

interface Props {
  onUpgrade?: () => void
  /** Optional pre-fetched agency to avoid a second fetch. */
  initialAgency?: Agency | null
}

export default function TrialBanner({ onUpgrade, initialAgency }: Props) {
  const [state, setState] = useState<TrialState | null>(null)
  const [agency, setAgency] = useState<Agency | null>(initialAgency || null)
  const [dismissed, setDismissed] = useState(false)
  const [upgrading, setUpgrading] = useState(false)

  useEffect(() => {
    if (agency && state) return
    (async () => {
      try {
        const ctx = await fetchUserAgencyContext()
        setAgency(ctx.agency)
        setState(statusFromAgency(ctx.agency))
      } catch {
        setState(null)
      }
    })()
  }, [agency, state])

  const enforce = useMemo(() => (state ? enforceLimits(state) : null), [state])
  const progress = useMemo(() => {
    if (!state?.trialStart || !state?.trialEnd) return 100
    const start = new Date(state.trialStart).getTime()
    const end = new Date(state.trialEnd).getTime()
    const now = Date.now()
    const total = Math.max(1, end - start)
    return Math.max(0, Math.min(100, Math.round(((now - start) / total) * 100)))
  }, [state])

  // Nothing to show if paid or not on trial.
  if (state?.status === 'paid' || state?.status === 'none' || !state) return null
  if (dismissed) return null

  const trialFeatures = FEATURE_MATRIX.filter((f) => f.kind === 'limit')

  return (
    <div
      data-dismissible
      style={{
        display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 18px',
        borderRadius: 14, background: 'linear-gradient(120deg, var(--navy), #263059)',
        color: '#fff', boxShadow: '0 6px 24px rgba(26,26,46,0.15)', marginBottom: 18,
      }}
    >
      {/* header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🎉</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Free trial — {state.daysRemaining} day{state.daysRemaining === 1 ? '' : 's'} left</div>
            <div style={{ opacity: 0.72, fontSize: 12, marginTop: 2 }}>
              {trialFeatures.map((f) => (f.paid === 'Unlimited' ? `${f.trial} ${f.label.toLowerCase()}` : '')).filter(Boolean).join(' / ') || 'Listings, leads & deals'} · upgrade anytime to keep everything
            </div>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          style={{ background: 'transparent', border: 'none', color: '#fff', opacity: 0.6, fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
        >✕</button>
      </div>

      {/* progress bar */}
      {state.status === 'active' || state.status === 'ending_soon' ? (
        <div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.18)', borderRadius: 99, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%', width: `${progress}%`, borderRadius: 99,
                background: progress > 70 ? 'var(--gold)' : '#4ade80', transition: 'width .3s',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: 0.7, marginTop: 6 }}>
            <span>Started {state.trialStart ? new Date(state.trialStart).toLocaleDateString() : '—'}</span>
            <span>Ends {state.trialEnd ? new Date(state.trialEnd).toLocaleDateString() : '—'}</span>
          </div>
        </div>
      ) : (
        <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>
          {enforce?.reason || 'Your trial period has ended.'} Your data is preserved.
        </div>
      )}

      {/* action row */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={async () => {
            setUpgrading(true)
            try {
              if (onUpgrade) { onUpgrade(); return }
              if (!agency) return
              const res = await authedFetch('/api/billing/convert-trial', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agencyId: agency.id, planType: 'professional' }),
              })
              const json = await res.json()
              if (json.ok) {
                setState(statusFromAgency({ ...agency, paid_plan_active: true, plan_type: 'professional' } as Agency))
              } else {
                alert(json.error || 'Upgrade failed. Please try again.')
              }
            } finally {
              setUpgrading(false)
            }
          }}
          disabled={upgrading}
          style={{
            padding: '10px 18px', background: 'var(--gold)', color: 'var(--navy)', border: 'none',
            borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: upgrading ? 'wait' : 'pointer',
          }}
        >
          {upgrading ? 'Processing…' : state.status === 'grace' || state.status === 'expired' || state.status === 'locked' ? 'Upgrade & Unlock' : 'Upgrade Now'}
        </button>
        <a
          href="/dashboard/agency/settings/billing"
          style={{
            padding: '10px 16px', background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', textDecoration: 'none',
          }}
        >
          See what&apos;s included
        </a>
      </div>
    </div>
  )
}
