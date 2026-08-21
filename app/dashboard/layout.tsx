'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { RoleContext, deriveRoleState, Role } from '@/lib/auth/RoleContext'

// ---------------------------------------------------------------------------
// Auth guard for every /dashboard/** route. This app stores sessions in
// localStorage (no cookie-based session), so middleware.ts cannot check auth
// server-side — its PROTECTED_PREFIXES block has always been commented out,
// meaning /dashboard (and every page under it) rendered its full shell for
// anyone, logged in or not, before this layout existed. RLS still protects
// the underlying data either way, but the UI itself was reachable with no
// session at all. This performs the equivalent check client-side, before any
// dashboard page content renders.
// ---------------------------------------------------------------------------

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  const [role, setRole] = useState<Role | null>(null)
  const [roleLoading, setRoleLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return
      if (!data.session) {
        router.replace('/auth')
        return
      }
      const uid = data.session.user.id
      const { data: prof } = await supabase.from('profiles').select('role, status').eq('id', uid).maybeSingle()
      // A deactivated account (admin-toggled in Team & Access) must not reach
      // any dashboard page — RLS/role checks alone don't stop it, since a
      // deactivated agent still has valid role-scoped access otherwise.
      if (prof?.status === 'inactive') {
        await supabase.auth.signOut()
        if (!cancelled) router.replace('/auth?inactive=1')
        return
      }
      setChecked(true)
      if (!cancelled) {
        setRole((prof?.role as Role) || 'agent')
        setRoleLoading(false)
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace('/auth')
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
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

  return <RoleContext.Provider value={deriveRoleState(role, roleLoading)}>{children}</RoleContext.Provider>
}
