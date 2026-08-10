'use client'

// ---------------------------------------------------------------------------
// BusinessCardBrandSettings — per-broker business card studio.
// Loads the broker's brand context + card content (photo, back text, QR),
// and lets them configure: brand colors/font/logo/layout, headshot photo with
// position, custom back text, QR style, and a live front/back preview.
// Saves card content fields to broker_profiles (photo_url, back_text, qr_code_url,
// vcard_data) plus brand overrides. QR encodes a public /qr/<id> URL when known.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react'
import {
  fetchBrokerBrandContext, resolveBrand, saveBrokerCardOverrides,
  clearBrokerCardOverride, uploadCardLogo, CARD_LAYOUTS, FONTS, fontCss,
  type BrokerBrandContext, type CardBrand, type CardLayout, type BrokerCardOverrides,
} from '@/lib/branding'
import BusinessCardPreview, { type CardOwnerInfo, type PhotoPosition } from '@/components/cards/BusinessCardPreview'
import type { QrStyle } from '@/lib/qr'
import { generateVCardString } from '@/lib/vcard'
import { authedFetch } from '@/lib/apiFetch'
import { ToastProvider, useToast } from '@/components/ui/Toast'

const S = {
  card: { background: 'var(--cream)', border: '1px solid var(--line)', borderRadius: 10, padding: 22, marginBottom: 18 } as const,
  label: { display: 'block', fontFamily: 'Georgia, serif', fontWeight: 600, color: 'var(--navy)', fontSize: 13, marginBottom: 4 } as const,
  input: {
    width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 6,
    border: '1px solid var(--line)', background: '#fff', color: 'var(--text)', fontSize: 14,
    fontFamily: 'Georgia, serif', outline: 'none',
  } as React.CSSProperties,
  textarea: {
    width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 6,
    border: '1px solid var(--line)', background: '#fff', color: 'var(--text)', fontSize: 14,
    fontFamily: 'Georgia, serif', outline: 'none', resize: 'vertical', minHeight: 90,
  } as React.CSSProperties,
  field: { display: 'flex', flexDirection: 'column', gap: 4 } as React.CSSProperties,
  section: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--gold-dark)', fontWeight: 700, marginBottom: 12 } as const,
  swatchRow: { display: 'flex', alignItems: 'center', gap: 10 } as React.CSSProperties,
}

const PHOTO_POSITIONS: { id: PhotoPosition; label: string }[] = [
  { id: 'top', label: 'Top' },
  { id: 'center', label: 'Center' },
  { id: 'bottom', label: 'Bottom' },
]

const QR_STYLES: { id: QrStyle; label: string }[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'modern', label: 'Modern' },
]

function ColorField({
  label, value, agencyDefault, onValue, onClear,
}: {
  label: string; value: string; agencyDefault: string; onValue: (v: string) => void; onClear: () => void
}) {
  const inherited = value === agencyDefault
  return (
    <div style={S.field}>
      <span style={S.label}>{label}</span>
      <div style={S.swatchRow}>
        <input
          type="color"
          value={value}
          onChange={(e) => onValue(e.target.value)}
          style={{ width: 40, height: 34, padding: 0, border: '1px solid var(--line)', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
        />
        <input
          value={value}
          onChange={(e) => {
            const v = e.target.value
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onValue(v.startsWith('#') ? v : `#${v}`)
          }}
          style={{ ...S.input, width: 120, fontFamily: 'monospace', fontSize: 13 }}
        />
        {!inherited && (
          <button onClick={onClear} style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            inherit
          </button>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted-2)' }}>
        {inherited ? 'Agency default' : 'Broker override'}
      </div>
    </div>
  )
}

export default function BusinessCardBrandSettings() {
  const toast = useToast()
  const [ctx, setCtx] = useState<BrokerBrandContext | null>(null)
  const [form, setForm] = useState<CardBrand>({
    primaryColor: '#1a1a2e', secondaryColor: '#16213e', accentColor: '#c9a84c',
    font: 'georgia', logoUrl: null, layout: 'classic',
  })
  // Card content fields (photo, back text, QR, positions)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoPosition, setPhotoPosition] = useState<PhotoPosition>('top')
  const [backText, setBackText] = useState('')
  const [qrStyle, setQrStyle] = useState<QrStyle>('classic')
  const [qrUrl, setQrUrl] = useState('')
  // contact fields for live display + vCard
  const [contact, setContact] = useState({
    name: 'Your Name', title: 'Business Broker', company: 'Concord Deal Platform',
    phone: '(555) 123-4567', email: 'you@concordplatform.com', website: 'concordplatform.com',
  })

  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [publicCardUrl, setPublicCardUrl] = useState('')

  useEffect(() => {
    (async () => {
      const c = await fetchBrokerBrandContext()
      setCtx(c)
      setForm(resolveBrand(c))

      // Load broker card content from broker_profiles if present.
      const supabase = (await import('@/lib/supabase/client')).supabase
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('broker_profiles')
          .select('id, photo_url, back_text, qr_code_url, vcard_data, public_name, title, phone, email_public')
          .eq('profile_id', user.id)
          .maybeSingle()
        if (profile) {
          setPhotoUrl(profile.photo_url || null)
          setBackText(profile.back_text || '')
          setQrUrl(profile.qr_code_url || '')
          setContact((prev) => ({
            ...prev,
            name: profile.public_name || prev.name,
            title: profile.title || prev.title,
            phone: profile.phone || prev.phone,
            email: profile.email_public || prev.email,
          }))
          if (profile.id) setPublicCardUrl(`${window.location.origin}/card/${profile.id}`)
        }
      }
    })()
  }, [])

  const owner: CardOwnerInfo = useMemo(() => ({
    ...contact,
    photoUrl,
    backText,
    qrUrl: qrUrl || publicCardUrl || undefined,
  }), [contact, photoUrl, backText, qrUrl, publicCardUrl])

  const agencyDefaults = ctx?.agency

  const patch = (p: Partial<CardBrand>) => {
    setForm((prev) => ({ ...prev, ...p }))
    setSaved(false)
  }

  const handleUploadLogo = async () => {
    if (!logoFile || !ctx?.brokerProfileId) return
    setUploadingLogo(true)
    const res = await uploadCardLogo(logoFile)
    setUploadingLogo(false)
    if ('url' in res) {
      patch({ logoUrl: res.url })
      toast('Logo uploaded — save to keep', 'success')
    } else {
      toast(res.error || 'Logo upload failed', 'error')
    }
    setLogoFile(null)
  }

  const handleUploadPhoto = async () => {
    if (!photoFile) return
    setUploadingPhoto(true)
    try {
      const formData = new FormData()
      formData.append('file', photoFile)
      const res = await authedFetch('/api/broker/upload-photo', { method: 'POST', body: formData })
      const json = await res.json()
      if (json.ok) {
        setPhotoUrl(json.url)
        toast('Photo uploaded — save to keep', 'success')
      } else {
        toast(json.error || 'Photo upload failed', 'error')
      }
    } catch {
      toast('Photo upload failed', 'error')
    } finally {
      setUploadingPhoto(false)
      setPhotoFile(null)
    }
  }

  const save = async () => {
    if (!ctx?.brokerProfileId) {
      toast('No broker profile linked yet', 'error')
      return
    }
    setBusy(true)

    // Build vCard + persist content fields on broker_profiles.
    const qrTarget = qrUrl || publicCardUrl || ''
    const vcard = generateVCardString({
      firstName: (contact.name || '').split(' ')[0] || 'Broker',
      lastName: (contact.name || '').split(' ').slice(1).join(' ') || '',
      phone: contact.phone, email: contact.email, company: contact.company,
      title: contact.title, website: contact.website, note: backText || undefined,
      photoUrl, qrUrl: qrTarget,
    })

    const supabase = (await import('@/lib/supabase/client')).supabase
    const { error: contentErr } = await supabase
      .from('broker_profiles')
      .update({
        photo_url: photoUrl,
        back_text: backText,
        qr_code_url: qrTarget || null,
        vcard_data: { version: '3.0', fn: contact.name, tel: contact.phone, email: contact.email, org: contact.company, title: contact.title, url: contact.website, note: backText, qrUrl: qrTarget },
      })
      .eq('id', ctx.brokerProfileId)

    const overrides: Partial<BrokerCardOverrides> = {
      primaryColor: form.primaryColor === agencyDefaults?.primaryColor ? null : form.primaryColor,
      secondaryColor: form.secondaryColor === agencyDefaults?.secondaryColor ? null : form.secondaryColor,
      accentColor: form.accentColor === agencyDefaults?.accentColor ? null : form.accentColor,
      font: form.font === agencyDefaults?.font ? null : form.font,
      logoUrl: form.logoUrl === agencyDefaults?.logoUrl ? null : form.logoUrl,
      layout: form.layout,
    }
    const ok = await saveBrokerCardOverrides(ctx.brokerProfileId, overrides)

    setBusy(false)
    if (ok && !contentErr) {
      setSaved(true)
      toast(`Card saved${publicCardUrl ? ` — public at ${publicCardUrl}` : ''}`, 'success')
    } else {
      toast('Save failed', 'error')
    }
  }

  if (!ctx) {
    return (
      <div style={S.card}>
        <div style={{ color: 'var(--muted)', fontSize: 14 }}>Loading card settings…</div>
      </div>
    )
  }

  const dragProps = {
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      const f = e.dataTransfer.files?.[0]
      if (f) setPhotoFile(f)
    },
  }

  return (
    <ToastProvider>
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', fontFamily: 'Georgia, serif' }}>Business Card</div>
          {publicCardUrl && (
            <a href={publicCardUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--gold-dark)', textDecoration: 'underline' }}>
              View public card ↗
            </a>
          )}
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>
          Photos, custom back text, and a QR code that saves your contact. Preview updates in real time.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems: 'start', marginTop: 16 }}>
          {/* Left: controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Contact text */}
            <div>
              <div style={S.section}>Contact Info</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {([
                  ['name', 'Full name'], ['title', 'Title'], ['company', 'Company'],
                  ['phone', 'Phone'], ['email', 'Email'], ['website', 'Website'],
                ] as const).map(([f, label]) => (
                  <div key={f} style={S.field}>
                    <span style={S.label}>{label}</span>
                    <input value={contact[f]} onChange={(e) => { setContact((p) => ({ ...p, [f]: e.target.value })); setSaved(false); }} style={S.input} />
                  </div>
                ))}
              </div>
            </div>

            {/* Photo */}
            <div>
              <div style={S.section}>Photo</div>
              <div {...dragProps} style={{ border: '2px dashed var(--line)', borderRadius: 10, padding: 14, textAlign: 'center', background: '#fff' }}>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} style={{ fontSize: 12 }} />
                <button onClick={handleUploadPhoto} disabled={!photoFile || uploadingPhoto} style={{ marginLeft: 10, padding: '8px 14px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: photoFile ? 'pointer' : 'not-allowed', opacity: photoFile ? 1 : 0.5 }}>
                  {uploadingPhoto ? 'Uploading…' : 'Upload photo (≤2MB)'}
                </button>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>or drag &amp; drop · JPG / PNG / WebP</div>
                {photoUrl && (
                  <div style={{ marginTop: 8 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoUrl} alt="headshot" style={{ height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--gold)' }} />
                    <button onClick={() => { setPhotoUrl(null); setSaved(false); }} style={{ marginLeft: 10, fontSize: 12, color: '#b00020', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                      Remove
                    </button>
                  </div>
                )}
              </div>
              <div style={{ ...S.field, marginTop: 10 }}>
                <span style={S.label}>Photo position</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {PHOTO_POSITIONS.map((p) => (
                    <button key={p.id} onClick={() => { setPhotoPosition(p.id); setSaved(false); }} style={{ padding: '7px 14px', borderRadius: 6, border: photoPosition === p.id ? '2px solid var(--gold)' : '1px solid var(--line)', background: photoPosition === p.id ? 'rgba(201,168,76,0.12)' : '#fff', fontWeight: 600, cursor: 'pointer', color: 'var(--navy)' }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Colors */}
            <div>
              <div style={S.section}>Brand Colors</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <ColorField label="Primary" value={form.primaryColor} agencyDefault={agencyDefaults?.primaryColor || '#1a1a2e'} onValue={(v) => patch({ primaryColor: v })} onClear={() => { if (ctx.brokerProfileId) clearBrokerCardOverride(ctx.brokerProfileId, 'primaryColor'); patch({ primaryColor: agencyDefaults?.primaryColor || '#1a1a2e' }); }} />
                <ColorField label="Secondary" value={form.secondaryColor} agencyDefault={agencyDefaults?.secondaryColor || '#16213e'} onValue={(v) => patch({ secondaryColor: v })} onClear={() => { if (ctx.brokerProfileId) clearBrokerCardOverride(ctx.brokerProfileId, 'secondaryColor'); patch({ secondaryColor: agencyDefaults?.secondaryColor || '#16213e' }); }} />
                <ColorField label="Accent" value={form.accentColor} agencyDefault={agencyDefaults?.accentColor || '#c9a84c'} onValue={(v) => patch({ accentColor: v })} onClear={() => { if (ctx.brokerProfileId) clearBrokerCardOverride(ctx.brokerProfileId, 'accentColor'); patch({ accentColor: agencyDefaults?.accentColor || '#c9a84c' }); }} />
                <div style={S.field}>
                  <span style={S.label}>Layout</span>
                  <select value={form.layout} onChange={(e) => patch({ layout: e.target.value as CardLayout })} style={S.input}>
                    {CARD_LAYOUTS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Font */}
            <div>
              <div style={S.section}>Font</div>
              <select value={form.font} onChange={(e) => patch({ font: e.target.value })} style={S.input}>
                {FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>

            {/* Logo */}
            <div>
              <div style={S.section}>Logo</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} style={{ fontSize: 12 }} />
                <button onClick={handleUploadLogo} disabled={!logoFile || uploadingLogo} style={{ padding: '8px 14px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: logoFile ? 'pointer' : 'not-allowed', opacity: logoFile ? 1 : 0.5 }}>
                  {uploadingLogo ? 'Uploading…' : 'Upload logo'}
                </button>
                {form.logoUrl && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.logoUrl} alt="logo preview" style={{ height: 34, borderRadius: 4, background: '#fff', padding: 2 }} />
                    <button onClick={() => { patch({ logoUrl: null }); if (ctx.brokerProfileId) clearBrokerCardOverride(ctx.brokerProfileId, 'logoUrl'); }} style={{ fontSize: 12, color: '#b00020', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Back text + QR */}
            <div>
              <div style={S.section}>Back of Card</div>
              <div style={S.field}>
                <span style={S.label}>Custom back text ({backText.length}/500)</span>
                <textarea value={backText} maxLength={500} onChange={(e) => { setBackText(e.target.value); setSaved(false); }} style={S.textarea} placeholder="e.g. Let's connect — buying or selling a business, I'm here to help you navigate every step." />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
                <div style={S.field}>
                  <span style={S.label}>QR style</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {QR_STYLES.map((q) => (
                      <button key={q.id} onClick={() => { setQrStyle(q.id); setSaved(false); }} style={{ padding: '6px 10px', borderRadius: 6, border: qrStyle === q.id ? '2px solid var(--gold)' : '1px solid var(--line)', background: qrStyle === q.id ? 'rgba(201,168,76,0.12)' : '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 11.5, color: 'var(--navy)' }}>
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={S.field}>
                  <span style={S.label}>QR links to (optional URL)</span>
                  <input value={qrUrl} onChange={(e) => { setQrUrl(e.target.value); setSaved(false); }} style={S.input} placeholder="https://… or your public card" />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button onClick={save} disabled={busy} style={{ padding: '11px 22px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, opacity: busy ? 0.6 : 1 }}>
                {busy ? 'Saving…' : 'Save card'}
              </button>
              {saved && <span style={{ color: '#1e7e34', fontSize: 13, fontWeight: 600 }}>✓ Saved</span>}
            </div>
          </div>

          {/* Right: live preview front/back */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', marginTop: 4 }}>
            <div style={S.section}>Live Preview — Front</div>
            <BusinessCardPreview brand={form} owner={owner} front photoPosition={photoPosition} qrStyle={qrStyle} />
            <div style={S.section}>Back — flip to test QR</div>
            <BusinessCardPreview brand={form} owner={owner} front={false} qrStyle={qrStyle} />
          </div>
        </div>
      </div>
    </ToastProvider>
  )
}
