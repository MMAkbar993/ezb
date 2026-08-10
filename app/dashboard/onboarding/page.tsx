'use client'

import { useEffect, useState } from 'react'
import OnboardingDashboard from '@/components/training/OnboardingDashboard'

export default function OnboardingPage() {
  const [brokerId, setBrokerId] = useState<string | null>(null)

  useEffect(() => {
    setBrokerId(window.localStorage.getItem('concord_broker_id') || null)
  }, [])

  if (!brokerId) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: 'var(--muted)' }}>Sign in to view your onboarding checklist.</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 16px 40px' }}>
      <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: 'var(--navy)', marginBottom: 4 }}>
        Agent Onboarding
      </h1>
      <p style={{ color: 'var(--muted)', marginTop: 0, marginBottom: 20, fontSize: 14 }}>
        Get set up to run deals on CONCORD in a few steps.
      </p>
      <OnboardingDashboard brokerId={brokerId} />
    </div>
  )
}
