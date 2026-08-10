'use client'

// =============================================================================
// Marketing Design Studio — pure helpers for building real-time previews.
// -----------------------------------------------------------------------------
// Renders a preview of any product design from its StudioDesignData, applying
// the broker's brand (colors, font, logo), custom text, layout, and optional QR
// code. Layout-agnostic helper functions keep every product type renderable
// from one design doc. No direct Supabase access — unit-testable and shared by
// the studio, templates, and the storefront.
// =============================================================================

import type { StudioDesignData } from '@/lib/marketing'
import { fontCss, type CardLayout } from '@/lib/branding'

/** Comfortable CSS sizing buckets per product category (unit: px). */
export function previewBox(kind: string): { width: number; height: number } {
  switch (kind) {
    case 'business_cards': return { width: 300, height: 180 }
    case 'banners': return { width: 240, height: 420 }
    case 'postcards': return { width: 320, height: 256 }
    case 'flyers': return { width: 300, height: 200 }
    case 'signage': return { width: 260, height: 340 }
    case 'apparel': return { width: 260, height: 300 }
    case 'stationery': return { width: 340, height: 240 }
    case 'brochures': return { width: 320, height: 220 }
    case 'envelopes': return { width: 340, height: 240 }
    case 'promo': return { width: 280, height: 180 }
    default: return { width: 300, height: 200 }
  }
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, v))
}
function shift(hex: string, amt: number): string {
  const h = (hex || '#1a1a2e').replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return hex
  const n = parseInt(h, 16)
  const r = clamp(((n >> 16) & 255) + amt)
  const g = clamp(((n >> 8) & 255) + amt)
  const b = clamp((n & 255) + amt)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'C'
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Returns inline styles for a full design preview. This is the single source of
 * truth for how a saved design looks — consumers render a <div> with these
 * styles. `front` selects which side to show.
 */
export function buildPreviewStyle(d: StudioDesignData, kind: string, front: boolean): React.CSSProperties {
  const box = previewBox(kind)
  const b = d.brand
  const ff = fontCss(b.font)
  const base: React.CSSProperties = {
    width: box.width,
    height: box.height,
    borderRadius: 10,
    overflow: 'hidden',
    background: front ? b.primaryColor : b.secondaryColor,
    color: '#fff',
    fontFamily: ff,
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 8px 28px rgba(26,26,46,0.22)',
    position: 'relative',
    boxSizing: 'border-box',
  }
  return base
}

/** Renders the inner content of a preview (shared by React consumers). */
export function buildPreviewContent(d: StudioDesignData, kind: string, front: boolean): React.ReactNode {
  const b = d.brand
  const t = d.text
  const ff = fontCss(b.font)
  const logo = b.logoUrl

  // Accent rule
  const rule = (
    <div style={{ height: 6, background: `linear-gradient(90deg, ${b.accentColor}, ${shift(b.accentColor, 24)})`, flexShrink: 0 }} />
  )

  if (!front) {
    // Back: brand monogram / company mark
    return (
      <>
        {rule}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 8, padding: 16 }}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="logo" style={{ maxWidth: 90, maxHeight: 50, objectFit: 'contain' }} />
          ) : (
            <div style={{ width: 54, height: 54, borderRadius: '50%', background: b.accentColor, color: b.primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800 }}>
              {initials(t.company || 'Concord')}
            </div>
          )}
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 1, color: b.accentColor }}>{t.company || 'Concord'}</div>
          <div style={{ fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.7 }}>
            {kind === 'business_cards' ? 'Business Brokerage' : 'Marketing Materials'}
          </div>
          {d.qr.enabled && d.qr.url && (
            <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>Scan to connect →</div>
          )}
        </div>
      </>
    )
  }

  // Front layout variants
  const layout = (d.layout || 'classic') as CardLayout
  const contact = [
    t.phone && `📞 ${t.phone}`,
    t.email && `✉️ ${t.email}`,
    t.website && `🌐 ${t.website}`,
  ].filter(Boolean).join('  ·  ')

  return (
    <>
      {rule}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '14px 16px', boxSizing: 'border-box', position: 'relative' }}>

        {layout === 'minimal' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 4 }}>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 0.3 }}>{t.name || 'Your Name'}</div>
            <div style={{ fontSize: 11.5, color: b.accentColor, fontWeight: 600 }}>{t.title || 'Business Broker'}</div>
            {contact && <div style={{ fontSize: 10, opacity: 0.8, marginTop: 8 }}>{contact}</div>}
          </div>
        )}

        {layout === 'modern' && (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
            <div style={{ width: 4, alignSelf: 'stretch', background: b.accentColor, borderRadius: 2 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.3 }}>{t.name || 'Your Name'}</div>
              <div style={{ fontSize: 11, color: b.accentColor, fontWeight: 600 }}>{t.title || 'Business Broker'}</div>
              <div style={{ fontSize: 10, opacity: 0.8 }}>{t.company || 'Concord'}</div>
              {contact && <div style={{ fontSize: 9.5, opacity: 0.8, marginTop: 4 }}>{contact}</div>}
            </div>
          </div>
        )}

        {(layout === 'classic' || layout === 'split') && (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 19, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {t.name || 'Your Name'}
                </div>
                <div style={{ fontSize: 11.5, color: b.accentColor, fontWeight: 600, marginTop: 2 }}>{t.title || 'Business Broker'}</div>
                <div style={{ fontSize: 10.5, opacity: 0.75, marginTop: 4 }}>{t.company || 'Concord'}</div>
                {(t.headline || t.tagline) && (
                  <div style={{ fontSize: 9.5, opacity: 0.65, marginTop: 4 }}>{t.tagline || t.headline}</div>
                )}
              </div>
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="logo" style={{ width: 44, height: 44, objectFit: 'contain', flexShrink: 0, borderRadius: 6, background: 'rgba(255,255,255,0.14)' }} />
              ) : (
                <div style={{ width: 42, height: 42, flexShrink: 0, borderRadius: 6, background: b.accentColor, color: b.primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18 }}>
                  {initials(t.company || 'C')}
                </div>
              )}
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: 10, opacity: 0.85, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {t.address && <span>{t.address}</span>}
              {contact && <span>{contact}</span>}
            </div>
          </>
        )}

        {d.qr.enabled && d.qr.url && (
          <div style={{ position: 'absolute', right: 12, bottom: 10, fontSize: 8.5, opacity: 0.7, textAlign: 'center' }}>
            <span style={{ fontSize: 20 }}>{'▦'}</span>
            <div>QR</div>
          </div>
        )}
      </div>
    </>
  )
}

/** Tiny CSS-in-JS: the full preview div style + inner content as one. */
export function buildPreview(
  d: StudioDesignData,
  kind: string,
  front: boolean,
): { style: React.CSSProperties; content: React.ReactNode } {
  return { style: buildPreviewStyle(d, kind, front), content: buildPreviewContent(d, kind, front) }
}

/** Default blank design doc seeded with the broker's brand (passed in). */
export function blankDesign(seed: {
  primaryColor: string
  secondaryColor: string
  accentColor: string
  font: string
  logoUrl: string | null
}, productId: string, contact?: Partial<StudioDesignData['text']>): StudioDesignData {
  return {
    productId,
    designName: 'Untitled design',
    brand: {
      primaryColor: seed.primaryColor,
      secondaryColor: seed.secondaryColor,
      accentColor: seed.accentColor,
      font: seed.font,
      logoUrl: seed.logoUrl,
    },
    text: {
      headline: contact?.headline || '',
      tagline: contact?.tagline || 'Trusted Business Brokerage',
      name: contact?.name || 'Your Name',
      title: contact?.title || 'Business Broker',
      company: contact?.company || 'Concord Deal Platform',
      phone: contact?.phone || '(555) 123-4567',
      email: contact?.email || 'you@concordplatform.com',
      website: contact?.website || 'concordplatform.com',
      address: contact?.address || '',
      body: contact?.body || '',
    },
    sides: 'front',
    qr: { enabled: false, url: '' },
    variantSelections: {},
    layout: 'classic',
  }
}
