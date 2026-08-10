'use client'

import AgencyTrialSignup from '@/components/agency/AgencyTrialSignup'

// /signup/agency — full-page trial/subscribe signup flow (agency view).
// Presentational shell: centered layout with a sign-in prompt if not authed.
export default function SignupAgencyPage() {
  return (
    <div
      style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(160deg, #f7f5ee, #e9e6da)', padding: '32px 16px',
        fontFamily: 'Georgia, serif',
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 520, background: '#fff', borderRadius: 20, padding: '36px 32px',
          boxShadow: '0 20px 60px rgba(26,26,46,0.15)',
        }}
      >
        <AgencyTrialSignup />
        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--muted)', borderTop: '1px solid var(--line)', paddingTop: 16 }}>
          Already have an account? <a href="/auth" style={{ color: 'var(--navy)', fontWeight: 700 }}>Sign in</a>
        </div>
      </div>
    </div>
  )
}
