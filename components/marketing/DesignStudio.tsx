'use client'

// =============================================================================
// DesignStudio — full design canvas for any marketing product.
// Real-time preview, brand color picker (seeded from broker's saved brand),
// font selector, text customization, logo, QR code integration, front/back
// toggle, and save-for-reorder. Loads an existing design when given an id.
// =============================================================================

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  fetchProduct, fetchVariants, getDesign, saveDesign, updateDesign,
  type MarketingProduct, type MarketingVariant, type StudioDesignData,
} from '@/lib/marketing'
import { buildPreviewStyle, buildPreviewContent, blankDesign, previewBox } from '@/lib/designer'
import { FONTS, fontCss, fetchBrokerBrandContext, resolveBrand } from '@/lib/branding'
import { useToast } from '@/components/ui/Toast'
import QRCanvas from '@/components/training/QRCanvas'
import AiDesignPanel from '@/components/marketing/AiDesignPanel'

const S = {
  label: { display: 'block', fontFamily: 'Georgia, serif', fontWeight: 600, color: 'var(--navy)', fontSize: 12.5, marginBottom: 4 } as const,
  input: {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 6,
    border: '1px solid var(--line)', background: '#fff', color: 'var(--text)', fontSize: 13.5,
    fontFamily: 'Georgia, serif', outline: 'none',
  } as React.CSSProperties,
  field: { display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 10 } as React.CSSProperties,
  panel: { background: 'var(--cream)', border: '1px solid var(--line)', borderRadius: 12, padding: 16, marginBottom: 16 } as const,
  sectionTitle: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.1, color: 'var(--gold-dark)', fontWeight: 700, marginBottom: 10 } as const,
}

const LAYOUTS = ['classic', 'minimal', 'modern', 'split']

export default function DesignStudio() {
  const params = useParams<{ productId: string }>()
  const router = useRouter()
  const toast = useToast()
  const productId = params.productId
  const existingId = useMemo(() => (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('design') : null), [])

  const [product, setProduct] = useState<MarketingProduct | null>(null)
  const [variants, setVariants] = useState<MarketingVariant[]>([])
  const [design, setDesign] = useState<StudioDesignData | null>(null)
  const [front, setFront] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const [ctx, p] = await Promise.all([fetchBrokerBrandContext(), fetchProduct(productId)])
        if (!p) {
          setLoadError('Product not found')
          return
        }
        setProduct(p)
        setVariants(await fetchVariants(p.id))

        let base: StudioDesignData | null = null
        if (existingId) {
          const d = await getDesign(existingId)
          if (d?.design_data) base = d.design_data
        }
        if (!base) {
          const brand = ctx ? resolveBrand(ctx) : { primaryColor: '#1a1a2e', secondaryColor: '#16213e', accentColor: '#c9a84c', font: 'georgia', logoUrl: null }
          base = blankDesign({ ...brand, logoUrl: brand.logoUrl }, p.id)
        }
        setDesign(base)
      } catch (e: any) {
        setLoadError(e?.message || 'Failed to load design studio')
      }
    })()
  }, [productId, existingId])

  const patch = (fn: (d: StudioDesignData) => StudioDesignData) => {
    setDesign((prev) => (prev ? fn({ ...prev, sides: front ? 'front' : 'back' }) : prev))
  }
  const patchText = (field: keyof StudioDesignData['text'], value: string) =>
    patch((d) => ({ ...d, text: { ...d.text, [field]: value } }))
  const patchBrand = (field: keyof StudioDesignData['brand'], value: string | null) =>
    patch((d) => ({ ...d, brand: { ...d.brand, [field]: value } }))

  const kind = product?.category || 'business_cards'
  const box = previewBox(kind)

  const handleSave = async () => {
    if (!design || !product) return
    try {
      const name = design.designName || product.name
      if (existingId) {
        await updateDesign(existingId, { design_name: name, design_data: design })
        toast('Design updated', 'success')
      } else {
        await saveDesign({ productId: product.id, designName: name, designData: design, previewUrl: null })
        toast('Design saved — you can reorder it anytime', 'success')
      }
    } catch (e: any) {
      toast(e?.message || 'Save failed', 'error')
    }
  }

  if (loadError) {
    return <div style={{ color: '#b00020' }}>{loadError}</div>
  }
  if (!product || !design) {
    return <div style={{ color: 'var(--muted)' }}>Loading design studio…</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: 'var(--navy)' }}>Design Studio</div>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>{product.name}</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleSave} style={{ padding: '10px 18px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
            Save Design
          </button>
          <button onClick={() => router.push('/dashboard/marketing')} style={{ padding: '10px 18px', background: 'var(--gold)', color: 'var(--navy)', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
            Order →
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 22, alignItems: 'start' }}>
        {/* Controls */}
        <div>
          {/* Sides */}
          <div style={S.panel}>
            <div style={S.sectionTitle}>Side</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setFront(true)} style={sideBtn(front)}>Front</button>
              <button onClick={() => setFront(false)} style={sideBtn(!front)}>Back</button>
            </div>
          </div>

          {/* Brand */}
          <div style={S.panel}>
            <div style={S.sectionTitle}>Brand Colors</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {(['primaryColor', 'secondaryColor', 'accentColor'] as const).map((f) => (
                <div key={f} style={S.field}>
                  <span style={S.label}>{f.replace('Color', ' ').replace(/^\w/, (c) => c.toUpperCase())}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="color" value={design.brand[f]} onChange={(e) => patchBrand(f, e.target.value)} style={{ width: 36, height: 32, border: '1px solid var(--line)', borderRadius: 6, background: '#fff', cursor: 'pointer' }} />
                    <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{design.brand[f]}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={S.field}>
              <span style={S.label}>Font</span>
              <select value={design.brand.font} onChange={(e) => patchBrand('font', e.target.value)} style={S.input}>
                {FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>
            <div style={S.field}>
              <span style={S.label}>Layout</span>
              <select value={design.layout} onChange={(e) => patch((d) => ({ ...d, layout: e.target.value }))} style={S.input}>
                {LAYOUTS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* Text */}
          <div style={S.panel}>
            <div style={S.sectionTitle}>Text</div>
            {([
              ['name', 'Name'], ['title', 'Title'], ['company', 'Company'],
              ['phone', 'Phone'], ['email', 'Email'], ['website', 'Website'],
            ] as const).map(([field, label]) => (
              <div key={field} style={S.field}>
                <span style={S.label}>{label}</span>
                <input value={design.text[field]} onChange={(e) => patchText(field, e.target.value)} style={S.input} />
              </div>
            ))}
            <div style={S.field}>
              <span style={S.label}>Tagline</span>
              <input value={design.text.tagline} onChange={(e) => patchText('tagline', e.target.value)} style={S.input} />
            </div>
          </div>

          {/* QR */}
          <div style={S.panel}>
            <div style={S.sectionTitle}>QR Code</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 8 }}>
              <input type="checkbox" checked={design.qr.enabled} onChange={(e) => patch((d) => ({ ...d, qr: { ...d.qr, enabled: e.target.checked } }))} />
              Show QR code
            </label>
            {design.qr.enabled && (
              <input
                value={design.qr.url}
                onChange={(e) => patch((d) => ({ ...d, qr: { ...d.qr, url: e.target.value } }))}
                placeholder="https://… link to scan"
                style={S.input}
              />
            )}
            {design.qr.enabled && design.qr.url && (
              <div style={{ background: '#fff', padding: 8, borderRadius: 8, display: 'inline-block', marginTop: 8 }}>
                <QRCanvas value={design.qr.url} size={72} />
              </div>
            )}
          </div>

          {/* AI design generator */}
          <div style={S.panel}>
            <div style={S.sectionTitle}>AI Design Generator</div>
            <AiDesignPanel
              product={product}
              design={design}
              onApply={(v) => {
                patch((d) => ({
                  ...d,
                  brand: { ...d.brand, ...v.brand },
                  layout: v.layout,
                }))
                toast(`Applied "${v.name}" — review the live preview`, 'success')
              }}
            />
          </div>
        </div>

        {/* Live preview */}
        <div>
          <div style={S.sectionTitle}>Live Preview — {front ? 'Front' : 'Back'}</div>
          <div
            style={{
              ...buildPreviewStyle(design, kind, front),
              width: Math.min(box.width, 420),
              height: Math.min(box.height * (420 / box.width), 420),
            }}
          >
            {buildPreviewContent(design, kind, front)}
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 10 }}>
            Preview reflects your saved brand colors, font, and logo in real time.
          </div>
        </div>
      </div>
    </div>
  )
}

function sideBtn(active: boolean): React.CSSProperties {
  return {
    flex: 1, padding: '9px', borderRadius: 6, border: active ? '2px solid var(--gold)' : '1px solid var(--line)',
    background: active ? 'rgba(201,168,76,0.12)' : '#fff', fontWeight: 700, cursor: 'pointer',
    fontFamily: 'Georgia, serif', color: 'var(--navy)',
  }
}
