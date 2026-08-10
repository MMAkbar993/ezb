'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  SOCIAL_PLATFORMS,
  fetchSettings,
  saveSettings,
  type SocialPlatform,
  type SocialSettings,
} from '@/lib/services/social'
import { Card, CardHeader, LoadingState } from '@/components/ui'
import { ToastProvider, useToast } from '@/components/ui/Toast'

const DEV_AGENT_ID = '00000000-0000-0000-0000-000000000000'

const DEFAULTS: Record<SocialPlatform, Partial<SocialSettings>> = {
  facebook: { auto_post_enabled: true, include_images: true, include_link: true },
  instagram: { auto_post_enabled: true, include_images: true, include_link: true },
  tiktok: { auto_post_enabled: true, include_images: true, include_link: true },
  x: { auto_post_enabled: true, include_images: false, include_link: true },
}

export default function SocialSettings() {
  return (
    <ToastProvider>
      <SettingsBody />
    </ToastProvider>
  )
}

function SettingsBody() {
  const [settings, setSettings] = useState<Record<string, Partial<SocialSettings>>>({})
  const [loading, setLoading] = useState(true)
  const [agentId, setAgentId] = useState<string | null>(null)
  const [saving, setSaving] = useState<SocialPlatform | null>(null)
  const toast = useToast()

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser()
      const uid = data.user?.id || DEV_AGENT_ID
      setAgentId(uid)
      const rows = await fetchSettings(uid)
      const map: Record<string, Partial<SocialSettings>> = {}
      for (const r of rows) map[r.platform] = r
      // Seed defaults for any platform missing a row
      for (const p of SOCIAL_PLATFORMS) {
        map[p.id] = { ...DEFAULTS[p.id], ...(map[p.id] || {}) }
      }
      setSettings(map)
      setLoading(false)
    })().catch(() => setLoading(false))
  }, [])

  const set = (platform: SocialPlatform, key: keyof SocialSettings, value: any) => {
    setSettings((p) => ({ ...p, [platform]: { ...p[platform], [key]: value } }))
  }

  const save = async (platform: SocialPlatform) => {
    if (!agentId) return
    setSaving(platform)
    try {
      await saveSettings(agentId, platform, settings[platform] || {})
      toast('Settings saved', 'success')
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <LoadingState label="Loading settings…" />

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      {SOCIAL_PLATFORMS.map((p) => {
        const s = settings[p.id] || DEFAULTS[p.id]
        return (
          <Card key={p.id} style={{ padding: '0' }}>
            <CardHeader
              title={`${p.icon} ${p.label}`}
              subtitle="Auto-post and messaging preferences"
              right={
                <button className="btn btn-primary" disabled={saving === p.id} onClick={() => save(p.id)}>
                  {saving === p.id ? 'Saving…' : 'Save'}
                </button>
              }
            />
            <div style={{ padding: '20px', display: 'grid', gap: '16px' }}>
              {/* Auto-post toggle */}
              <ToggleRow
                label="Auto-post on listing upload"
                desc="Automatically queue a post on this platform whenever a new listing is created."
                checked={!!s.auto_post_enabled}
                onChange={(v) => set(p.id, 'auto_post_enabled', v)}
              />

              {/* Scheduling */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <label style={{ fontSize: 13, color: 'var(--muted)' }}>Schedule time (optional)</label>
                <input
                  type="time"
                  value={s.schedule_time || ''}
                  onChange={(e) => set(p.id, 'schedule_time', e.target.value || null)}
                  style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 6 }}
                />
              </div>

              {/* Custom message */}
              <div>
                <label style={{ fontSize: 13, color: 'var(--muted)' }}>Custom message (optional)</label>
                <textarea
                  value={s.custom_message || ''}
                  onChange={(e) => set(p.id, 'custom_message', e.target.value || null)}
                  placeholder="Leave blank to use the post template or auto-generated text."
                  rows={3}
                  style={{ width: '100%', padding: '10px', border: '1px solid var(--line)', borderRadius: 6, marginTop: 6, fontFamily: 'inherit' }}
                />
              </div>

              {/* Post template */}
              <div>
                <label style={{ fontSize: 13, color: 'var(--muted)' }}>Post template</label>
                <textarea
                  value={s.post_template || ''}
                  onChange={(e) => set(p.id, 'post_template', e.target.value || null)}
  placeholder={'Tokens: {business} {price} {industry} {location} {revenue} {sde}. Example: For sale: {business}, {price}.'}
                  rows={2}
                  style={{ width: '100%', padding: '10px', border: '1px solid var(--line)', borderRadius: 6, marginTop: 6, fontFamily: 'inherit' }}
                />
              </div>

              {/* Hashtags */}
              <div>
                <label style={{ fontSize: 13, color: 'var(--muted)' }}>Hashtags (space or comma separated)</label>
                <input
                  value={s.hashtags || ''}
                  onChange={(e) => set(p.id, 'hashtags', e.target.value || null)}
                  placeholder="#businessforsale #brokerage"
                  style={{ width: '100%', padding: '10px', border: '1px solid var(--line)', borderRadius: 6, marginTop: 6 }}
                />
              </div>

              {/* Include toggles */}
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                <ToggleRow label="Include images" desc="" checked={!!s.include_images} onChange={(v) => set(p.id, 'include_images', v)} />
                <ToggleRow label="Include link" desc="" checked={!!s.include_link} onChange={(v) => set(p.id, 'include_link', v)} />
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>{label}</div>
        {desc && <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{desc}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
        style={{
          width: 44, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', position: 'relative',
          background: checked ? 'var(--gold)' : '#ccd3da', transition: 'background 0.15s', flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute', top: 2, height: 20, width: 20, borderRadius: '50%', background: '#fff',
            left: checked ? 22 : 2, transition: 'left 0.15s',
          }}
        />
      </button>
    </div>
  )
}
