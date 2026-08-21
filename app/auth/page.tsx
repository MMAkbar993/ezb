'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageInner />
    </Suspense>
  )
}

function AuthPageInner() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('inactive') === '1') {
      setError('Your account has been deactivated. Contact your broker/admin for access.')
    }
  }, [searchParams])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      setSuccess('Signed in successfully — redirecting…')
      setTimeout(() => {
        router.push('/dashboard')
      }, 700)
    } catch (err: any) {
      setError(err.message || 'Sign in failed')
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
          <h1 style={{ fontSize: '20px', margin: '0 0 6px', fontFamily: 'Georgia,serif', color: '#0b1f3a' }}>Broker Sign In</h1>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 24px' }}>
            Sign in with your Concord broker credentials to access the deal platform.
          </p>

          {error && (
            <div style={{ background: '#fee', padding: '10px', borderRadius: '4px', color: '#b91c1c', marginBottom: '16px', fontSize: '13px' }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ background: '#ecfdf5', padding: '10px', borderRadius: '4px', color: '#047857', marginBottom: '16px', fontSize: '13px' }}>
              {success}
            </div>
          )}

          <form onSubmit={handleSignIn}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@ezbusinessadvisors.com"
                style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }}
                autoComplete="email"
                required
              />
            </div>

            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }}
                autoComplete="current-password"
                required
                minLength={6}
              />
            </div>

            <div style={{ textAlign: 'right', marginBottom: '20px' }}>
              <Link href="/auth/forgot-password" style={{ fontSize: '13px', color: '#0b1f3a', textDecoration: 'none', fontWeight: 500 }}>
                Forgot Password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px',
                background: loading ? '#999' : '#c9a84c',
                color: '#0b1f3a',
                border: 'none',
                borderRadius: '4px',
                fontSize: '15px',
                fontWeight: 700,
                fontFamily: 'Georgia,serif',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: '#6b7280' }}>
            <Link href="/" style={{ color: '#0b1f3a', textDecoration: 'none', fontWeight: 500 }}>← Back to Concord Markets</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
