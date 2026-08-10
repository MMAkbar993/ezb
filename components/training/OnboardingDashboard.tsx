'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardHeader, Badge } from '@/components/ui'
import type { OnboardingStep, OnboardingTask, OnboardingSummary } from '@/lib/onboarding'
import { authedFetch } from '@/lib/apiFetch'

// Agent Onboarding checklist — shows required steps with progress and lets the
// broker mark each step complete. Reads/writes via the onboarding API (server
// side) so task rows are always present for the broker.

interface Props {
  brokerId: string
}

const STEP_LINKS: Record<string, { label: string; href: string }> = {
  profile: { label: 'Open settings', href: '/dashboard/settings' },
  train_intro: { label: 'Start Module 1', href: '/dashboard/training' },
  ethics_nda: { label: 'Read training', href: '/dashboard/training' },
  commission: { label: 'Open settings', href: '/dashboard/settings' },
  first_listing: { label: 'New listing', href: '/dashboard/listings/new' },
  marketing: { label: 'Social hub', href: '/dashboard/social' },
}

export default function OnboardingDashboard({ brokerId }: Props) {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<OnboardingSummary | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await authedFetch(`/api/onboarding?brokerId=${encodeURIComponent(brokerId)}`)
      const json = await res.json()
      if (json.ok) {
        setSummary({
          steps: json.steps || [],
          tasks: (json.tasks || []) as OnboardingTask[],
          total: json.summary.total,
          completed: json.summary.completed,
          requiredTotal: json.summary.requiredTotal,
          requiredCompleted: json.summary.requiredCompleted,
          pct: json.summary.pct,
        })
      }
    } catch {
      /* keep null → show empty state */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [brokerId]) // eslint-disable-line react-hooks/exhaustive-deps

  const taskByStep = useMemo(() => {
    const map = new Map<string, OnboardingTask>()
    summary?.tasks.forEach((t) => map.set(t.step_id, t))
    return map
  }, [summary])

  const toggle = async (step: OnboardingStep) => {
    const existing = taskByStep.get(step.id)
    const next = !(existing?.completed ?? false)
    setSaving(step.id)
    try {
      const res = await authedFetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brokerId, stepId: step.id, completed: next }),
      })
      const json = await res.json()
      if (json.ok) await load()
    } catch {
      /* ignore */
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <Card style={{ padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--muted)' }}>
          <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
          Loading onboarding…
        </div>
      </Card>
    )
  }

  if (!summary) {
    return (
      <Card>
        <CardHeader title="Agent Onboarding" subtitle="Your onboarding checklist isn't set up yet." />
        <p style={{ padding: '0 20px 20px', color: 'var(--muted)' }}>
          Run the onboarding schema in Supabase to load your checklist.
        </p>
      </Card>
    )
  }

  const steps = summary.steps
  const required = steps.filter((s) => s.is_required)
  const complete = summary.pct >= 100

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* hero progress */}
      <Card style={{ padding: 24, background: 'linear-gradient(135deg,#0f2038,#14294f)', color: '#fff', border: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Georgia, serif' }}>Welcome to CONCORD 🎉</div>
            <div style={{ fontSize: 13, color: '#c7cfe0', marginTop: 4 }}>
              {complete
                ? 'You’ve completed onboarding. You’re ready to run deals!'
                : `${summary.requiredCompleted} of ${summary.requiredTotal} required steps done`}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 34, fontWeight: 700, fontFamily: 'Georgia, serif', color: 'var(--gold)' }}>
              {summary.pct}%
            </div>
            <div style={{ fontSize: 12, color: '#c7cfe0' }}>onboarding complete</div>
          </div>
        </div>
        <div style={{ height: 8, background: 'rgba(255,255,255,0.15)', borderRadius: 8, marginTop: 18, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${summary.pct}%`, background: 'var(--gold)', borderRadius: 8, transition: 'width .4s ease' }} />
        </div>
      </Card>

      {/* step list */}
      <Card style={{ padding: 8 }}>
        {steps.map((step, i) => {
          const task = taskByStep.get(step.id)
          const done = task?.completed ?? false
          const link = STEP_LINKS[step.step_key]
          return (
            <div
              key={step.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                borderBottom: i < steps.length - 1 ? '1px solid var(--line)' : 'none',
                opacity: done ? 0.7 : 1,
              }}
            >
              <div
                style={{
                  width: 34, height: 34, flex: '0 0 34px', borderRadius: '50%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14,
                  background: done ? 'var(--gold)' : '#f1eee4', color: done ? '#fff' : 'var(--muted)',
                }}
              >
                {done ? '✓' : (step.icon || i + 1)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>
                  {step.title}
                  {!step.is_required && <span style={{ marginLeft: 8 }}><Badge color="#8a8678">Optional</Badge></span>}
                </div>
                {step.description && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{step.description}</div>
                )}
              </div>
              {link && !done && (
                <a href={link.href} className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12, whiteSpace: 'nowrap' }}>
                  {link.label} →
                </a>
              )}
              <button
                className="btn"
                onClick={() => toggle(step)}
                disabled={saving === step.id}
                style={{
                  padding: '7px 14px', fontSize: 13, minWidth: 92,
                  borderColor: done ? 'var(--gold)' : 'var(--line)',
                  background: done ? 'var(--gold)' : 'transparent', color: done ? '#fff' : 'var(--ink)',
                }}
              >
                {saving === step.id ? '…' : done ? 'Completed' : 'Mark done'}
              </button>
            </div>
          )
        })}
      </Card>

      <p style={{ fontSize: 12, color: 'var(--muted-2)', margin: 0 }}>
        Tip: complete Module 1 of the Training Center to finish the “Watch Intro to Brokerage” step — you’ll earn your first certificate.
      </p>
    </div>
  )
}
