'use client'

// ---------------------------------------------------------------------------
// NdaFinancialsGate — shows the financial figures directly if the broker has
// made them publicly visible; otherwise shows a locked prompt that lets a
// buyer sign an accountless, per-listing NDA (name + email) to unlock them.
// Nothing else on the site is gated by this — only these figures, only for
// this one listing. The unlock token is cached in localStorage so a buyer
// who already signed doesn't have to again.
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react'
import { fmt$ } from '@/lib/recast'
import { useToast } from '@/components/ui/Toast'
import type { PublicListing } from '@/lib/marketplace'

interface Financials {
  annual_revenue: number | null
  sde: number | null
  ebitda: number | null
  inventory_value: number | null
  ffe_value: number | null
}

const tokenKey = (listingId: string) => `nda_token_${listingId}`

export default function NdaFinancialsGate({ listing, askingPrice }: { listing: PublicListing; askingPrice: number | null }) {
  const toast = useToast()
  const isPublic = listing.annual_revenue != null || listing.sde != null || listing.ebitda != null
  const [unlocked, setUnlocked] = useState<Financials | null>(
    isPublic ? { annual_revenue: listing.annual_revenue, sde: listing.sde, ebitda: listing.ebitda, inventory_value: listing.inventory_value, ffe_value: listing.ffe_value } : null,
  )
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '' })
  const [agree, setAgree] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [checkingCache, setCheckingCache] = useState(!isPublic)

  // If a token from a prior signature is cached, try it silently on load.
  useEffect(() => {
    if (isPublic) return
    const cached = typeof window !== 'undefined' ? window.localStorage.getItem(tokenKey(listing.id)) : null
    if (!cached) { setCheckingCache(false); return }
    fetch(`/api/public/nda/financials?listingId=${encodeURIComponent(listing.id)}&token=${encodeURIComponent(cached)}`)
      .then((r) => r.json())
      .then((data) => { if (data.ok) setUnlocked(data.financials) })
      .catch(() => {})
      .finally(() => setCheckingCache(false))
  }, [isPublic, listing.id])

  const submitNda = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) { toast('Name and email are required', 'error'); return }
    if (!agree) { toast('Please confirm you agree to keep this information confidential', 'error'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/public/nda/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing.id, name: form.name, email: form.email }),
      })
      const data = await res.json()
      if (!data.ok) { toast(data.error || 'Could not process NDA', 'error'); return }
      window.localStorage.setItem(tokenKey(listing.id), data.token)
      const finRes = await fetch(`/api/public/nda/financials?listingId=${encodeURIComponent(listing.id)}&token=${encodeURIComponent(data.token)}`)
      const finData = await finRes.json()
      if (finData.ok) {
        setUnlocked(finData.financials)
        setShowForm(false)
        toast('NDA signed — financials unlocked', 'success')
      }
    } catch {
      toast('Something went wrong. Please try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const sdeMultiple = unlocked?.sde && askingPrice ? askingPrice / unlocked.sde : null
  const rows: [string, string][] = unlocked
    ? [
        ['Revenue', fmt$(unlocked.annual_revenue)],
        ["SDE (Seller's Discretionary Earnings)", fmt$(unlocked.sde)],
        ...(unlocked.ebitda ? [['EBITDA', fmt$(unlocked.ebitda)] as [string, string]] : []),
        ['SDE Multiple', sdeMultiple ? sdeMultiple.toFixed(1) + 'x' : '—'],
      ]
    : []

  if (checkingCache) return null

  if (unlocked) {
    return (
      <>
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f0ecdf' }}>
            <span style={{ fontSize: 13, color: '#888' }}>{label}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{value}</span>
          </div>
        ))}
        {(unlocked.inventory_value || 0) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f0ecdf' }}>
            <span style={{ fontSize: 13, color: '#888' }}>Inventory</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{fmt$(unlocked.inventory_value)}</span>
          </div>
        )}
      </>
    )
  }

  return (
    <div style={{ padding: '14px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#888', fontSize: 13.5, marginBottom: 12 }}>
        🔒 Revenue, SDE &amp; EBITDA are confidential — sign an NDA for this listing to view.
      </div>
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          style={{ width: '100%', background: '#1a1a2e', color: '#fff', border: 'none', padding: '11px 18px', borderRadius: 6, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'Georgia, serif' }}
        >
          Sign NDA to Unlock Financials
        </button>
      ) : (
        <form onSubmit={submitNda} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input className="input" placeholder="Full Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="input" placeholder="Email *" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: '#666', lineHeight: 1.4 }}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 2 }} />
            I agree to keep this business's identity and financial information confidential and will not disclose it to any third party.
          </label>
          <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Signing…' : 'Sign & Unlock'}</button>
        </form>
      )}
    </div>
  )
}
