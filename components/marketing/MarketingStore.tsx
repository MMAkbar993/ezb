'use client'

// =============================================================================
// MarketingStore — full storefront. Category filter, product grid, and a
// product detail panel with customization (variants + quantity) and add-to-cart.
// Fetches catalog from Supabase. Real-time preview sits in the design studio.
// =============================================================================

import { useEffect, useMemo, useState } from 'react'
import {
  CATEGORIES, fetchProducts, fetchVariants,
  type MarketingCategory, type MarketingProduct, type MarketingVariant,
} from '@/lib/marketing'
import { useCart } from '@/components/marketing/CartContext'
import { useToast } from '@/components/ui/Toast'
import Link from 'next/link'

const S = {
  label: { display: 'block', fontFamily: 'Georgia, serif', fontWeight: 600, color: 'var(--navy)', fontSize: 13, marginBottom: 4 } as const,
  input: {
    width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 6,
    border: '1px solid var(--line)', background: '#fff', color: 'var(--text)', fontSize: 14,
    fontFamily: 'Georgia, serif', outline: 'none',
  } as React.CSSProperties,
  field: { display: 'flex', flexDirection: 'column', gap: 4 } as React.CSSProperties,
}

export default function MarketingStore() {
  const toast = useToast()
  const { addItem } = useCart()
  const [products, setProducts] = useState<MarketingProduct[]>([])
  const [activeCategory, setActiveCategory] = useState<MarketingCategory | 'all'>('all')
  const [loading, setLoading] = useState(true)

  // modal selection state
  const [selected, setSelected] = useState<MarketingProduct | null>(null)
  const [variants, setVariants] = useState<MarketingVariant[]>([])
  const [variantSelections, setVariantSelections] = useState<Record<string, string>>({})
  const [quantity, setQuantity] = useState(100)

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const prods = await fetchProducts(activeCategory === 'all' ? undefined : activeCategory)
        setProducts(prods)
      } catch {
        toast('Could not load products', 'error')
      } finally {
        setLoading(false)
      }
    })()
  }, [activeCategory, toast])

  const openProduct = async (p: MarketingProduct) => {
    setSelected(p)
    setQuantity(p.category === 'apparel' ? 1 : 100)
    const v = await fetchVariants(p.id)
    setVariants(v)
    const init: Record<string, string> = {}
    // pre-select first variant of each type
    const seen = new Set<string>()
    for (const vv of v) {
      if (!seen.has(vv.variant_type)) {
        seen.add(vv.variant_type)
        init[vv.variant_type] = vv.id
      }
    }
    setVariantSelections(init)
  }

  const grouped = useMemo(() => {
    if (activeCategory !== 'all') return null
    return CATEGORIES.map((c) => ({
      ...c,
      items: products.filter((p) => p.category === c.id),
    })).filter((c) => c.items.length > 0)
  }, [products, activeCategory])

  const addToCart = () => {
    if (!selected) return
    addItem(selected, variants, quantity, variantSelections)
    toast(`${selected.name} added to cart`, 'success')
    setSelected(null)
  }

  const unitPrice = () => {
    if (!selected) return 0
    let base = Number(selected.base_price || 0)
    for (const v of variants) {
      if (Object.values(variantSelections).includes(v.id)) base += Number(v.price_adjustment || 0)
    }
    return Math.max(0, base)
  }

  return (
    <div>
      {/* Category filter */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        <button
          onClick={() => setActiveCategory('all')}
          style={chipStyle(activeCategory === 'all')}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button key={c.id} onClick={() => setActiveCategory(c.id)} style={chipStyle(activeCategory === c.id)}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {loading && <div style={{ color: 'var(--muted)' }}>Loading catalog…</div>}

      {/* Grid */}
      {!loading && grouped && (
        grouped.map((cat) => (
          <div key={cat.id} style={{ marginBottom: 26 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: 'var(--navy)', marginBottom: 12 }}>
              {cat.icon} {cat.label}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
              {cat.items.map((p) => (
                <ProductCard key={p.id} p={p} onOpen={() => openProduct(p)} />
              ))}
            </div>
          </div>
        ))
      )}

      {!loading && !grouped && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {products.map((p) => (
            <ProductCard key={p.id} p={p} onOpen={() => openProduct(p)} />
          ))}
          {products.length === 0 && <div style={{ color: 'var(--muted)' }}>No products in this category yet.</div>}
        </div>
      )}

      {/* Customization modal */}
      {selected && (
        <div style={overlayStyle}>
          <div style={{ background: 'var(--cream)', borderRadius: 14, padding: 24, width: 440, maxWidth: '92vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 19, fontWeight: 700, color: 'var(--navy)' }}>{selected.name}</h3>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--muted)' }}>×</button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>{selected.description}</p>

            {variants.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {groupVariants(variants).map((g) => (
                  <div key={g.type} style={{ ...S.field, marginBottom: 10 }}>
                    <span style={S.label}>{g.type}</span>
                    <select
                      value={variantSelections[g.type] || ''}
                      onChange={(e) => setVariantSelections((prev) => ({ ...prev, [g.type]: e.target.value }))}
                      style={S.input}
                    >
                      {g.items.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({Number(v.price_adjustment || 0) >= 0 ? '+' : ''}${Number(v.price_adjustment || 0).toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            <div style={{ ...S.field, marginBottom: 10 }}>
              <span style={S.label}>Design in Studio</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <Link href={`/dashboard/marketing/design/${selected.id}`}>
                  <button style={{ flex: 1, padding: '10px 14px', background: 'var(--gold)', color: 'var(--navy)', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                    Open Design Studio →
                  </button>
                </Link>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: 12 }}>
              <div style={{ ...S.field, width: 130 }}>
                <span style={S.label}>Quantity</span>
                <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} style={S.input} />
              </div>
              <div style={{ paddingBottom: 8, fontSize: 17, fontWeight: 700, fontFamily: 'Georgia, serif', color: 'var(--navy)' }}>
                ${(unitPrice() * quantity).toFixed(2)}
              </div>
            </div>

            <button onClick={addToCart} style={{ width: '100%', marginTop: 16, padding: '12px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
              Add to Cart
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ProductCard({ p, onOpen }: { p: MarketingProduct; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      style={{
        textAlign: 'left', background: 'var(--cream)', border: '1px solid var(--line)', borderRadius: 12, padding: 14,
        cursor: 'pointer', transition: 'box-shadow .15s', display: 'flex', flexDirection: 'column', gap: 8,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 8px 24px rgba(26,26,46,0.12)')}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
    >
      <div style={{ height: 90, borderRadius: 8, background: 'linear-gradient(135deg, var(--navy), var(--navy-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)', fontSize: 26 }}>
        {CATEGORIES.find((c) => c.id === p.category)?.icon}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', fontFamily: 'Georgia, serif' }}>{p.name}</div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2, minHeight: 30 }}>{p.description}</div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--gold-dark)' }}>
        from ${Number(p.base_price || 0).toFixed(2)}
      </div>
    </button>
  )
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: '7px 12px', borderRadius: 99, border: '1px solid var(--line)', cursor: 'pointer',
    background: active ? 'var(--navy)' : '#fff', color: active ? '#fff' : 'var(--text)',
    fontWeight: 600, fontSize: 12.5, fontFamily: 'Georgia, serif',
  }
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(10,12,28,0.55)', zIndex: 100,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
}

function groupVariants(variants: MarketingVariant[]): { type: string; items: MarketingVariant[] }[] {
  const map = new Map<string, MarketingVariant[]>()
  for (const v of variants) {
    if (!map.has(v.variant_type)) map.set(v.variant_type, [])
    map.get(v.variant_type)!.push(v)
  }
  return Array.from(map.entries()).map(([type, items]) => ({ type, items }))
}
