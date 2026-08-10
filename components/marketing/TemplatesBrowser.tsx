'use client'

// =============================================================================
// TemplatesBrowser — marketing design templates. Grid of templates per category;
// clicking "Use template" seeds the design studio with the template design_data
// (brand fields are re-seeded from the broker's saved brand so colors stay
// theirs even when a template ships with a nav/gold default).
// =============================================================================

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CATEGORIES, fetchTemplates, type MarketingTemplate,
  type MarketingCategory, type MarketingProduct, type StudioDesignData,
} from '@/lib/marketing'
import { fetchProduct } from '@/lib/marketing'
import { fetchBrokerBrandContext, resolveBrand } from '@/lib/branding'
import { useToast } from '@/components/ui/Toast'

export default function TemplatesBrowser() {
  const toast = useToast()
  const router = useRouter()
  const [templates, setTemplates] = useState<MarketingTemplate[]>([])
  const [category, setCategory] = useState<MarketingCategory | 'all'>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const t = await fetchTemplates(category === 'all' ? undefined : category)
        setTemplates(t)
      } catch {
        setTemplates([])
      } finally {
        setLoading(false)
      }
    })()
  }, [category])

  const useTemplate = async (tpl: MarketingTemplate) => {
    try {
      // Resolve the product id for this template category so the studio opens with it.
      const product = await resolveProductForCategory(tpl.category)
      if (!product) {
        toast('No product matches this template yet', 'error')
        return
      }
      const ctx = await fetchBrokerBrandContext()
      const brand = ctx ? resolveBrand(ctx) : { primaryColor: '#1a1a2e', secondaryColor: '#16213e', accentColor: '#c9a84c', font: 'georgia', logoUrl: null }
      // Seed the design: template layout/text + broker's live brand.
      const seeded: StudioDesignData = {
        ...tpl.design_data,
        productId: product.id,
        brand: { ...brand, font: brand.font, logoUrl: brand.logoUrl },
        designName: tpl.name,
      }
      // Persist the seeded design so the studio can load it by id.
      const { saveDesign } = await import('@/lib/marketing')
      const saved = await saveDesign({ productId: product.id, designName: tpl.name, designData: seeded })
      router.push(`/dashboard/marketing/design/${product.id}?design=${saved.id}`)
    } catch (e: any) {
      toast(e?.message || 'Could not apply template', 'error')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        <button onClick={() => setCategory('all')} style={chip(category === 'all')}>All</button>
        {CATEGORIES.map((c) => (
          <button key={c.id} onClick={() => setCategory(c.id)} style={chip(category === c.id)}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {loading && <div style={{ color: 'var(--muted)' }}>Loading templates…</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {templates.map((t) => (
          <div key={t.id} style={{ background: 'var(--cream)', border: '1px solid var(--line)', borderRadius: 12, padding: 14 }}>
            <div style={{ height: 80, borderRadius: 8, background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)', fontWeight: 700, fontFamily: 'Georgia, serif', fontSize: 15, marginBottom: 10 }}>
              {t.name}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', fontFamily: 'Georgia, serif' }}>
              {t.name} {t.is_premium && <span style={{ color: 'var(--gold-dark)', fontSize: 11, fontWeight: 800 }}>✦ PREMIUM</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', margin: '6px 0' }}>{t.description}</div>
            <button onClick={() => useTemplate(t)} style={{ width: '100%', padding: '9px', background: 'var(--gold)', color: 'var(--navy)', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
              Use Template
            </button>
          </div>
        ))}
        {!loading && templates.length === 0 && (
          <div style={{ color: 'var(--muted)' }}>No templates in this category yet.</div>
        )}
      </div>
    </div>
  )
}

function chip(active: boolean): React.CSSProperties {
  return {
    padding: '7px 12px', borderRadius: 99, border: '1px solid var(--line)', cursor: 'pointer',
    background: active ? 'var(--navy)' : '#fff', color: active ? '#fff' : 'var(--text)',
    fontWeight: 600, fontSize: 12.5, fontFamily: 'Georgia, serif',
  }
}

async function resolveProductForCategory(category: MarketingCategory): Promise<MarketingProduct | null> {
  const { fetchProducts } = await import('@/lib/marketing')
  const prods = await fetchProducts(category)
  return prods[0] || null
}
