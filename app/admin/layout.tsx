'use client'

// ---------------------------------------------------------------------------
// Auth + role guard for every /admin/** route (platform trial/billing admin
// pages). These had zero protection before this file existed — reachable by
// anyone, logged in or not (app/admin/trial-settings/page.tsx had a literal
// "TODO: wrap with an admin gate in production"). Mirrors the session-check
// pattern from app/dashboard/layout.tsx (sessions live in localStorage, not
// cookies, so middleware.ts can't do this check server-side), plus an
// additional profiles.role === 'admin' check — non-admins are bounced to
// /dashboard rather than /auth, since they may well have a valid session.
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { RoleContext, deriveRoleState, Role } from '@/lib/auth/RoleContext'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  const [role, setRole] = useState<Role | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return
      if (!data.session) {
        router.replace('/auth')
        return
      }
      const uid = data.session.user.id
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle()
      if (cancelled) return
      if (prof?.role !== 'admin') {
        router.replace('/dashboard')
        return
      }
      setRole('admin')
      setChecked(true)
    })

    return () => {
      cancelled = true
    }
  }, [router])

  if (!checked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e' }}>
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700, letterSpacing: 1 }}>CONCORD</div>
          <div style={{ color: '#c9a84c', letterSpacing: '0.3em', fontSize: 11, textTransform: 'uppercase', marginTop: 4 }}>Deal Platform</div>
        </div>
      </div>
    )
  }

  return <RoleContext.Provider value={deriveRoleState(role, false)}>{children}</RoleContext.Provider>
}
