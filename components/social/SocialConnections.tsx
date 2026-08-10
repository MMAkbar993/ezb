'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  SOCIAL_PLATFORMS,
  fetchConnections,
  disconnectPlatform,
  type SocialConnection,
  type SocialPlatform,
} from '@/lib/services/social'
import { Card, CardHeader, Badge, LoadingState } from '@/components/ui'

// Fallback agent id for dev / pre-auth demo so the UI is testable.
const DEV_AGENT_ID = '00000000-0000-0000-0000-000000000000'

export default function SocialConnections() {
  const [connections, setConnections] = useState<Record<string, SocialConnection>>({})
  const [loading, setLoading] = useState(true)
  const [agentId, setAgentId] = useState<string | null>(null)
  const [connecting, setConnecting] = useState<SocialPlatform | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (uid: string) => {
    try {
      const rows = await fetchConnections(uid)
      const map: Record<string, SocialConnection> = {}
      for (const r of rows) map[r.platform] = r
      setConnections(map)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser()
      const uid = data.user?.id || DEV_AGENT_ID
      setAgentId(uid)
      await load(uid)
    })()
  }, [load])

  const handleConnect = async (platform: SocialPlatform) => {
    setNotice(null)
    setError(null)
    setConnecting(platform)
    try {
      const res = await fetch(`/api/social/oauth?platform=${platform}&agent_id=${agentId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start OAuth')
      if (data.url) {
        window.location.href = data.url
      } else {
        setNotice(data.error || 'OAuth not ready for this platform yet.')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setConnecting(null)
    }
  }

  const handleDisconnect = async (platform: SocialPlatform) => {
    setError(null)
    if (!agentId) return
    try {
      await disconnectPlatform(agentId, platform)
      setConnections((p) => ({ ...p, [platform]: { ...p[platform], is_active: false } }))
      setNotice(`${platform} disconnected.`)
    } catch (e: any) {
      setError(e.message)
    }
  }

  // Keep a fake "connected" state possible for manual-testing toggle.
  const handleToggle = async (platform: SocialPlatform) => {
    const cur = connections[platform]
    if (cur?.is_active) {
      await handleDisconnect(platform)
    } else {
      await handleConnect(platform)
    }
  }

  if (loading) return <LoadingState label="Loading connections…" />

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      {notice && <div style={{ padding: '12px 16px', borderRadius: 8, background: '#eefaf1', color: 'var(--navy)', fontSize: 14 }}>{notice}</div>}
      {error && <div style={{ padding: '12px 16px', borderRadius: 8, background: '#fdecea', color: '#b91c1c', fontSize: 14 }}>{error}</div>}

      {SOCIAL_PLATFORMS.map((p) => {
        const conn = connections[p.id]
        const active = conn?.is_active
        return (
          <Card key={p.id} style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ fontSize: 26 }}>{p.icon}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--navy)', fontFamily: 'Georgia, serif' }}>{p.label}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                    {active
                      ? (conn?.platform_username || conn?.platform_user_id || 'Connected')
                      : 'Not connected'}
                  </div>
                  {conn?.platform_name && active && (
                    <div style={{ fontSize: 12, color: 'var(--gold)', marginTop: 2 }}>{conn.platform_name}</div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {active && (
                  <Badge color="#22c55e">● Active</Badge>
                )}
                <button
                  className={`btn ${active ? 'btn-secondary' : 'btn-primary'}`}
                  disabled={connecting === p.id}
                  onClick={() => handleToggle(p.id)}
                  style={{ minWidth: 120 }}
                >
                  {connecting === p.id ? 'Connecting…' : active ? 'Disconnect' : 'Connect'}
                </button>
              </div>
            </div>
            {!active && (
              <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--muted)' }}>
                {p.label} posts will be created automatically once connected and your auto-post settings are enabled in Social Settings.
              </div>
            )}
          </Card>
        )
      })}

      <div style={{ fontSize: 12.5, color: 'var(--muted)', padding: '4px 2px' }}>
        OAuth requires a platform app (Facebook/Instagram app, TikTok developer app, or X developer app) plus the matching
        env vars and a public <code>/api/social/callback</code> redirect URI. Until then, "Connect" opens the app config check.
      </div>
    </div>
  )
}

