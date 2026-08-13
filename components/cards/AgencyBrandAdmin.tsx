'use client'

// =============================================================================
// AgencyBrandAdmin — agency-wide business card + marketing brand settings.
// Only agency admins/owners see this. Sets the default brand (primary/secondary/
// accent color, font, logo) that every broker inherits by default. Brokers can
// still override per-broker via BusinessCardBrandSettings.
// =============================================================================

import { useEffect, useState } from 'react'
import {
  fetchUserAgencyContext,
} from '@/lib/agencies'
import {
  fetchAgencyBrand, saveAgencyBrand, uploadCardLogo,
  FONTS,
  type AgencyBrand,
} from '@/lib/branding'
import { useToast } from '@/components/ui/Toast'

const S = {
  card: { background: 'var(--cream)', border: '1px solid var(--line)', borderRadius: 10, padding: 22, marginBottom: 18 } as const,
  label: { display: 'block', fontFamily: 'Georgia, serif', fontWeight: 600, color: 'var(--navy)', fontSize: 13, marginBottom: 4 } as const,
  input: {
    width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 6,
    border: '1px solid var(--line)', background: '#fff', color: 'var(--text)', fontSize: 14,
    fontFamily: 'Georgia, serif', outline: 'none',
  } as React.CSSProperties,
  field: { display: 'flex', flexDirection: 'column', gap: 4 } as React.CSSProperties,
  section: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--gold-dark)', fontWeight: 700, marginBottom: 12 } as const,
}

export default function AgencyBrandAdmin() {
  const toast = useToast()
  const [agencyId, setAgencyId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [agencyName, setAgencyName] = useState<string | null>(null)
  const [brand, setBrand] = useState<AgencyBrand>({
    primaryColor: '#1a1a2e', secondaryColor: '#16213e', accentColor: '#c9a84c', font: 'georgia', logoUrl: null,
  })
  const [loaded, setLoaded] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    (async () => {
      const ctx = await fetchUserAgencyContext()
      if (ctx.agency && ctx.hasRole('admin')) {
        setAgencyId(ctx.agency.id)
        setIsAdmin(true)
        setAgencyName(ctx.agency.name)
        const b = await fetchAgencyBrand(ctx.agency.id)
        if (b) setBrand(b)
      }
      setLoaded(true)
    })()
  }, [])

  if (!loaded) return <div style={S.card}><div style={{ color: 'var(--muted)' }}>Loading…</div></div>
  if (!isAdmin) return null // only admins see this section

  const patch = (p: Partial<AgencyBrand>) => {
    setBrand((prev) => ({ ...prev, ...p }))
    setSaved(false)
  }

  const handleLogo = async () => {
    if (!logoFile) return
    setUploading(true)
    const res = await uploadCardLogo(logoFile)
    setUploading(false)
    if ('url' in res) {
      patch({ logoUrl: res.url })
      toast('Logo added — save to keep', 'success')
    } else {
      toast(res.error || 'Upload failed', 'error')
    }
    setLogoFile(null)
  }

  const save = async () => {
    if (!agencyId) return
    setSaving(true)
    const ok = await saveAgencyBrand(agencyId, brand)
    setSaving(false)
    if (ok) {
      setSaved(true)
      toast('Agency brand saved — brokers inherit by default', 'success')
    } else {
      toast('Save failed', 'error')
    }
  }

  return (
    <div style={S.card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', fontFamily: 'Georgia, serif' }}>
          Agency Branding — {agencyName}
        </div>
        <span style={{ fontSize: 11.5, color: 'var(--gold-dark)', background: 'rgba(201,168,76,0.15)', padding: '4px 10px', borderRadius: 99, fontWeight: 700 }}>
          ADMIN
        </span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>
        Set the default brand for business cards and marketing materials. Every broker inherits these by default and may override their own.
      </p>

      <div className="grid-2" style={{ gap: 14, marginTop: 14 }}>
        {([
          ['primaryColor', 'Primary Color'],
          ['secondaryColor', 'Secondary Color'],
          ['accentColor', 'Accent Color'],
        ] as const).map(([f, label]) => (
          <div key={f} style={S.field}>
            <span style={S.label}>{label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="color" value={brand[f]} onChange={(e) => patch({ [f]: e.target.value })} style={{ width: 40, height: 34, border: '1px solid var(--line)', borderRadius: 6, background: '#fff', cursor: 'pointer' }} />
              <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{brand[f]}</span>
            </div>
          </div>
        ))}
        <div style={S.field}>
          <span style={S.label}>Default Font</span>
          <select value={brand.font} onChange={(e) => patch({ font: e.target.value })} style={S.input}>
            {FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <span style={S.label}>Agency Logo</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} style={{ fontSize: 12 }} />
          <button onClick={handleLogo} disabled={!logoFile || uploading} style={{ padding: '8px 14px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: logoFile ? 'pointer' : 'not-allowed', opacity: logoFile ? 1 : 0.5 }}>
            {uploading ? 'Uploading…' : 'Upload logo'}
          </button>
          {brand.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt="agency logo" style={{ height: 36, borderRadius: 4, background: '#fff', padding: 2 }} />
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 16 }}>
        <button onClick={save} disabled={saving} style={{ padding: '11px 22px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving…' : 'Save Agency Brand'}
        </button>
        {saved && <span style={{ color: '#1e7e34', fontSize: 13, fontWeight: 600 }}>✓ Saved</span>}
      </div>
    </div>
  )
}
