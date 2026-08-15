'use client'

// ===========================================================================
// MyProfile — self-service editor for the broker's own public directory
// profile (broker_profiles): photo, bio, contact info, service area. Shown
// on the public brokers directory (/marketplace/brokers) and individual
// profile page once `is_public` is on. Real-estate license fields live in
// the adjacent LicenseSettings component (writes to `profiles`, not this
// table) — kept separate rather than duplicated here.
// ===========================================================================

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { getAccessToken } from '@/lib/financialFiles'

const CARD = {
  background: 'var(--cream)', border: '1px solid var(--line)', borderRadius: 10, padding: 22,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 18,
} as const

const S = {
  label: { display: 'block', fontFamily: 'Georgia, serif', fontWeight: 600, color: 'var(--navy)', fontSize: 13, marginBottom: 4 },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 6,
    border: '1px solid var(--line)', background: '#fff', color: 'var(--text)', fontSize: 14,
    fontFamily: 'Georgia, serif', outline: 'none',
  } as React.CSSProperties,
  textarea: {
    width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 6,
    border: '1px solid var(--line)', background: '#fff', color: 'var(--text)', fontSize: 14,
    fontFamily: 'Georgia, serif', outline: 'none', minHeight: 80, resize: 'vertical',
  } as React.CSSProperties,
  sectionTitle: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--gold-dark)', fontWeight: 700, marginBottom: 12 },
  err: { color: '#b00020', fontSize: 13, marginTop: 8 },
  ok: { color: '#1e7e34', fontSize: 13, marginTop: 8 },
} as const

const emptyForm = {
  public_name: '', title: '', bio: '', phone: '', email_public: '', linkedin: '', service_area: '', avatar_url: '', is_public: true,
}

export default function MyProfile() {
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase.from('broker_profiles').select('*').eq('profile_id', user.id).maybeSingle()
    if (data) {
      setForm({
        public_name: data.public_name || '', title: data.title || '', bio: data.bio || '',
        phone: data.phone || '', email_public: data.email_public || '', linkedin: data.linkedin || '',
        service_area: data.service_area || '', avatar_url: data.avatar_url || '', is_public: data.is_public ?? true,
      })
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('You need to be signed in.')
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/broker/upload-photo', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Upload failed')
      setForm((f) => ({ ...f, avatar_url: data.url }))
    } catch (err: any) {
      setError(err?.message || 'Photo upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not signed in'); setSaving(false); return }

    const { error: err } = await supabase.from('broker_profiles').upsert({
      profile_id: user.id,
      public_name: form.public_name.trim() || null,
      title: form.title.trim() || null,
      bio: form.bio.trim() || null,
      phone: form.phone.trim() || null,
      email_public: form.email_public.trim() || null,
      linkedin: form.linkedin.trim() || null,
      service_area: form.service_area.trim() || null,
      avatar_url: form.avatar_url || null,
      is_public: form.is_public,
    }, { onConflict: 'profile_id' })

    if (err) { setError(err.message); setSaving(false); return }
    setSaved(true)
    setSaving(false)
  }

  if (loading) return <div style={{ color: 'var(--muted)' }}>Loading profile…</div>

  return (
    <form onSubmit={handleSave}>
      <div style={CARD}>
        <div style={S.sectionTitle}>My Public Profile</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px' }}>
          Shown on the public brokers directory and your listings. Your real estate license is managed separately below.
        </p>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--navy)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {form.avatar_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={form.avatar_url} alt="Profile photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ color: 'var(--gold-light)', fontSize: 24, fontWeight: 800 }}>{(form.public_name || 'B').charAt(0)}</span>
            )}
          </div>
          <div>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhoto} disabled={uploading} style={{ fontSize: 12 }} />
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{uploading ? 'Uploading…' : 'JPG, PNG, or WebP · up to 2MB'}</div>
          </div>
        </div>

        <div className="grid-2" style={{ gap: 12, marginBottom: 14 }}>
          <div>
            <label style={S.label}>Public Name</label>
            <input style={S.input} value={form.public_name} onChange={(e) => setForm((f) => ({ ...f, public_name: e.target.value }))} placeholder="e.g. Jane Smith" />
          </div>
          <div>
            <label style={S.label}>Title</label>
            <input style={S.input} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Senior Business Broker" />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={S.label}>Bio</label>
          <textarea style={S.textarea} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} placeholder="A short professional bio buyers and sellers will see." />
        </div>

        <div className="grid-2" style={{ gap: 12, marginBottom: 14 }}>
          <div>
            <label style={S.label}>Phone</label>
            <input style={S.input} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="(555) 123-4567" />
          </div>
          <div>
            <label style={S.label}>Public Email</label>
            <input style={S.input} type="email" value={form.email_public} onChange={(e) => setForm((f) => ({ ...f, email_public: e.target.value }))} placeholder="you@example.com" />
          </div>
        </div>

        <div className="grid-2" style={{ gap: 12, marginBottom: 14 }}>
          <div>
            <label style={S.label}>LinkedIn</label>
            <input style={S.input} value={form.linkedin} onChange={(e) => setForm((f) => ({ ...f, linkedin: e.target.value }))} placeholder="https://linkedin.com/in/..." />
          </div>
          <div>
            <label style={S.label}>Serving (Counties / State)</label>
            <input style={S.input} value={form.service_area} onChange={(e) => setForm((f) => ({ ...f, service_area: e.target.value }))} placeholder="e.g. Mecklenburg & Union County, NC" />
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--text)', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.is_public} onChange={(e) => setForm((f) => ({ ...f, is_public: e.target.checked }))} />
          Show my profile on the public brokers directory
        </label>

        {error && <div style={S.err}>⚠️ {error}</div>}
        {saved && <div style={S.ok}>✅ Profile saved.</div>}
      </div>

      <button type="submit" disabled={saving} style={{
        background: 'linear-gradient(135deg, var(--gold), var(--gold-dark))', color: 'var(--navy)',
        fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 15, border: 'none',
        padding: '12px 24px', borderRadius: 8, cursor: 'pointer', boxShadow: '0 2px 6px rgba(201,168,76,0.3)',
      }}>
        {saving ? 'Saving…' : 'Save Profile'}
      </button>
    </form>
  )
}
