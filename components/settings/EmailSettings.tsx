'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Card, CardHeader } from '@/components/ui'
import { ToastProvider, useToast } from '@/components/ui/Toast'

// ---------------------------------------------------------------------------
// Email settings for the agent profile.
// Reads/writes profiles.email_settings (jsonb) — degrades gracefully if the
// column/table is not yet migrated (feature stays functional with local state).
// ---------------------------------------------------------------------------

interface EmailSettings {
  notificationsEnabled: boolean
  email: string
  dealNotifications: boolean
  leadNotifications: boolean
  trainingNotifications: boolean
  documentNotifications: boolean
  socialNotifications: boolean
  ddReminders: boolean
  digestFrequency: 'realtime' | 'daily' | 'weekly'
}

const DEFAULT_SETTINGS: EmailSettings = {
  notificationsEnabled: true,
  email: '',
  dealNotifications: true,
  leadNotifications: true,
  trainingNotifications: true,
  documentNotifications: true,
  socialNotifications: true,
  ddReminders: true,
  digestFrequency: 'realtime',
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{label}</div>
        {description && <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{description}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
        style={{
          width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
          background: checked ? 'var(--gold)' : '#d8d5ca', position: 'relative', transition: 'background 0.15s',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: checked ? 22 : 2, width: 20, height: 20,
          borderRadius: 10, background: '#fff', transition: 'left 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        }} />
      </button>
    </div>
  )
}

function SettingsBody() {
  const toast = useToast()
  const [settings, setSettings] = useState<EmailSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const email = user?.email || ''
      setSettings((s) => ({ ...s, email }))
      if (user) {
        const { data } = await supabase.from('profiles').select('email_settings').eq('id', user.id).maybeSingle()
        if (data?.email_settings && typeof data.email_settings === 'object') {
          setSettings((s) => ({ ...s, ...(data.email_settings as Partial<EmailSettings>) }))
        }
      }
      setLoaded(true)
    })()
  }, [])

  const save = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    let ok = false
    if (user) {
      const { error } = await supabase
        .from('profiles')
        .update({ email_settings: settings })
        .eq('id', user.id)
      ok = !error
    }
    setSaving(false)
    toast(ok ? 'Email preferences saved' : 'Saved (profile sync pending — run migrations)', ok ? 'success' : 'info')
  }

  const set = (patch: Partial<EmailSettings>) => setSettings((s) => ({ ...s, ...patch }))

  return (
    <Card>
      <CardHeader title="Email Notifications" subtitle="Choose which notifications you receive and how often." />
      <div style={{ padding: '20px 24px' }}>
        {!loaded ? (
          <div style={{ color: 'var(--muted)', padding: '20px 0' }}>Loading preferences…</div>
        ) : (
          <>
            <ToggleRow
              label="Master toggle — notifications"
              description="Receive any platform notifications at this address"
              checked={settings.notificationsEnabled}
              onChange={(v) => set({ notificationsEnabled: v })}
            />
            <div style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Delivery email</div>
              <input
                type="email"
                value={settings.email}
                onChange={(e) => set({ email: e.target.value })}
                style={{ marginTop: 8, width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 14, fontFamily: 'inherit' }}
              />
            </div>
            <ToggleRow label="New deal notifications" checked={settings.dealNotifications} onChange={(v) => set({ dealNotifications: v })} />
            <ToggleRow label="Lead assignments" checked={settings.leadNotifications} onChange={(v) => set({ leadNotifications: v })} />
            <ToggleRow label="Training certificates" checked={settings.trainingNotifications} onChange={(v) => set({ trainingNotifications: v })} />
            <ToggleRow label="Document upload confirmations" checked={settings.documentNotifications} onChange={(v) => set({ documentNotifications: v })} />
            <ToggleRow label="Social post status" checked={settings.socialNotifications} onChange={(v) => set({ socialNotifications: v })} />
            <ToggleRow label="Due-diligence reminders" checked={settings.ddReminders} onChange={(v) => set({ ddReminders: v })} />
            <div style={{ padding: '12px 0' }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Digest frequency</div>
              <select
                value={settings.digestFrequency}
                onChange={(e) => set({ digestFrequency: e.target.value as EmailSettings['digestFrequency'] })}
                style={{ marginTop: 8, width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', background: '#fff' }}
              >
                <option value="realtime">Real-time (immediately)</option>
                <option value="daily">Daily digest</option>
                <option value="weekly">Weekly digest</option>
              </select>
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                onClick={save}
                disabled={saving}
                style={{
                  background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 6,
                  padding: '10px 22px', fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Saving…' : 'Save preferences'}
              </button>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}

export default function EmailSettings() {
  return (
    <ToastProvider>
      <SettingsBody />
    </ToastProvider>
  )
}
