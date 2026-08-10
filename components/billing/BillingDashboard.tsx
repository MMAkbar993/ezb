'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  PLANS, Plan, Subscription, Invoice, fetchMySubscription, fetchMyInvoices,
  createBillingSession, cancelSubscription, upgradeTier,
} from '@/lib/billing'
import { useToast } from '@/components/ui/Toast'
import { LoadingState, Card, CardHeader, Badge } from '@/components/ui'

export default function BillingDashboard() {
  const toast = useToast()
  const searchParams = useSearchParams()
  const [sub, setSub] = useState<Subscription | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [s, i] = await Promise.all([fetchMySubscription(), fetchMyInvoices()])
    setSub(s); setInvoices(i); setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      toast('Welcome! Your trial has started.', 'success')
      load()
    }
  }, [searchParams, load, toast])

  const selectPlan = async (plan: Plan) => {
    if (plan.id === 'enterprise' && sub?.tier !== 'enterprise') {
      toast('Enterprise: contact our team to set up a custom plan.', 'info')
      return
    }
    setBusy(true)
    try {
      if (sub && sub.tier !== plan.id) {
        await upgradeTier(plan.id)
        toast(`Upgraded to ${plan.name}!`, 'success')
        await load()
      } else if (!sub) {
        const url = await createBillingSession(plan.id)
        if (url) window.location.href = url
      }
    } catch (e: any) {
      toast(e.message, 'error')
    } finally { setBusy(false) }
  }

  const handleCancel = async () => {
    if (!confirm('Cancel your subscription? You will keep access until the end of the period.')) return
    try {
      await cancelSubscription()
      toast('Subscription canceled.', 'info')
      await load()
    } catch (e: any) { toast(e.message, 'error') }
  }

  if (loading) return <LoadingState label="Loading billing..." />

  const currentPlanName = sub ? PLANS.find((p) => p.id === sub.tier)?.name || sub.tier : 'No plan'
  const isTrialing = sub?.status === 'trialing'

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26 }}>Subscription & Billing</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>
          {sub ? `Current plan: ${currentPlanName} · ${isTrialing ? 'Trial active' : sub.status}` : 'Choose a plan to get started.'}
        </p>
      </header>

      {/* Current status banner */}
      {sub && (
        <div style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.4)', borderRadius: 12, padding: '18px 22px', marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 15 }}>
              {currentPlanName} — {isTrialing ? '14-Day Free Trial' : sub.status.replace('_', ' ')}
            </div>
            {sub.trial_end && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Trial ends {new Date(sub.trial_end).toLocaleDateString()} · {sub.seats} seat(s)</div>}
            {sub.current_period_end && !isTrialing && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Renews {new Date(sub.current_period_end).toLocaleDateString()}</div>}
          </div>
          {sub.status !== 'canceled' && (
            <button className="btn btn-danger" onClick={handleCancel} disabled={busy}>Cancel Subscription</button>
          )}
        </div>
      )}

      {/* Plans */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 40 }}>
        {PLANS.map((plan) => {
          const isCurrent = sub?.tier === plan.id
          const isHigher = sub && (PLANS.findIndex((p) => p.id === sub.tier) < PLANS.findIndex((p) => p.id === plan.id))
          return (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={!!isCurrent}
              isUpgrade={!!isHigher}
              busy={busy}
              onSelect={() => selectPlan(plan)}
            />
          )
        })}
      </div>

      {/* Invoices */}
      <Card>
        <CardHeader title="Invoices" subtitle="Billing history & downloadable PDFs" />
        <div style={{ padding: '12px 20px 20px' }}>
          {invoices.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 13, padding: 12 }}>No invoices yet. Invoices appear after your trial ends or when you upgrade.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--navy)', textAlign: 'left', color: 'var(--navy)' }}>
                  <th style={{ padding: '10px 12px' }}>Date</th>
                  <th style={{ padding: '10px 12px' }}>Amount</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                  <th style={{ padding: '10px 12px' }}>Invoice</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '10px 12px' }}>{inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '—'}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>${Number(inv.amount).toFixed(2)} {inv.currency.toUpperCase()}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <Badge color={inv.status === 'paid' ? '#22c55e' : '#f59e0b'}>{inv.status}</Badge>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {inv.pdf_url ? <a href={inv.pdf_url} target="_blank" rel="noreferrer" style={{ color: 'var(--gold-dark)', fontWeight: 600 }}>Download PDF</a> : <span style={{ color: 'var(--muted)' }}>Pending</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  )
}

function PlanCard({ plan, isCurrent, isUpgrade, busy, onSelect }: { plan: Plan; isCurrent: boolean; isUpgrade: boolean; busy: boolean; onSelect: () => void }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: plan.highlighted ? '2px solid #c9a84c' : '1px solid #ece8dc',
      boxShadow: plan.highlighted ? '0 8px 40px rgba(201,168,76,0.2)' : '0 2px 12px rgba(26,26,46,0.06)',
      position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      {plan.highlighted && (
        <div style={{ background: 'linear-gradient(90deg,#c9a84c,#e6ce8c)', color: '#1a1a2e', textAlign: 'center', padding: '6px', fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>MOST POPULAR</div>
      )}
      <div style={{ padding: '26px 26px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 26 }}>{plan.icon}</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#1a1a2e', fontFamily: 'Georgia, serif' }}>{plan.name}</span>
        </div>
        <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>{plan.tagline}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 14 }}>
          <span style={{ fontSize: 36, fontWeight: 800, color: '#c9a84c', fontFamily: 'Georgia, serif' }}>${plan.monthly}</span>
          <span style={{ color: '#888', fontSize: 14 }}>/ month</span>
        </div>
      </div>
      <ul style={{ flex: 1, padding: '0 26px 20px', margin: 0, listStyle: 'none' }}>
        {plan.features.map((f) => (
          <li key={f} style={{ padding: '7px 0', fontSize: 13.5, color: '#555', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ color: '#c9a84c' }}>✓</span> {f}
          </li>
        ))}
      </ul>
      <div style={{ padding: '0 26px 26px' }}>
        <button
          onClick={onSelect}
          disabled={busy || isCurrent}
          style={{
            width: '100%', padding: '13px', borderRadius: 8, cursor: isCurrent ? 'default' : 'pointer',
            background: isCurrent ? '#f0ecdf' : plan.highlighted ? '#1a1a2e' : '#fff',
            color: isCurrent ? '#888' : plan.highlighted ? '#c9a84c' : '#1a1a2e',
            border: isCurrent ? 'none' : plan.highlighted ? 'none' : '2px solid #1a1a2e',
            fontWeight: 700, fontSize: 15, fontFamily: 'Georgia, serif',
          }}
        >
          {isCurrent ? 'Current Plan' : isUpgrade ? `Upgrade to ${plan.name}` : plan.cta}
        </button>
      </div>
    </div>
  )
}
