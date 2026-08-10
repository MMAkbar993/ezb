'use client'

// ---------------------------------------------------------------------------
// ServiceWorkerRegister — registers the PWA service worker (public/sw.js)
// only in production/handoff environments where HTTPS is guaranteed.
// Guarded so dev reloads never cache stale shell assets.
// ---------------------------------------------------------------------------

import { useEffect } from 'react'

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    // Only register in production-like builds with a real origin.
    if (!('serviceWorker' in navigator)) return
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') return

    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        // Non-fatal — PWA just won't be offline-capable.
        if (process.env.NODE_ENV !== 'production') console.warn('[pwa] SW registration failed', err)
      })
    }
    window.addEventListener('load', onLoad)
    return () => window.removeEventListener('load', onLoad)
  }, [])

  return null
}
