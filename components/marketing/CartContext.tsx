'use client'

// =============================================================================
// Marketing Cart context. Lightweight client-side cart persisted to localStorage
// so brokers can stage multiple items before checkout. Supports product +
// variant selection + quantity. The actual order record is created on checkout.
// =============================================================================

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { MarketingProduct, MarketingVariant, ShippingAddress } from '@/lib/marketing'
import { totalPrice, unitPrice } from '@/lib/marketing'

export interface CartItem {
  key: string
  product: MarketingProduct
  quantity: number
  variantSelections: Record<string, string>
  unitPrice: number
}

interface CartCtx {
  items: CartItem[]
  addItem: (product: MarketingProduct, variants: MarketingVariant[], quantity: number, variantSelections: Record<string, string>) => void
  updateQuantity: (key: string, quantity: number) => void
  removeItem: (key: string) => void
  clear: () => void
  subtotal: number
  count: number
  shipping: ShippingAddress
  setShipping: (a: ShippingAddress) => void
}

const CartContext = createContext<CartCtx | null>(null)

const STORAGE_KEY = 'concord_marketing_cart'
const SHIP_KEY = 'concord_marketing_shipping'

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [shipping, setShippingState] = useState<ShippingAddress>({
    name: '', line1: '', line2: '', city: '', state: '', zip: '', country: 'US',
  })

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setItems(JSON.parse(raw))
      const s = localStorage.getItem(SHIP_KEY)
      if (s) setShippingState(JSON.parse(s))
    } catch {
      // ignore corrupt storage
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items, loaded])

  useEffect(() => {
    if (loaded) localStorage.setItem(SHIP_KEY, JSON.stringify(shipping))
  }, [shipping, loaded])

  const addItem: CartCtx['addItem'] = useCallback((product, variants, quantity, variantSelections) => {
    const unit = unitPrice(product, variantSelections, variants)
    const key = `${product.id}::${JSON.stringify(variantSelections)}`
    setItems((prev) => {
      const existing = prev.find((i) => i.key === key)
      if (existing) {
        return prev.map((i) => (i.key === key ? { ...i, quantity: i.quantity + quantity, unitPrice: unit } : i))
      }
      return [...prev, { key, product, quantity, variantSelections, unitPrice: unit }]
    })
  }, [])

  const updateQuantity = useCallback((key: string, quantity: number) => {
    setItems((prev) =>
      quantity <= 0 ? prev.filter((i) => i.key !== key) : prev.map((i) => (i.key === key ? { ...i, quantity } : i)),
    )
  }, [])

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const setShipping = useCallback((a: ShippingAddress) => setShippingState(a), [])

  const subtotal = useMemo(() => items.reduce((sum, i) => sum + totalPrice(i.unitPrice, i.quantity), 0), [items])
  const count = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items])

  const value: CartCtx = { items, addItem, updateQuantity, removeItem, clear, subtotal, count, shipping, setShipping }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartCtx {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within <CartProvider>')
  return ctx
}
