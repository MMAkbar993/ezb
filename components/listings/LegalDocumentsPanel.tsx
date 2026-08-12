'use client'

// ---------------------------------------------------------------------------
// LegalDocumentsPanel — broker-side list of the 5 seller legal-document forms
// for a listing (Seller Interview, Exclusive Marketing & Listing Agreement,
// Corporate/LLC Authorization Resolution, Documentation Checklist). Fill
// in-app, send a no-login link for the seller to review and sign remotely,
// or download the signed PDF once complete.
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react'
import { SELLER_FORM_SCHEMAS, SELLER_FORM_ORDER, type SellerFormType } from '@/lib/sellerFormSchemas'
import { fetchSellerForms, saveSellerFormDraft, sendSellerFormToSeller, type SellerFormRow } from '@/lib/sellerForms'
import DynamicFormFields, { type FormValues } from '@/components/forms/DynamicFormFields'
import { useToast } from '@/components/ui/Toast'
import { getSignedFileUrl } from '@/lib/financialFiles'

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Not started', color: '#7a7a8a', bg: '#f3f3f6' },
  sent: { label: 'Sent — awaiting signature', color: '#b45309', bg: '#fdf3e3' },
  signed: { label: 'Signed', color: '#16a34a', bg: '#e8f7ee' },
}

export default function LegalDocumentsPanel({ listingId }: { listingId: string }) {
  const toast = useToast()
  const [rows, setRows] = useState<SellerFormRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<SellerFormType | null>(null)

  const load = async () => {
    setLoading(true)
    try { setRows(await fetchSellerForms(listingId)) } catch (e: any) { toast(e.message, 'error') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [listingId])

  const rowFor = (type: SellerFormType) => rows.find((r) => r.form_type === type) || null

  const openPdf = async (storagePath: string) => {
    const url = await getSignedFileUrl(storagePath)
    if (url) window.open(url, '_blank', 'noreferrer')
    else toast('Could not open PDF', 'error')
  }

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>Seller Legal Document Forms</div>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 12px' }}>
        Fill these in for the seller, or send a link for them to review and sign remotely — no login required on their end.
      </p>
      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SELLER_FORM_ORDER.map((type) => {
            const schema = SELLER_FORM_SCHEMAS[type]
            const row = rowFor(type)
            const style = STATUS_STYLE[row?.status || 'draft']
            return (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{schema.title}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, color: style.color, background: style.bg, whiteSpace: 'nowrap' }}>{style.label}</span>
                <button className="btn btn-ghost" style={{ fontSize: 12.5, padding: '6px 12px' }} onClick={() => setEditing(type)}>
                  {row ? 'Edit' : 'Fill'}
                </button>
                {row?.pdf_url && (
                  <button className="btn btn-ghost" style={{ fontSize: 12.5, padding: '6px 12px' }} onClick={() => openPdf(row.pdf_url!)}>PDF ↗</button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {editing && (
        <SellerFormEditorModal
          listingId={listingId}
          formType={editing}
          initial={rowFor(editing)}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </div>
  )
}

function SellerFormEditorModal({
  listingId, formType, initial, onClose, onSaved,
}: {
  listingId: string
  formType: SellerFormType
  initial: SellerFormRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const schema = SELLER_FORM_SCHEMAS[formType]
  const [values, setValues] = useState<FormValues>(initial?.form_data || {})
  const [busy, setBusy] = useState(false)
  const [shareLink, setShareLink] = useState<string | null>(
    initial?.share_token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/seller-form/${listingId}/${initial.share_token}` : null,
  )

  const set = (key: string, value: string | boolean) => setValues((v) => ({ ...v, [key]: value }))

  const saveDraft = async () => {
    setBusy(true)
    try {
      await saveSellerFormDraft(listingId, formType, values)
      toast('Saved', 'success')
      onSaved()
    } catch (e: any) {
      toast(e.message || 'Save failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  const sendToSeller = async () => {
    setBusy(true)
    try {
      const token = await sendSellerFormToSeller(listingId, formType, values)
      const link = `${window.location.origin}/seller-form/${listingId}/${token}`
      setShareLink(link)
      await navigator.clipboard?.writeText(link).catch(() => {})
      toast('Link generated and copied to clipboard', 'success')
    } catch (e: any) {
      toast(e.message || 'Could not generate link', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.55)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '30px 16px', overflowY: 'auto' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, maxWidth: 760, width: '100%', padding: 28, maxHeight: '92vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 19, color: 'var(--navy)' }}>{schema.title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
        </div>
        {schema.intro && <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 18px' }}>{schema.intro}</p>}

        {initial?.status === 'signed' && (
          <div style={{ background: '#e8f7ee', color: '#16a34a', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
            ✓ Signed by {initial.signer_name} on {initial.signed_at ? new Date(initial.signed_at).toLocaleDateString() : ''} — fields below are read-only.
          </div>
        )}

        <DynamicFormFields sections={schema.sections} values={values} onChange={set} readOnly={initial?.status === 'signed'} />

        {shareLink && (
          <div style={{ marginTop: 18, padding: '10px 14px', background: 'var(--cream)', borderRadius: 8, fontSize: 12.5 }}>
            Share this link with the seller: <a href={shareLink} target="_blank" rel="noreferrer" style={{ color: 'var(--navy)', fontWeight: 600 }}>{shareLink}</a>
          </div>
        )}

        {initial?.status !== 'signed' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Close</button>
            <button className="btn btn-ghost" onClick={saveDraft} disabled={busy}>{busy ? 'Saving…' : 'Save Draft'}</button>
            {schema.requiresSignature && (
              <button className="btn btn-primary" onClick={sendToSeller} disabled={busy}>{busy ? 'Working…' : 'Send to Seller for Signature'}</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
