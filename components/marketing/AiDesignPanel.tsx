'use client'

// =============================================================================
// AiDesignPanel — generates design variants via the Claude-backed AI route and
// lets the broker apply one. Seeded by the broker's current brand (colors, font,
// logo) plus product info. Multiple style-variant results shown as static
// preview swatches; clicking one patches the design doc's brand/layout.
// =============================================================================

import { useState } from 'react'
import type { StudioDesignData } from '@/lib/marketing'
import type { MarketingProduct } from '@/lib/marketing'
import { useToast } from '@/components/ui/Toast'
import { buildPreviewStyle, buildPreviewContent } from '@/lib/designer'

interface Variant {
  id: string
  name: string
  layout: string
  brand: StudioDesignData['brand']
  blurb: string
}

export default function AiDesignPanel({
  product,
  design,
  onApply,
}: {
  product: MarketingProduct
  design: StudioDesignData
  onApply: (variant: Variant) => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [variants, setVariants] = useState<Variant[]>([])

  const generate = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/ai/marketing-designs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          productName: product.name,
          category: product.category,
          brand: design.brand,
          brokerName: design.text.name,
          company: design.text.company,
          variantCount: 4,
        }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Generation failed')
      setVariants(json.designs || [])
      toast('Design variants generated', 'success')
    } catch (e: any) {
      toast(e?.message || 'Could not generate designs', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <button
        onClick={generate}
        disabled={busy}
        style={{
          width: '100%', padding: '12px', borderRadius: 8, border: 'none', cursor: busy ? 'not-allowed' : 'pointer',
          background: 'linear-gradient(135deg, var(--gold), var(--gold-dark))', color: 'var(--navy)',
          fontWeight: 800, fontFamily: 'Georgia, serif', fontSize: 14, opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? 'Generating…' : '✨ Generate AI Designs'}
      </button>

      {variants.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.1, color: 'var(--gold-dark)', fontWeight: 700, marginBottom: 8 }}>
            Variants using your brand
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {variants.map((v) => {
              const test: StudioDesignData = { ...design, brand: v.brand, layout: v.layout }
              return (
                <button
                  key={v.id}
                  onClick={() => onApply(v)}
                  style={{
                    textAlign: 'left', background: '#fff', border: '1px solid var(--line)', borderRadius: 10,
                    padding: 10, cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ flexShrink: 0 }}>
                      <svg width="96" height="58" viewBox="0 0 96 58">
                        <rect width="96" height="58" rx="5" fill={v.brand.primaryColor} />
                        <rect width="96" height="4" fill={v.brand.accentColor} />
                        <circle cx="76" cy="24" r="10" fill={v.brand.accentColor} />
                        <rect x="12" y="18" width="52" height="6" rx="3" fill="#fff" opacity="0.9" />
                        <rect x="12" y="27" width="34" height="4" rx="2" fill={v.brand.accentColor} />
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 13.5 }}>{v.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{v.blurb}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted-2)', marginTop: 4, fontFamily: 'monospace' }}>
                        {v.brand.primaryColor} · {v.brand.accentColor} · {v.layout}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
