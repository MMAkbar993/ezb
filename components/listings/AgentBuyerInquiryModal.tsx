'use client'

// ---------------------------------------------------------------------------
// AgentBuyerInquiryModal — lets a broker/agent record a buyer's NDA + Buyer
// Profile Form directly in the dashboard (buyer called in, filled it out in
// person, etc.) instead of requiring the buyer to use the public accountless
// gate on the marketplace listing page. Produces the identical signed PDF +
// listing_nda_signatures record the public flow does.
// ---------------------------------------------------------------------------

import { useState } from 'react'
import DynamicFormFields, { type FormValues } from '@/components/forms/DynamicFormFields'
import { NDA_FORM_SECTIONS, BUYER_PROFILE_SECTIONS } from '@/lib/buyerFormSchemas'
import { submitAgentBuyerInquiry } from '@/lib/buyerInquiries'
import { useToast } from '@/components/ui/Toast'

export default function AgentBuyerInquiryModal({ listingId, onClose, onSaved }: { listingId: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [buyerName, setBuyerName] = useState('')
  const [buyerEmail, setBuyerEmail] = useState('')
  const [ndaValues, setNdaValues] = useState<FormValues>({})
  const [profileValues, setProfileValues] = useState<FormValues>({})
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (!buyerName.trim() || !buyerEmail.trim()) { toast('Buyer name and email are required', 'info'); return }
    setSubmitting(true)
    try {
      await submitAgentBuyerInquiry({
        listingId, buyerName: buyerName.trim(), buyerEmail: buyerEmail.trim(),
        ndaFormData: ndaValues, buyerProfile: profileValues,
      })
      toast('Buyer NDA + Profile Form recorded — PDF generated', 'success')
      onSaved()
    } catch (e: any) {
      toast(e.message || 'Could not record buyer inquiry', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.55)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '30px 16px', overflowY: 'auto' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, maxWidth: 760, width: '100%', padding: 28, maxHeight: '92vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 19, color: 'var(--navy)' }}>Record Buyer NDA + Profile Form</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 18px' }}>
          Use this when a buyer inquires by phone or in person instead of through the public listing page. Generates the same signed PDF and adds them to Buyer Inquiries below.
        </p>

        <div className="grid-2" style={{ gap: 12, marginBottom: 18 }}>
          <div>
            <label className="label">Buyer Full Name *</label>
            <input className="input" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Buyer Email *</label>
            <input className="input" type="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} required />
          </div>
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>Confidentiality & Registration Agreement</div>
        <DynamicFormFields sections={NDA_FORM_SECTIONS} values={ndaValues} onChange={(k, v) => setNdaValues((s) => ({ ...s, [k]: v }))} />

        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', margin: '22px 0 4px' }}>Buyer Profile Form</div>
        <DynamicFormFields sections={BUYER_PROFILE_SECTIONS} values={profileValues} onChange={(k, v) => setProfileValues((s) => ({ ...s, [k]: v }))} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={submitting}>{submitting ? 'Saving…' : 'Save & Generate PDF'}</button>
        </div>
      </div>
    </div>
  )
}
