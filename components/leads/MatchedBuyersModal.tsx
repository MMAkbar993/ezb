'use client'

import { UnifiedLead, statusMeta } from '@/lib/leads2'

interface MatchedBuyersModalProps {
  matches: UnifiedLead[]
  listingIndustry: string
  onDone: (goToWorkflow: boolean) => void
}

const fmtFunds = (n?: number | null) => {
  if (n == null || isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function MatchedBuyersModal({ matches, listingIndustry, onDone }: MatchedBuyersModalProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.6)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => onDone(true)}>
      <div style={{ background: '#fff', borderRadius: 14, maxWidth: 640, width: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 30px 80px rgba(26,26,46,0.4)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ background: 'var(--navy)', color: '#fff', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTopLeftRadius: 14, borderTopRightRadius: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, color: '#fff' }}>🎯 Matching Buyer Leads Found</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
              {matches.length} buyer{matches.length > 1 ? 's' : ''} looking for {listingIndustry || 'a similar business'}
            </p>
          </div>
          <button onClick={() => onDone(true)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: 20 }}>
          <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--muted)' }}>
            These buyers have expressed interest in this type of business. Reach out to gauge fit before releasing financials.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {matches.map((m) => {
              const meta = statusMeta(m.status)
              return (
                <div key={m.id} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 14, background: 'var(--cream)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 15 }}>
                      {m.email || m.phone || 'Buyer'}
                    </div>
                    <span style={{ background: meta.color + '1a', color: meta.color, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
                      {meta.label}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 13, color: 'var(--text)' }}>
                    <div><strong>Wants:</strong> {m.desired_business_type || '—'}</div>
                    <div><strong>Budget:</strong> {m.budget_range || '—'}</div>
                    <div><strong>Funds available:</strong> {fmtFunds(m.funds_available)}</div>
                    <div><strong>Financing:</strong> {m.financing_method || '—'}</div>
                    <div style={{ gridColumn: '1 / -1' }}><strong>Location:</strong> {m.preferred_location || '—'}</div>
                    {m.notes && <div style={{ gridColumn: '1 / -1', fontStyle: 'italic', color: 'var(--muted)' }}>{m.notes}</div>}
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    {m.phone && (
                      <a className="btn btn-navy" style={{ textDecoration: 'none', fontSize: 12.5, padding: '7px 12px' }} href={`tel:${m.phone}`}>📞 Call</a>
                    )}
                    {m.email && (
                      <a className="btn btn-ghost" style={{ textDecoration: 'none', fontSize: 12.5, padding: '7px 12px' }} href={`mailto:${m.email}?subject=Business opportunity matching your criteria`}>✉️ Email</a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => onDone(false)}>Done — skip workflow</button>
            <button className="btn btn-primary" onClick={() => onDone(true)}>Continue to workflow →</button>
          </div>
        </div>
      </div>
    </div>
  )
}
