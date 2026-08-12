'use client'

// ---------------------------------------------------------------------------
// BuyerInquiriesList — real, publicly signed NDA + Buyer Profile Form
// submissions for a listing (the accountless public gate's actual record —
// distinct from the manually-tracked buyer pipeline above it in Step 9).
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react'
import { fetchBuyerInquiries, type BuyerInquiry } from '@/lib/buyerInquiries'
import { getSignedFileUrl } from '@/lib/financialFiles'
import { useToast } from '@/components/ui/Toast'

export default function BuyerInquiriesList({ listingId }: { listingId: string }) {
  const toast = useToast()
  const [inquiries, setInquiries] = useState<BuyerInquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetchBuyerInquiries(listingId)
      .then(setInquiries)
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [listingId])

  const openPdf = async (path: string) => {
    const url = await getSignedFileUrl(path)
    if (url) window.open(url, '_blank', 'noreferrer')
    else toast('Could not open PDF', 'error')
  }

  if (loading) return <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</div>
  if (!inquiries.length) return <div style={{ fontSize: 13, color: 'var(--muted)', padding: '10px 0' }}>No buyers have signed the NDA for this listing yet.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {inquiries.map((inq) => (
        <div key={inq.id} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--ink)' }}>{inq.buyer_name}</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{inq.buyer_email} · signed {new Date(inq.signed_at).toLocaleDateString()}</div>
            </div>
            <button className="btn btn-ghost" style={{ fontSize: 12.5, padding: '6px 12px' }} onClick={() => setExpanded(expanded === inq.id ? null : inq.id)}>
              {expanded === inq.id ? 'Hide details' : 'View details'}
            </button>
            {inq.pdf_url && (
              <button className="btn btn-ghost" style={{ fontSize: 12.5, padding: '6px 12px' }} onClick={() => openPdf(inq.pdf_url!)}>PDF ↗</button>
            )}
          </div>
          {expanded === inq.id && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
              {Object.entries({ ...inq.nda_form_data, ...inq.buyer_profile }).filter(([, v]) => v !== '' && v !== null && v !== undefined).map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--muted)' }}>{k.replace(/_/g, ' ')}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink)' }}>{String(v)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
