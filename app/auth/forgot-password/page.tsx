'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSent(false)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!data.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }
      // Always show the "check your inbox" state — even if the account doesn't
      // exist, so we don't reveal which emails have accounts.
      setSent(true)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0b1f3a,#14294f)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '400px', background: '#fff', borderRadius: '10px', boxShadow: '0 20px 60px rgba(0,0,0,.35)', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#0b1f3a,#14294f)', padding: '28px 32px' }}>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#fff', fontFamily: 'Georgia,serif' }}>CONCORD</div>
          <div style={{ fontSize: '11px', letterSpacing: '.28em', color: '#c9a84c', textTransform: 'uppercase' }}>Deal Platform</div>
        </div>

        <div style={{ padding: '32px' }}>
          <h1 style={{ fontSize: '20px', margin: '0 0 6px', fontFamily: 'Georgia,serif', color: '#0b1f3a' }}>Forgot your password?</h1>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 24px' }}>
            Enter the email tied to your account and we'll send you a link to reset it.
          </p>

          {error && (
            <div style={{ background: '#fee', padding: '10px', borderRadius: '4px', color: 'red', marginBottom: '16px', fontSize: '13px' }}>
              {error}
            </div>
          )}

          {sent ? (
            <div>
              <div style={{ background: '#ecfdf5', padding: '14px', borderRadius: '6px', color: '#047857', marginBottom: '20px', fontSize: '13px', lineHeight: '1.5' }}>
                ✅ If an account exists for <strong>{email}</strong>, you'll receive a password reset link shortly.
                <br style={{ marginBottom: '6px' }} />
                Check your inbox (and spam folder).
              </div>
              <button
                type="button"
                onClick={() => router.push('/auth')}
                style={{ width: '100%', padding: '10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '15px', cursor: 'pointer', fontWeight: 600 }}
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', padding: '10px', background: loading ? '#999' : '#c9a84c', color: '#0b1f3a', border: 'none', borderRadius: '4px', fontSize: '15px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                {loading ? 'Sending link...' : 'Send reset link'}
              </button>
            </form>
          )}

          <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: '#6b7280' }}>
            Remembered it? <Link href="/auth" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}>Back to Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
