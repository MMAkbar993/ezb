'use client'

// ---------------------------------------------------------------------------
// ListingDetailInteractive — client-side interactive parts of the public
// listing detail page: image gallery (active image switcher) and the request /
// contact form (lead capture with toast). Rendered inside the server component
// so the surrounding page can be statically SEO-rendered with metadata.
// ---------------------------------------------------------------------------

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { capturePublicLead, PublicListing } from '@/lib/marketplace'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { fmt$ } from '@/lib/recast'

export default function ListingDetailInteractive({ listing }: { listing: PublicListing }) {
  const toast = useToast()
  const router = useRouter()
  const [activeImage, setActiveImage] = useState(0)
  const [showContact, setShowContact] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [submitting, setSubmitting] = useState(false)

  const gallery = [listing.primary_image_url, listing.featured_image_url, ...(listing.image_urls || [])].filter(Boolean) as string[]
  const price = listing.asking_price
  const revenue = listing.annual_revenue
  const sde = listing.sde
  const ebitda = listing.ebitda
  const sdeMultiple = sde && price ? price / sde : null

  const submitLead = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) {
      toast('Name and email are required', 'error')
      return
    }
    setSubmitting(true)
    const res = await capturePublicLead({
      kind: 'buyer', name: form.name, email: form.email, phone: form.phone || undefined,
      source: 'listing_detail', message: `Interested in: ${listing.business_name}`, listing_id: listing.id,
    })
    setSubmitting(false)
    if (res.ok) {
      toast(`Request sent — a broker will contact you about ${listing.business_name}.`, 'success')
      setShowContact(false)
    } else {
      toast(res.error || 'Submission failed', 'error')
    }
  }

  return (
    <ToastProvider>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }}>
        {/* LEFT: gallery + about */}
        <div>
          {/* Gallery */}
          {gallery.length > 0 ? (
            <div style={{ background: '#fff', border: '1px solid #ece8dc', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ height: 420, background: '#1a1a2e', position: 'relative' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={gallery[activeImage]} alt={listing.business_name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              {gallery.length > 1 && (
                <div style={{ display: 'flex', gap: 8, padding: 12 }}>
                  {gallery.map((g, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImage(i)}
                      style={{ width: 60, height: 45, padding: 0, cursor: 'pointer', border: activeImage === i ? '2px solid #c9a84c' : '2px solid transparent', borderRadius: 6, overflow: 'hidden', background: '#1a1a2e' }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={g} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ height: 420, background: 'linear-gradient(135deg,#1a1a2e,#26264a)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(201,168,76,0.5)', fontSize: 60 }}>🏢</div>
          )}

          {/* About */}
          <div style={{ background: '#fff', border: '1px solid #ece8dc', borderRadius: 12, padding: 28, marginTop: 20 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#1a1a2e', margin: '0 0 14px' }}>About This Business</h2>
            <p style={{ color: '#555', fontSize: 15, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {listing.description || `${listing.business_name} is a profitable, established business offered for confidential sale. Contact a Concord broker for full details.`}
            </p>
            {listing.reason_for_sale && (
              <div style={{ marginTop: 18, background: '#faf9f4', padding: 16, borderRadius: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>Reason for Sale</div>
                <div style={{ fontSize: 14, color: '#555' }}>{listing.reason_for_sale}</div>
              </div>
            )}
            {listing.real_estate_included && (
              <div style={{ marginTop: 10, fontSize: 13, color: '#888' }}>🏠 Real estate included in the sale.</div>
            )}
          </div>
        </div>

        {/* RIGHT: financial snapshot card */}
        <div style={{ position: 'sticky', top: 88 }}>
          <div style={{ background: '#fff', border: '1px solid #ece8dc', borderRadius: 12, overflow: 'hidden', boxShadow: '0 6px 30px rgba(26,26,46,0.08)' }}>
            <div style={{ background: '#1a1a2e', color: '#c9a84c', padding: '16px 20px', fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 15 }}>Financial Snapshot</div>
            <div style={{ padding: 20 }}>
              {[
                ['Revenue', fmt$(revenue)],
                ['SDE (Seller\'s Discretionary Earnings)', fmt$(sde)],
                ...(ebitda ? [['EBITDA', fmt$(ebitda)] as [string, string]] : []),
                ['SDE Multiple', sdeMultiple ? sdeMultiple.toFixed(1) + 'x' : '—'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f0ecdf' }}>
                  <span style={{ fontSize: 13, color: '#888' }}>{label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{value}</span>
                </div>
              ))}
              {(listing.inventory_value || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f0ecdf' }}>
                  <span style={{ fontSize: 13, color: '#888' }}>Inventory</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{fmt$(listing.inventory_value)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Contact form */}
          {showContact && (
            <div style={{ background: '#fff', border: '1px solid #c9a84c', borderRadius: 12, padding: 24, marginTop: 16, boxShadow: '0 6px 30px rgba(201,168,76,0.15)' }}>
              <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#1a1a2e', margin: '0 0 4px' }}>Interested in this business?</h3>
              <p style={{ fontSize: 13, color: '#888', margin: '0 0 16px' }}>A broker will reach out to arrange a confidential discussion.</p>
              <form onSubmit={submitLead} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input className="input" placeholder="Full Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                <input className="input" placeholder="Email *" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                <textarea className="textarea" rows={3} placeholder="Tell us about your interest / financing ('say hi')" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Sending...' : 'Send Request'}</button>
              </form>
            </div>
          )}
          <div style={{ marginTop: 16 }}>
            <button onClick={() => setShowContact(!showContact)} style={{ width: '100%', background: '#1a1a2e', color: '#fff', border: 'none', padding: '12px 26px', borderRadius: 6, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'Georgia, serif' }}>
              {showContact ? 'Close' : 'Request More Information'}
            </button>
          </div>
        </div>
      </div>
    </ToastProvider>
  )
}
