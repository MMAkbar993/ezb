import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { SELLER_FORM_SCHEMAS, buildListingAgreementClauses, type SellerFormType } from '@/lib/sellerFormSchemas'
import { exportFilledFormToPdf } from '@/lib/formPdf'
import { FF_BUCKET } from '@/lib/storageBuckets'

// ---------------------------------------------------------------------------
// POST /api/seller-form/sign — seller reviews and signs a seller-form link
// (no login; the share_token is the auth). Saves the answers and generates a
// filled PDF (lib/formPdf.ts — same jsPDF engine as Recast/BOV/CIM/BLI).
//
// The PDF contains the seller's home address, phone, and business financial
// figures — it goes in the private `financial_docs` bucket (FF_BUCKET), the
// same one financial documents were moved into earlier this session, never
// the public `documents` bucket. `seller_forms.pdf_url` stores the storage
// PATH, not a public URL — the broker dashboard resolves a short-lived
// signed URL on demand (lib/financialFiles.ts::getSignedFileUrl) rather than
// linking a permanent public one.
// ---------------------------------------------------------------------------

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const svc = createServerClient()
  if (!svc) return NextResponse.json({ ok: false, error: 'Not configured.' }, { status: 503 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 }) }

  const listingId = String(body?.listingId || '')
  const token = String(body?.token || '')
  const formData = (body?.formData && typeof body.formData === 'object') ? body.formData : {}
  const signerName = String(body?.signerName || '').trim()
  const signerTitle = String(body?.signerTitle || '').trim()

  if (!listingId || !token || !signerName) {
    return NextResponse.json({ ok: false, error: 'Name and signature are required.' }, { status: 400 })
  }

  const { data: row, error: findErr } = await svc
    .from('seller_forms')
    .select('*')
    .eq('listing_id', listingId)
    .eq('share_token', token)
    .maybeSingle()
  if (findErr || !row) return NextResponse.json({ ok: false, error: 'This link is invalid or has expired.' }, { status: 404 })
  if (row.status === 'signed') return NextResponse.json({ ok: false, error: 'This document has already been signed.', alreadySigned: true }, { status: 409 })

  const schema = SELLER_FORM_SCHEMAS[row.form_type as SellerFormType]
  if (!schema) return NextResponse.json({ ok: false, error: 'Unknown form type.' }, { status: 500 })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  const userAgent = req.headers.get('user-agent') || null
  const signedAt = new Date().toISOString()

  const { data: listing } = await svc.from('listings').select('business_name').eq('id', listingId).maybeSingle()

  // Generate the filled PDF and store it in the private financial_docs
  // bucket — pdf_url holds the storage PATH, resolved to a signed URL only
  // when an authenticated broker asks to view it.
  let pdfPath: string | null = null
  try {
    const bytes = exportFilledFormToPdf(
      {
        title: schema.title,
        subtitle: listing?.business_name || 'Business Listing',
        intro: schema.intro,
        sections: schema.sections,
        values: formData,
        signerName,
        signerTitle,
        signedAt,
        ipNote: `Signed from IP ${ip || 'unknown'}`,
        ...(row.form_type === 'listing_agreement'
          ? { clauseTitle: 'Agreement Terms', clauseText: buildListingAgreementClauses(formData) }
          : {}),
      },
      { returnBytes: true },
    ) as Uint8Array

    const path = `seller-forms/${listingId}/${Date.now()}-${row.form_type}.pdf`
    const { error: upErr } = await svc.storage.from(FF_BUCKET).upload(path, Buffer.from(bytes), { contentType: 'application/pdf', upsert: false })
    if (!upErr) pdfPath = path
  } catch {
    // PDF generation/storage failure shouldn't block the signature itself —
    // the structured form_data is already the source of truth.
  }

  const { error: updateErr } = await svc
    .from('seller_forms')
    .update({
      form_data: formData, status: 'signed', signer_name: signerName, signer_title: signerTitle || null,
      signed_at: signedAt, ip_address: ip, user_agent: userAgent, pdf_url: pdfPath, updated_at: signedAt,
    })
    .eq('id', row.id)
  if (updateErr) return NextResponse.json({ ok: false, error: 'Could not save your signature. Please try again.' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
