'use client'

// ---------------------------------------------------------------------------
// BusinessCardPreview — live preview of a broker's business card using the
// effective brand (colors, font, logo, layout) plus photo, custom back text,
// and a QR code. Renders at a standard 3.5x2in ratio either side, re-renders
// in real time as settings change. Pure presentational — no data fetching.
// ---------------------------------------------------------------------------

import type { CardBrand } from '@/lib/branding'
import { fontCss } from '@/lib/branding'
import QRCanvas from '@/components/training/QRCanvas'

export type PhotoPosition = 'top' | 'center' | 'bottom'
export type QrStyle = 'classic' | 'rounded' | 'modern'

export interface CardOwnerInfo {
  name: string
  title: string
  company?: string
  phone?: string
  email?: string
  website?: string
  photoUrl?: string | null
  backText?: string
  qrUrl?: string
  address?: string
}

const RATIO = 3.5 / 2 // standard business card ratio

/** Sizing: preview width in CSS px; height derived from ratio. */
export function cardSize(width: number): { width: number; height: number } {
  return { width, height: Math.round(width / RATIO) }
}

export default function BusinessCardPreview({
  brand,
  owner,
  front = true,
  width = 340,
  photoPosition = 'top',
  qrStyle = 'classic',
  showQr = true,
  interactive = false,
}: {
  brand: CardBrand
  owner: CardOwnerInfo
  front?: boolean
  width?: number
  photoPosition?: PhotoPosition
  qrStyle?: QrStyle
  /** Whether to render the real QR canvas (interactive) vs a placeholder glyph. */
  showQr?: boolean
  /** Enable the 3D flip for the interactive settings preview. */
  interactive?: boolean
}) {
  const { primaryColor, secondaryColor, accentColor, font, logoUrl, layout } = brand
  const ff = fontCss(font)
  const { width: w, height: h } = cardSize(width)
  const photo = owner.photoUrl

  const cardStyle: React.CSSProperties = {
    width: w,
    height: h,
    borderRadius: width < 200 ? 8 : 12,
    overflow: 'hidden',
    background: front ? primaryColor : secondaryColor,
    color: '#fff',
    fontFamily: ff,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 8px 28px rgba(26,26,46,0.22)',
    border: `1px solid ${adjust(primaryColor, -16)}`,
    boxSizing: 'border-box',
  }

  // ---- BACK SIDE ------------------------------------------------------------
  if (!front) {
    return (
      <div style={cardStyle}>
        <div style={{ height: 6, background: `linear-gradient(90deg, ${accentColor}, ${adjust(accentColor, 24)})`, flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', textAlign: 'center', padding: '12px 16px', gap: 6, overflow: 'hidden' }}>
          <div style={{ fontSize: w * 0.055, fontWeight: 800, letterSpacing: 1, color: accentColor, marginTop: 4 }}>
            {owner.company || 'CONCORD'}
          </div>

          {/* Custom back text */}
          {owner.backText ? (
            <div style={{ fontSize: w * 0.036, opacity: 0.9, lineHeight: 1.35, maxHeight: h * 0.4, overflow: 'hidden' }}>
              {owner.backText}
            </div>
          ) : (
            <div style={{ fontSize: w * 0.032, opacity: 0.6, letterSpacing: 0.5 }}>
              Business Brokerage
            </div>
          )}

          {/* QR code */}
          {showQr && owner.qrUrl && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: '#fff', borderRadius: 8, padding: 4, marginBottom: 6 }}>
              <QRCanvas value={owner.qrUrl} size={Math.round(w * 0.3)} />
              <span style={{ fontSize: 7, color: '#666', fontWeight: 600 }}>
                Scan to save contact
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ---- FRONT SIDE -----------------------------------------------------------
  // Optional layout on photo position: when a photo exists and layout is
  // classic/split, place it top/center/bottom relative to the text block.
  const contact = [
    owner.phone && `📞 ${owner.phone}`,
    owner.email && `✉️ ${owner.email}`,
    owner.website && `🌐 ${owner.website}`,
    owner.address && `📍 ${owner.address}`,
  ].filter(Boolean).join('  ·  ')

  const photoCircle = photo && (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo}
      alt="broker"
      style={{
        width: Math.round(w * 0.3), height: Math.round(w * 0.3),
        borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
        border: `2px solid ${accentColor}`,
        boxShadow: `0 0 0 3px ${adjust(accentColor, -20)}66`,
      }}
    />
  )

  const textBlock = (
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{ fontSize: w * 0.056, fontWeight: 700, letterSpacing: 0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {owner.name || 'Your Name'}
      </div>
      <div style={{ fontSize: w * 0.036, color: accentColor, fontWeight: 600, marginTop: 2 }}>
        {owner.title || 'Business Broker'}
      </div>
      <div style={{ fontSize: w * 0.032, opacity: 0.75, marginTop: 4 }}>
        {owner.company || 'Concord Deal Platform'}
      </div>
      {contact && <div style={{ fontSize: w * 0.024, opacity: 0.85, marginTop: 6, lineHeight: 1.5 }}>{contact}</div>}
    </div>
  )

  return (
    <div style={cardStyle}>
      <div style={{ height: 6, background: `linear-gradient(90deg, ${accentColor}, ${adjust(accentColor, 24)})`, flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px 16px', gap: 8, boxSizing: 'border-box', overflow: 'hidden' }}>
        {/* Header row: name/title + logo */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: w * 0.058, fontWeight: 700, letterSpacing: 0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {owner.name || 'Your Name'}
            </div>
            <div style={{ fontSize: w * 0.038, color: accentColor, fontWeight: 600, marginTop: 2 }}>
              {owner.title || 'Business Broker'}
            </div>
            <div style={{ fontSize: w * 0.032, opacity: 0.75, marginTop: 4 }}>
              {owner.company || 'Concord Deal Platform'}
            </div>
          </div>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="logo" style={{ width: 44, height: 44, objectFit: 'contain', flexShrink: 0, borderRadius: 6, background: 'rgba(255,255,255,0.14)' }} />
          ) : (
            <div style={{ width: 42, height: 42, flexShrink: 0, borderRadius: 6, background: accentColor, color: primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800 }}>
              {(owner.company || 'C').slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        {/* Photo + text by position */}
        <div style={{ flex: 1, display: 'flex', flexDirection: photoPosition === 'center' ? 'column' : 'row', alignItems: photoPosition === 'center' ? 'center' : 'flex-start', gap: 10, minHeight: 0 }}>
          {photoPosition === 'top' && photo && photoCircle}
          <div style={{ display: 'flex', alignItems: photoPosition === 'top' && photo ? 'center' : 'flex-start', gap: 10, minWidth: 0, flex: 1 }}>
            {textBlock}
            {(photoPosition === 'bottom') && photo && photoCircle}
          </div>
        </div>

        <div style={{ marginTop: 'auto', fontSize: w * 0.024, opacity: 0.85, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {owner.phone && <span>📞 {owner.phone}</span>}
          {owner.email && <span>✉️ {owner.email}</span>}
          {owner.website && <span>🌐 {owner.website}</span>}
        </div>
      </div>
    </div>
  )
}

/** Lighten/darken a #rrggbb color by a signed amount (-255..255). */
function adjust(hex: string, amt: number): string {
  const h = hex.replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return hex
  const n = parseInt(h, 16)
  const r = clamp(((n >> 16) & 255) + amt)
  const g = clamp(((n >> 8) & 255) + amt)
  const b = clamp((n & 255) + amt)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
function clamp(v: number): number {
  return Math.max(0, Math.min(255, v))
}
