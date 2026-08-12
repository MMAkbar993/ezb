'use client'

import { useEffect, useState } from 'react'
import { StepShell, stepField, stepLabel, stepBtn } from '@/components/listings/StepShell'
import { uploadListingDocument, fetchListingDocuments, completeStep } from '@/lib/workflow'
import { supabase } from '@/lib/supabase/client'
import LegalDocumentsPanel from '@/components/listings/LegalDocumentsPanel'

// ---------------------------------------------------------------------------
// Step 1 — Legal Docs (listing agreement + disclosures)
// ---------------------------------------------------------------------------

export default function Step1LegalDocs({ listingId, onNext }: { listingId: string; onNext: () => void }) {
  const [docs, setDocs] = useState<any[]>([])
  const [agreementUrl, setAgreementUrl] = useState('')
  const [agreementName, setAgreementName] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => setDocs(await fetchListingDocuments(listingId))

  useEffect(() => { load() }, [listingId])

  const addDoc = async (file: File, type: string) => {
    setBusy(true)
    try {
      // Upload to storage (best-effort) then record metadata.
      const path = `listing-docs/${listingId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error: upErr } = await supabase.storage.from('documents').upload(path, file)
      if (upErr) { alert('Upload failed — ensure the documents bucket exists'); setBusy(false); return }
      const url = supabase.storage.from('documents').getPublicUrl(path).data.publicUrl
      await uploadListingDocument(listingId, { document_type: type, file_name: file.name, file_url: url })
      await load()
    } finally { setBusy(false) }
  }

  const hasAgreement = docs.some((d) => d.document_type === 'listing_agreement')
  const ndaCount = docs.filter((d) => d.document_type === 'nda').length
  const ready = hasAgreement

  const markComplete = async () => { await completeStep(listingId, 1); onNext() }

  return (
    <StepShell
      step={1} title="Legal Documents" description="Upload the signed listing agreement and any disclosures to authorize the engagement."
      status="draft" onNext={markComplete} nextDisabled={!ready} nextLabel="Step 1 complete →"
    >
      {/* Signed listing agreement */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>Listing agreement (required)</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={agreementName} onChange={(e) => setAgreementName(e.target.value)} placeholder="Document title (e.g. Listing Agreement — 2026)" style={{ ...stepField, flex: 1, minWidth: 220 }} onKeyDown={(e) => { if (hasAgreement) return }} />
          <label style={stepBtn(true)}>Choose file
            <input type="file" style={{ display: 'none' }} onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setAgreementName(f.name); await addDoc(f, 'listing_agreement') } e.target.value = '' }} />
          </label>
        </div>
        {hasAgreement && <div style={{ marginTop: 8, fontSize: 13, color: '#16a34a', fontWeight: 600 }}>✓ Listing agreement uploaded</div>}
      </div>

      {/* Other legal docs */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>Supporting disclosures (optional)</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <label style={stepBtn(false)}>+ NDA template
            <input type="file" style={{ display: 'none' }} onChange={async (e) => { const f = e.target.files?.[0]; if (f) await addDoc(f, 'nda'); e.target.value = '' }} />
          </label>
          <label style={stepBtn(false)}>+ Financial proof / other
            <input type="file" style={{ display: 'none' }} onChange={async (e) => { const f = e.target.files?.[0]; if (f) await addDoc(f, 'financial_proof'); e.target.value = '' }} />
          </label>
        </div>
      </div>

      {/* Uploaded docs list */}
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {docs.map((d) => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8 }}>
            <span style={{ fontSize: 16 }}>📎</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.file_name || d.document_type}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'capitalize' }}>{d.document_type} · {d.status}</div>
            </div>
            <a href={d.file_url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--navy)', fontWeight: 600 }}>View ↗</a>
          </div>
        ))}
        {docs.length === 0 && <div style={{ fontSize: 13, color: 'var(--muted)' }}>No documents uploaded yet.</div>}
      </div>

      <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid var(--line)' }}>
        <LegalDocumentsPanel listingId={listingId} />
      </div>
    </StepShell>
  )
}
