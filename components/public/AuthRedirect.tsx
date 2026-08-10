'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

/**
 * Non-blocking convenience redirect: if a broker is already signed in and
 * lands on the public homepage, nudge them to the dashboard. Renders nothing
 * and never delays/blocks the server-rendered marketing page underneath it —
 * anonymous visitors and search crawlers always see the full homepage.
 */
export default function AuthRedirect() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) router.replace('/dashboard')
    })
    return () => {
      cancelled = true
    }
  }, [router])

  return null
}
