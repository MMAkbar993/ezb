'use client'

// =============================================================================
// OrdersManagement — order history, tracking, and a checkout flow.
// Lists the broker's past orders with status, tracking, and totals, plus a
// "Review order" panel that creates the Supabase order record from the cart
// (shipping address + Stripe-style payment intent hook).
// =============================================================================

import { useEffect, useState } from 'react'
import {
  fetchMyOrders, createOrder, type MarketingOrder, type OrderStatus,
} from '@/lib/marketing'
import { useCart } from '@/components/marketing/CartContext'
import { useToast } from '@/components/ui/Toast'

const S = {
  label: { display: 'block', fontFamily: 'Georgia, serif', fontWeight: 600, color: 'var(--navy)', fontSize: 12.5, marginBottom: 4 } as const,
  input: {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 6,
    border: '1px solid var(--line)', background: '#fff', color: 'var(--text)', fontSize: 13.5,
    fontFamily: 'Georgia, serif', outline: 'none',
  } as React.CSSProperties,
  field: { display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 10 } as React.CSSProperties,
  card: { background: 'var(--cream)', border: '1px solid var(--line)', borderRadius: 12, padding: 18, marginBottom: 14 } as const,
}

const STATUS_META: Record<OrderStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'var(--muted)' },
  pending: { label: 'Pending', color: '#b58900' },
  paid: { label: 'Paid', color: '#1e7e34' },
  processing: { label: 'In Production', color: '#1a73e8' },
  shipped: { label: 'Shipped', color: '#7b1fa2' },
  delivered: { label: 'Delivered', color: '#1e7e34' },
  cancelled: { label: 'Cancelled', color: '#b00020' },
}

export default function OrdersManagement() {
  const toast = useToast()
  const { items, subtotal, shipping, setShipping, clear } = useCart()
  const [orders, setOrders] = useState<MarketingOrder[]>([])
  const [showCheckout, setShowCheckout] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [shippingForm, setShippingForm] = useState(shipping)

  useEffect(() => {
    (async () => {
      try {
        setOrders(await fetchMyOrders())
      } catch {
        setOrders([])
      }
    })()
  }, [])

  const placeOrder = async () => {
    if (items.length === 0) {
      toast('Your cart is empty', 'error')
      return
    }
    // validate shipping
    for (const f of ['name', 'line1', 'city', 'state', 'zip'] as const) {
      if (!shippingForm[f]) {
        toast(`Shipping ${f} is required`, 'error')
        return
      }
    }
    setPlacing(true)
    try {
      for (const item of items) {
        await createOrder({
          designId: null,
          productId: item.product.id,
          quantity: item.quantity,
          variantSelections: item.variantSelections,
          shippingAddress: shippingForm,
          orderTotal: Math.round(item.unitPrice * item.quantity * 100) / 100,
          status: 'pending',
        })
      }
      setShipping(shippingForm)
      clear()
      toast('Order placed — a real Stripe payment session can be wired to this hook', 'success')
      setShowCheckout(false)
      setOrders(await fetchMyOrders())
    } catch (e: any) {
      toast(e?.message || 'Failed to place order', 'error')
    } finally {
      setPlacing(false)
    }
  }

  return (
    <div>
      {/* Cart summary + checkout */}
      {items.length > 0 && (
        <div style={S.card}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>Your Cart ({items.length})</div>
          {items.map((i) => (
            <div key={i.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--line)', fontSize: 13.5 }}>
              <span>{i.product.name} × {i.quantity}</span>
              <span style={{ fontWeight: 700 }}>${(i.unitPrice * i.quantity).toFixed(2)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontWeight: 800, color: 'var(--navy)' }}>
            <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button onClick={() => setShowCheckout((v) => !v)} style={{ padding: '10px 18px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
              {showCheckout ? 'Hide' : 'Checkout'}
            </button>
          </div>

          {showCheckout && (
            <div style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
              <div style={{ ...S.label, fontFamily: 'Georgia, serif', fontWeight: 700, color: 'var(--navy)', fontSize: 15, marginBottom: 10 }}>Shipping Address</div>
              <div className="grid-2" style={{ gap: 10 }}>
                {([
                  ['name', 'Full name'], ['line1', 'Address line 1'], ['city', 'City'],
                  ['state', 'State'], ['zip', 'ZIP'], ['country', 'Country'],
                ] as const).map(([f, label]) => (
                  <div key={f} style={S.field}>
                    <span style={S.label}>{label}</span>
                    <input value={shippingForm[f]} onChange={(e) => setShippingForm((p) => ({ ...p, [f]: e.target.value }))} style={S.input} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, color: 'var(--muted)', fontSize: 12 }}>
                💳 Payment: Stripe Checkout session wiring goes here (see <code>lib/billing.ts</code> pattern). The order record is created on confirmation.
              </div>
              <button onClick={placeOrder} disabled={placing} style={{ marginTop: 12, width: '100%', padding: '12px', background: 'var(--gold)', color: 'var(--navy)', border: 'none', borderRadius: 8, fontWeight: 800, cursor: placing ? 'not-allowed' : 'pointer', opacity: placing ? 0.6 : 1 }}>
                {placing ? 'Placing…' : `Confirm Order — $${subtotal.toFixed(2)}`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Order history */}
      <div style={S.card}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>Order History</div>
        {orders.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>No orders yet. Design and order your first marketing material above.</div>
        ) : (
          <div>
            {orders.map((o) => {
              const meta = STATUS_META[o.status || 'pending']
              return (
                <div key={o.id} style={{ borderTop: '1px solid var(--line)', padding: '10px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 14 }}>{o.product?.name || 'Marketing material'}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Qty {o.quantity} · {new Date(o.created_at || '').toLocaleDateString()}
                      {o.tracking_number && <> · Tracking: {o.tracking_number}</>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--navy)' }}>${Number(o.order_total || 0).toFixed(2)}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: meta.color, background: `${meta.color}18`, padding: '4px 9px', borderRadius: 99 }}>
                      {meta.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
