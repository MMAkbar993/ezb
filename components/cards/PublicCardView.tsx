'use client'

// ---------------------------------------------------------------------------
// PublicCardView — shared public business card page (/card/<brokerId>).
// Loads the broker's card via the public API (no auth), renders a professional
// navy/gold business card (front + back with QR), offers "Save contact" (vCard
// download) and "Download QR", and includes print-ready 3.5x2in layouts with
// bleed guides via @media print.
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react'
import BusinessCardPreview, { type CardOwnerInfo } from '@/components/cards/BusinessCardPreview'
import type { CardBrand } from '@/lib/branding'
import { generateVCardString, urlToBase64, vcfDownloadUrl } from '@/lib/vcard'
import { qrCodeToDataURL } from '@/lib/qr'
import { useToast, ToastProvider } from '@/components/ui/Toast'

interface CardData {
  id: string
  public_name: string
  title: string
  bio: string | null
  phone: string
  email_public: string
  website: string
  photo_url: string | null
  back_text: string | null
  qr_code_url: string | null
  brand: {
    primaryColor: string
    secondaryColor: string
    accentColor: string
    font: string
    logoUrl: string | null
    layout: string
  }
  agency: { id: string; name: string } | null
}

export default function PublicCardView({ brokerId }: { brokerId: string }) {
  const toast = useToast()
  const [card, setCard] = useState<CardData | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [qrImg, setQrImg] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/broker/card?brokerId=${brokerId}`)
        const json = await res.json()
        if (json.ok) {
          setCard(json.card)
          const q = await qrCodeToDataURL(json.card.qr_code_url || `/qr/${json.card.id}`, { size: 280, style: 'classic' })
          if (q) setQrImg(q)
        } else {
          setNotFound(true)
        }
      } catch {
        setNotFound(true)
      }
    })()
  }, [brokerId])

  const owner: CardOwnerInfo = card ? {
    name: card.public_name || 'Broker',
    title: card.title || 'Business Broker',
    company: card.agency?.name || 'Concord Deal Platform',
    phone: card.phone || '',
    email: card.email_public || '',
    website: card.website || '',
    photoUrl: card.photo_url,
    backText: card.back_text || '',
    qrUrl: card.qr_code_url || `/qr/${card.id}`,
  } : { name: '', title: '', company: '' }

  // Normalize brand.layout to a valid CardLayout (JSON from API is untyped).
  const cardBrand: CardBrand = {
    primaryColor: card.brand.primaryColor,
    secondaryColor: card.brand.secondaryColor,
    accentColor: card.brand.accentColor,
    font: card.brand.font,
    logoUrl: card.brand.logoUrl,
    layout: (['classic', 'minimal', 'modern', 'split'] as const).includes(card.brand.layout as CardBrand['layout'])
      ? (card.brand.layout as CardBrand['layout'])
      : 'classic',
  }

  const saveContact = async () => {
    if (!card) return
    const photoB64 = card.photo_url ? await urlToBase64(card.photo_url) : null
    const vcf = generateVCardString({
      firstName: (card.public_name || '').split(' ')[0] || 'Broker',
      lastName: (card.public_name || '').split(' ').slice(1).join(' ') || '',
      phone: card.phone, email: card.email_public, company: card.agency?.name || '',
      title: card.title || '', website: card.website || '',
      note: card.back_text || undefined, photoUrl: card.photo_url,
      qrUrl: card.qr_code_url || `/qr/${card.id}`,
    }, photoB64)
    const url = vcfDownloadUrl(vcf)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(card.public_name || 'broker').replace(/\s+/g, '_')}.vcf`
    a.click()
    toast('Contact saved to your phone', 'success')
  }

  const downloadQr = async () => {
    if (!card) return
    const q = await qrCodeToDataURL(card.qr_code_url || `/qr/${card.id}`, { size: 600, style: 'classic' })
    if (!q) return toast('Could not generate QR', 'error')
    const a = document.createElement('a')
    a.href = q
    a.download = `${(card.public_name || 'broker').replace(/\s+/g, '_')}_qr.png`
    a.click()
    toast('QR downloaded', 'success')
  }

  if (notFound) {
    return (
      <div style={{ padding: 80, textAlign: 'center', fontFamily: 'Georgia, serif', color: 'var(--muted)' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🃏</div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Card not found</div>
        <div style={{ marginTop: 6, fontSize: 14 }}>This business card link is invalid or unavailable.</div>
      </div>
    )
  }

  if (!card) {
    return <div style={{ padding: 80, textAlign: 'center', color: 'var(--muted)' }}>Loading card…</div>
  }

  return (
    <ToastProvider>
      <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #f7f5ee 0%, #e9e6da 100%)', padding: '40px 20px', fontFamily: 'Georgia, serif' }}>
        <div className="no-print" style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--navy)', marginBottom: 4 }}>{card.public_name || 'Contact'}</div>
          <div style={{ color: 'var(--gold-dark)', fontWeight: 700, marginBottom: 8 }}>{card.title || 'Business Broker'} · {card.agency?.name || 'Concord'}</div>
          {card.bio && <p style={{ color: 'var(--muted)', fontSize: 14, maxWidth: 520, margin: '0 auto 20px' }}>{card.bio}</p>}

          {/* Live card */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <div className="print-card">
              <BusinessCardPreview brand={cardBrand} owner={owner} front width={360} photoPosition="top" />
            </div>
            <div className="print-card">
              <BusinessCardPreview brand={cardBrand} owner={owner} front={false} width={360} showQr={!!card.qr_code_url} />
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 26 }}>
            <button onClick={saveContact} style={{ padding: '13px 24px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: 15 }}>
              📇 Save Contact
            </button>
            <button onClick={downloadQr} style={{ padding: '13px 24px', background: 'var(--gold)', color: 'var(--navy)', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: 15 }}>
              ⬇️ Download QR
            </button>
            <button onClick={() => window.print()} className="no-print" style={{ padding: '13px 24px', background: 'transparent', color: 'var(--navy)', border: '1px solid var(--navy)', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: 15 }}>
              🖨️ Print
            </button>
          </div>
        </div>

        <style>{`
          @media print {
            body { background: #fff !important; }
            .no-print { display: none !important; }
            .print-card { margin: 0 auto; page-break-after: always; }
            .print-card { transform: scale(1); width: 3.5in !important; height: 2in !important; }
            /* bleed guide marker */
            .print-card::after {
              content: ''; position: absolute; inset: -0.125in;
              border: 1px dashed #ccc; pointer-events: none;
            }
          }
          @media screen {
            .print-card { position: relative; }
          }
        `}</style>
      </div>
    </ToastProvider>
  )
}
