'use client'

// ===========================================================================
// LicenseSettings — manage real-estate license fields on the agent profile.
// Uses lib/compliance.ts to read/write license_status + verification and to
// display an advisory compliance status. State-specific + advisory only.
// ===========================================================================

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { checkAgentLicense, getMyLicense, ProfileLicense, LicenseCheck } from '@/lib/compliance'

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
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 },
  sectionTitle: {
    fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--gold-dark)',
    fontWeight: 700, marginBottom: 12,
  },
  err: { color: '#b00020', fontSize: 13, marginTop: 8 },
  ok: { color: '#1e7e34', fontSize: 13, marginTop: 8 },
} as const

const STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
]

export default function LicenseSettings() {
  const [form, setForm] = useState({ license_number: '', license_state: '', license_status: 'unverified' })
  const [check, setCheck] = useState<LicenseCheck | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const load = async () => {
    setLoading(true)
    const profile = await getMyLicense()
    if (profile) {
      setForm({
        license_number: profile.real_estate_license_number || '',
        license_state: profile.real_estate_license_state || '',
        license_status: profile.license_status,
      })
    }
    const c = await checkAgentLicense()
    setCheck(c)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not signed in'); setSaving(false); return }

    const verified = form.license_status === 'verified'
    const { error: err } = await supabase
      .from('profiles')
      .update({
        real_estate_license_number: form.license_number.trim() || null,
        real_estate_license_state: form.license_state || null,
        license_status: form.license_status,
        is_license_verified: verified,
      })
      .eq('id', user.id)

    if (err) { setError(err.message); setSaving(false); return }
    setSaved(true)
    setSaving(false)
    const c = await checkAgentLicense()
    setCheck(c)
  }

  if (loading) return <div style={{ color: 'var(--muted)' }}>Loading license settings…</div>

  return (
    <form onSubmit={handleSave}>
      <div style={CARD}>
        <div style={S.sectionTitle}>Real Estate License</div>
        <div style={S.grid}>
          <div>
            <label style={S.label}>License Number</label>
            <input style={S.input} value={form.license_number} onChange={(e) => setForm((f) => ({ ...f, license_number: e.target.value }))} placeholder="e.g. 1234567" />
          </div>
          <div>
            <label style={S.label}>License State</label>
            <select style={S.input} value={form.license_state} onChange={(e) => setForm((f) => ({ ...f, license_state: e.target.value }))}>
              <option value="">— Select —</option>
              {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={S.label}>License Status</label>
          <select style={S.input} value={form.license_status} onChange={(e) => setForm((f) => ({ ...f, license_status: e.target.value }))}>
            <option value="unverified">Unverified</option>
            <option value="pending">Pending verification</option>
            <option value="verified">Verified</option>
            <option value="not_required">Not required</option>
            <option value="expired">Expired</option>
          </select>
        </div>

        {check && (
          <div style={{
            padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13.5,
            background: check.ok ? 'rgba(30,126,52,0.08)' : 'rgba(176,0,32,0.08)',
            border: `1px solid ${check.ok ? 'rgba(30,126,52,0.3)' : 'rgba(176,0,32,0.3)'}`,
            color: check.ok ? '#1e7e34' : '#b00020',
          }}>
            {check.reason || (check.ok ? 'License satisfied.' : '')}
          </div>
        )}

        {error && <div style={S.err}>⚠️ {error}</div>}
        {saved && <div style={S.ok}>✅ License settings saved.</div>}
      </div>

      <button type="submit" disabled={saving} style={{
        background: 'linear-gradient(135deg, var(--gold), var(--gold-dark))', color: 'var(--navy)',
        fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 15, border: 'none',
        padding: '12px 24px', borderRadius: 8, cursor: 'pointer', boxShadow: '0 2px 6px rgba(201,168,76,0.3)',
      }}>
        {saving ? 'Saving…' : 'Save License'}
      </button>
    </form>
  )
}
