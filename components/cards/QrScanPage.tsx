'use client'

// ---------------------------------------------------------------------------
// QrScanPage — the destination when a card's QR code is scanned (/qr/<brokerId>).
// Loads the broker's card, shows contact info in a navy/gold design, and offers
// one-click "Save to Contacts" (vCard download) plus a link to the full public
// card page. No auth required.
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react'
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

export default function QrScanPage({ brokerId }: { brokerId: string }) {
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
          const q = await qrCodeToDataURL(json.card.qr_code_url || `/qr/${json.card.id}`, { size: 220, style: 'classic' })
          if (q) setQrImg(q)
        } else {
          setNotFound(true)
        }
      } catch {
        setNotFound(true)
      }
    })()
  }, [brokerId])

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
    toast('Contact saved!', 'success')
  }

  if (notFound) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg, #f7f5ee, #e9e6da)', fontFamily: 'Georgia, serif' }}>
        <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📇</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Contact not found</div>
        </div>
      </div>
    )
  }

  if (!card) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontFamily: 'Georgia, serif' }}>Loading…</div>
  }

  const b = card.brand
  return (
    <ToastProvider>
      <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #f7f5ee 0%, #e9e6da 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'Georgia, serif' }}>
        <div style={{ maxWidth: 420, width: '100%', background: '#fff', borderRadius: 20, boxShadow: '0 20px 60px rgba(26,26,46,0.18)', overflow: 'hidden', textAlign: 'center' }}>
          {/* header */}
          <div style={{ background: 'linear-gradient(135deg, var(--navy), var(--navy-2))', color: '#fff', padding: 28 }}>
            {/* avatar or monogram */}
            {card.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.photo_url} alt="broker" style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', border: `3px solid var(--gold)`, margin: '0 auto 12px', display: 'block' }} />
            ) : (
              <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'var(--gold)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, fontWeight: 800, margin: '0 auto 12px' }}>
                {(card.public_name || 'C').slice(0, 1).toUpperCase()}
              </div>
            )}
            <div style={{ fontSize: 24, fontWeight: 800 }}>{card.public_name || 'Broker'}</div>
            <div style={{ color: 'var(--gold)', marginTop: 2, fontSize: 14 }}>{card.title || 'Business Broker'}</div>
            <div style={{ opacity: 0.75, fontSize: 13, marginTop: 6 }}>{card.agency?.name || 'Concord Deal Platform'}</div>
          </div>

          {/* contact detail */}
          <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}>
              {card.phone && (
                <a href={`tel:${card.phone}`} style={{ textDecoration: 'none', color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: 10 }}>📞 <span>{card.phone}</span></a>
              )}
              {card.email_public && (
                <a href={`mailto:${card.email_public}`} style={{ textDecoration: 'none', color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: 10 }}>✉️ <span>{card.email_public}</span></a>
              )}
              {card.website && (
                <a href={card.website.startsWith('http') ? card.website : `https://${card.website}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: 10 }}>🌐 <span>{card.website}</span></a>
              )}
              {card.bio && <div style={{ fontSize: 13, color: 'var(--muted)', borderTop: '1px solid var(--line)', paddingTop: 12 }}>{card.bio}</div>}
            </div>

            {/* actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
              <button onClick={saveContact} style={{ width: '100%', padding: 15, background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 16, cursor: 'pointer' }}>
                📇 Save to Contacts
              </button>
              <a href={`/card/${card.id}`} style={{ width: '100%', padding: 13, background: 'var(--gold)', color: 'var(--navy)', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer', textAlign: 'center', textDecoration: 'none', display: 'block' }}>
                View Full Card
              </a>
              {qrImg && (
                <div style={{ marginTop: 6, display: 'flex', justifyContent: 'center' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrImg} alt="qrcode" style={{ width: 72, height: 72 }} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ToastProvider>
  )
}
