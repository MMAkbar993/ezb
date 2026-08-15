'use client'

import { useEffect, useState } from 'react'
import { StepShell, stepField, stepLabel, stepBtn } from '@/components/listings/StepShell'
import { fetchBuyers, addBuyer, updateBuyer, completeStep, recordLOI, uploadBuyerNda, uploadBuyerPof } from '@/lib/workflow'
import { getSignedFileUrl } from '@/lib/financialFiles'
import StatusBadge from '@/components/listings/StatusBadge'
import BuyerInquiriesList from '@/components/listings/BuyerInquiriesList'
import { fetchBuyerInquiries, type BuyerInquiry } from '@/lib/buyerInquiries'
import { useToast } from '@/components/ui/Toast'

// ---------------------------------------------------------------------------
// Step 9 — Buyer Management: NDAs, financial qualification, primary buyer.
// When the primary buyer signs an LOI, the listing moves to Pending Sale.
// ---------------------------------------------------------------------------

const emptyBuyer = { buyer_name: '', buyer_email: '', buyer_phone: '', buyer_type: 'individual' }

export default function Step9BuyerManagement({ listingId, onNext, onAgreementChange }: { listingId: string; onNext: () => void; onAgreementChange?: () => void }) {
  const toast = useToast()
  const [buyers, setBuyers] = useState<any[]>([])
  const [inquiries, setInquiries] = useState<BuyerInquiry[]>([])
  const [form, setForm] = useState(emptyBuyer)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setBuyers(await fetchBuyers(listingId))
    try { setInquiries(await fetchBuyerInquiries(listingId)) } catch { setInquiries([]) }
  }
  useEffect(() => { load() }, [listingId])

  // A buyer has really signed the NDA if either the broker manually marked
  // it, or their email matches a real, timestamped public NDA submission
  // (listing_nda_signatures) — the actual accountless gate, not just a
  // checkbox.
  const hasRealNda = (b: any) =>
    !!b.buyer_email && inquiries.some((i) => i.buyer_email.toLowerCase() === b.buyer_email.toLowerCase())

  const ndaConfirmed = (b: any) => !!b.nda_signed || hasRealNda(b)

  const copyNdaLink = async (b: any) => {
    const link = `${window.location.origin}/marketplace/listings/${listingId}`
    try {
      await navigator.clipboard.writeText(link)
      toast(`NDA link copied — send it to ${b.buyer_name}`, 'success')
    } catch {
      toast(link, 'success')
    }
  }

  const addNew = async () => {
    if (!form.buyer_name.trim()) return
    setBusy(true)
    await addBuyer(listingId, form)
    setForm(emptyBuyer); await load(); setBusy(false)
  }

  const togglePrimary = async (id: string) => {
    // Set this buyer as primary, others not.
    await Promise.all(buyers.map((b) => updateBuyer(b.id, { is_primary_buyer: b.id === id })))
    await load(); onAgreementChange?.()
  }

  const markNDA = async (b: any, signed: boolean) => {
    await updateBuyer(b.id, { nda_signed: signed, nda_signed_at: signed ? new Date().toISOString() : null })
    await load()
  }

  const setLOI = async (buyer: any) => {
    setBusy(true)
    await recordLOI(listingId, buyer.id)
    await load(); onAgreementChange?.(); setBusy(false)
  }

  const [uploadingNdaFor, setUploadingNdaFor] = useState<string | null>(null)

  const handleNdaUpload = async (buyer: any, file: File) => {
    setUploadingNdaFor(buyer.id)
    const ok = await uploadBuyerNda(buyer.id, file)
    setUploadingNdaFor(null)
    if (ok) { toast(`NDA saved for ${buyer.buyer_name}`, 'success'); await load() }
    else toast('Failed to upload NDA', 'error')
  }

  const viewNda = async (buyer: any) => {
    const url = await getSignedFileUrl(buyer.nda_document_path)
    if (url) window.open(url, '_blank', 'noreferrer')
    else toast('Could not open NDA document', 'error')
  }

  const [uploadingPofFor, setUploadingPofFor] = useState<string | null>(null)

  const handlePofUpload = async (buyer: any, file: File) => {
    setUploadingPofFor(buyer.id)
    const ok = await uploadBuyerPof(buyer.id, file)
    setUploadingPofFor(null)
    if (ok) { toast(`Proof of Funds saved for ${buyer.buyer_name}`, 'success'); await load() }
    else toast('Failed to upload Proof of Funds', 'error')
  }

  const viewPof = async (buyer: any) => {
    const url = await getSignedFileUrl(buyer.pof_document_path)
    if (url) window.open(url, '_blank', 'noreferrer')
    else toast('Could not open Proof of Funds document', 'error')
  }

  return (
    <StepShell step={9} title="Buyer Management" description="Track interested buyers through NDA and financial qualification. Set a primary buyer; when they sign an LOI the listing advances to Pending Sale."
      status="draft" onNext={async () => { await completeStep(listingId, 9); onNext() }} nextLabel="Step 9 complete →">

      {/* Add buyer */}
      <div style={{ background: 'var(--paper)', padding: 16, borderRadius: 10, border: '1px solid var(--line)', marginBottom: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>Add a buyer</div>
        <div className="grid-responsive collapse-sm" style={{ '--grid-cols': '2fr 1.6fr 1.2fr 1fr', '--grid-gap': '10px' } as React.CSSProperties}>
          <input value={form.buyer_name} onChange={(e) => setForm({ ...form, buyer_name: e.target.value })} placeholder="Buyer name" style={stepField} />
          <input value={form.buyer_email} onChange={(e) => setForm({ ...form, buyer_email: e.target.value })} placeholder="Email" style={stepField} />
          <input value={form.buyer_phone} onChange={(e) => setForm({ ...form, buyer_phone: e.target.value })} placeholder="Phone" style={stepField} />
          <select value={form.buyer_type} onChange={(e) => setForm({ ...form, buyer_type: e.target.value })} style={stepField}>
            <option value="individual">Individual</option><option value="company">Company</option><option value="fund">Fund</option><option value="strategic">Strategic</option>
          </select>
        </div>
        <button onClick={addNew} disabled={busy} style={stepBtn(true)}>+ Add buyer</button>
      </div>

      {/* Buyer list */}
      {buyers.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}>No buyers added yet.</div>}
      {buyers.map((b) => (
        <div key={b.id} style={{ border: b.is_primary_buyer ? '1.5px solid var(--gold)' : '1px solid var(--line)', borderRadius: 10, padding: 14, marginBottom: 12, background: b.is_primary_buyer ? 'rgba(201,168,76,0.05)' : '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>
                {b.buyer_name} {b.is_primary_buyer && <span style={{ fontSize: 11, background: 'var(--gold)', color: '#0b1f3a', padding: '2px 8px', borderRadius: 12, marginLeft: 6, fontWeight: 700 }}>PRIMARY</span>}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{b.buyer_email} · {b.buyer_phone} · {b.buyer_type}</div>
            </div>
            <button onClick={() => togglePrimary(b.id)} style={stepBtn(false)}>{b.is_primary_buyer ? '★ Primary' : 'Set primary'}</button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {hasRealNda(b) ? (
              <span style={chipBtn('#16a34a')}>✓ NDA verified (signed on listing page)</span>
            ) : (
              <button onClick={() => markNDA(b, !b.nda_signed)} style={chipBtn(b.nda_signed ? '#16a34a' : '#7a7a8a')}>
                {b.nda_signed ? '✓ NDA signed (manual)' : 'Mark NDA signed'}
              </button>
            )}
            <button onClick={() => copyNdaLink(b)} style={chipBtn('#0f3460')}>🔗 Copy NDA link to send</button>
            {b.nda_document_path ? (
              <button onClick={() => viewNda(b)} style={chipBtn('#0f3460')}>📄 View/Download NDA</button>
            ) : (
              <label style={{ ...chipBtn('#7a7a8a'), display: 'inline-flex', alignItems: 'center' }}>
                {uploadingNdaFor === b.id ? 'Uploading…' : '📎 Upload NDA for record'}
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  disabled={uploadingNdaFor === b.id}
                  style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleNdaUpload(b, f); e.target.value = '' }}
                />
              </label>
            )}
            {b.pof_document_path ? (
              <button onClick={() => viewPof(b)} style={chipBtn('#0f3460')}>💰 View Proof of Funds</button>
            ) : (
              <label style={{ ...chipBtn('#7a7a8a'), display: 'inline-flex', alignItems: 'center' }}>
                {uploadingPofFor === b.id ? 'Uploading…' : '📎 Upload Proof of Funds'}
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  disabled={uploadingPofFor === b.id}
                  style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePofUpload(b, f); e.target.value = '' }}
                />
              </label>
            )}
            <button onClick={() => updateBuyer(b.id, { financial_qualified: !b.financial_qualified }).then(load)} style={chipBtn(b.financial_qualified ? '#16a34a' : '#7a7a8a')}>
              {b.financial_qualified ? '✓ Financially qualified' : 'Mark financially qualified'}
            </button>
            {!b.is_primary_buyer && (
              <button
                onClick={() => ndaConfirmed(b) ? setLOI(b) : toast(`${b.buyer_name} hasn't signed the NDA yet — send the link or mark it signed first.`, 'error')}
                disabled={busy}
                title={ndaConfirmed(b) ? undefined : 'NDA not yet signed'}
                style={{ marginLeft: 'auto', ...stepBtn(true), padding: '9px 16px', fontSize: 13, opacity: ndaConfirmed(b) ? 1 : 0.5 }}
              >
                {ndaConfirmed(b) ? '📝 Sign LOI → Pending Sale' : '🔒 Sign LOI (NDA required first)'}
              </button>
            )}
          </div>
          {b.nda_document_path && (
            <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--muted)' }}>
              📎 {b.nda_document_name || 'NDA document'} on file{b.nda_document_uploaded_at ? ` · uploaded ${new Date(b.nda_document_uploaded_at).toLocaleDateString()}` : ''}
            </div>
          )}
          {b.pof_document_path && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 6 }}>
                💰 {b.pof_document_name || 'Proof of Funds document'} on file{b.pof_document_uploaded_at ? ` · uploaded ${new Date(b.pof_document_uploaded_at).toLocaleDateString()}` : ''}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11.5, color: 'var(--muted)' }}>
                  Verified Amount ($)
                  <input
                    type="number" defaultValue={b.pof_verified_amount ?? ''}
                    onBlur={(e) => updateBuyer(b.id, { pof_verified_amount: e.target.value ? Number(e.target.value) : null }).then(load)}
                    style={{ ...stepField, width: 140, padding: '6px 8px', fontSize: 12.5 }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11.5, color: 'var(--muted)' }}>
                  Expiry Date
                  <input
                    type="date" defaultValue={b.pof_expiry_date ?? ''}
                    onBlur={(e) => updateBuyer(b.id, { pof_expiry_date: e.target.value || null }).then(load)}
                    style={{ ...stepField, width: 150, padding: '6px 8px', fontSize: 12.5 }}
                  />
                </label>
              </div>
            </div>
          )}
          {b.is_primary_buyer && (
            <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--gold-dark)' }}>When this primary buyer signs an LOI, the listing automatically advances to Pending Sale.</div>
          )}
        </div>
      ))}

      <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid var(--line)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>Buyer Inquiries (public NDA gate)</div>
        <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 12px' }}>
          Buyers who signed the NDA and Buyer Profile Form on the public listing page to unlock financials — a real, timestamped record, separate from the manual tracker above.
        </p>
        <BuyerInquiriesList
          listingId={listingId}
          trackedEmails={buyers.map((b) => (b.buyer_email || '').toLowerCase()).filter(Boolean)}
          onPromoted={load}
        />
      </div>
    </StepShell>
  )
}

const chipBtn = (c: string): React.CSSProperties => ({
  padding: '8px 14px', borderRadius: 20, cursor: 'pointer', fontWeight: 600, fontSize: 12.5, fontFamily: 'inherit',
  background: 'transparent', color: c, border: `1px solid ${c}`,
})
