'use client'

// =============================================================================
// MarketingGenPanel — lets any agent generate a complete, on-brand marketing
// piece (flyer, brochure, business card, postcard, banner, stationery, ...)
// straight from a business summary. Calls /api/ai/marketing-copy which drafts
// the finished copy (headline, tagline, body, CTA, layout) via Claude, falling
// back to a deterministic generator so it never hard-fails.
//
// "Upload samples" substitute: instead of pre-uploading static sample files,
// the agent CREATES each piece its own way from this panel — you type a short
// description and it produces a finished design-ready piece in seconds.
// =============================================================================

import { useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import type { StudioDesignData, MarketingCategory } from '@/lib/marketing'

const CATS: { id: MarketingCategory; label: string; icon: string }[] = [
  { id: 'flyers', label: 'Flyer', icon: '📄' },
  { id: 'brochures', label: 'Brochure', icon: '📘' },
  { id: 'business_cards', label: 'Card', icon: '💳' },
  { id: 'postcards', label: 'Postcard', icon: '🖼️' },
  { id: 'banners', label: 'Banner', icon: '🏳️' },
  { id: 'signage', label: 'Signage', icon: '🪧' },
  { id: 'stationery', label: 'Stationery', icon: '📮' },
]

export default function MarketingGenPanel() {
  const toast = useToast()
  const [category, setCategory] = useState<MarketingCategory>('flyers')
  const [businessName, setBusinessName] = useState('')
  const [summary, setSummary] = useState('')
  const [industry, setIndustry] = useState('')
  const [city, setCity] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<StudioDesignData | null>(null)

  const canRun = businessName.trim().length > 0

  const generate = async () => {
    if (!canRun || busy) return
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch('/api/ai/marketing-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productCategory: category,
          businessName: businessName.trim(),
          summary: summary.trim(),
          industry: industry.trim(),
          city: city.trim(),
        }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Generation failed')
      setResult(json.design as StudioDesignData)
      toast('Marketing piece generated — review and edit below.', 'success')
    } catch (e: any) {
      toast(e?.message || 'Could not generate a piece', 'error')
    } finally {
      setBusy(false)
    }
  }

  const openInStudio = () => {
    if (!result) return
    // Open the design studio for this product type; the generated copy is
    // returned to the user here to paste, and a future iteration can
    // auto-load it into the studio via query params.
    window.open(`/dashboard/marketing/design/${category}`, '_blank')
  }

  const input: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--line)',
    fontSize: 13.5, background: '#fff', color: 'var(--text)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--paper)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', background: 'var(--cream)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ fontWeight: 700, color: 'var(--navy)', fontFamily: 'Georgia, serif', fontSize: 15 }}>✨ Marketing Material Generator</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
          Describe a business and the AI drafts a finished, on-brand piece — no blank page, no sample files needed.
        </div>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Category picker */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: 6 }}>
          {CATS.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                padding: '8px 4px', borderRadius: 8, cursor: 'pointer',
                border: category === c.id ? '1.5px solid var(--gold)' : '1px solid var(--line)',
                background: category === c.id ? 'rgba(201,168,76,0.15)' : 'transparent',
                color: category === c.id ? 'var(--navy)' : 'var(--muted)',
                fontSize: 11.5, fontWeight: category === c.id ? 700 : 500,
              }}
            >
              <span style={{ fontSize: 17 }}>{c.icon}</span>
              {c.label}
            </button>
          ))}
        </div>

        <input style={input} value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Business name *" />
        <input style={input} value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Industry (e.g. Home Health, Restaurant)" />
        <input style={input} value={city} onChange={(e) => setCity(e.target.value)} placeholder="City / location (optional)" />
        <textarea
          style={{ ...input, minHeight: 64, resize: 'vertical' }}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="One or two lines about the business — services, revenue strength, what makes it attractive…"
        />

        <button
          onClick={generate}
          disabled={!canRun || busy}
          style={{
            padding: '11px', borderRadius: 8, border: 'none', cursor: busy || !canRun ? 'not-allowed' : 'pointer',
            background: 'linear-gradient(135deg, var(--gold), var(--gold-dark))', color: 'var(--navy)',
            fontWeight: 800, fontFamily: 'Georgia, serif', fontSize: 14, opacity: busy || !canRun ? 0.6 : 1,
          }}
        >
          {busy ? 'Generating…' : '✨ Generate Marketing Piece'}
        </button>

        {result && (
          <div style={{ marginTop: 4, border: '1px solid var(--line)', borderRadius: 8, background: '#fff', padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 13.5 }}>Drafted piece — {result.designName}</div>
              <button className="btn" style={{ padding: '6px 10px', fontSize: 12 }} onClick={openInStudio}>
                Open in Studio →
              </button>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)', fontFamily: 'Georgia, serif', marginBottom: 4 }}>
              {result.text.headline}
            </div>
            <div style={{ fontSize: 13, color: 'var(--gold-dark)', fontStyle: 'italic', marginBottom: 8 }}>
              {result.text.tagline}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.55, marginBottom: 8 }}>
              {result.text.body}
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              <strong>CTA:</strong> {result.text.cta}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted-2)', marginTop: 8 }}>
              Layout: {result.layout} · Brand: {result.brand.primaryColor} / {result.brand.accentColor}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
