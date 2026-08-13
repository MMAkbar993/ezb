import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { SELLER_FORM_SCHEMAS, type SellerFormType } from '@/lib/sellerFormSchemas'
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

// The Exclusive Marketing & Listing Agreement's numbered clauses, with
// commission % / minimum fee / term interpolated from the broker's filled
// values (falling back to EZ Business Advisors' standard terms — 8%,
// $15,000 minimum, 12 months — when left blank). The other clauses are
// fixed boilerplate, reproduced verbatim from the source agreement.
function buildListingAgreementClauses(formData: Record<string, unknown>): string[] {
  const commission = formData.broker_commission_percent ? Number(formData.broker_commission_percent) : 8
  const minFee = formData.commission_minimum_fee ? Number(formData.commission_minimum_fee) : 15000
  const termMonths = formData.agreement_term_months ? Number(formData.agreement_term_months) : 12
  const minFeeStr = minFee.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

  return [
    '1. Exclusive Right to Market. Seller grants Broker the exclusive right to market and seek a purchaser for the Business during the Term. Broker is a licensed business broker acting solely as a transaction intermediary. Broker is NOT a real estate broker or real estate agent, and this Agreement does not confer real estate brokerage authority.',
    `2. Term. The initial term of this Agreement is ${termMonths} month${termMonths === 1 ? '' : 's'} beginning on the date of execution, unless extended in writing by the parties.`,
    "3. Marketing and Co-Brokerage. Broker may advertise, market, and co-broke the listing in Broker's sole discretion, including listing on business-for-sale platforms, co-brokering with other business brokers, and any other lawful marketing activity.",
    `4. Broker Compensation. Seller shall pay Broker ${commission}% of the total sales price, with a minimum fee of ${minFeeStr}, due upon Closing or upon Broker's procurement of a ready, willing, and able buyer on terms acceptable to Seller, whichever occurs first.`,
    '5. Seller Cooperation. Seller shall cooperate fully with Broker, including timely referral of all inquiries, prompt disclosure of all relevant information, attendance at closing if requested, and delivery of all closing documents in a timely manner.',
    "6. Seller Representations. Seller represents that all information supplied is accurate to the best of Seller's knowledge and may be relied upon by Broker and prospective purchasers. Seller shall promptly notify Broker of any material change in business conditions, financial performance, or legal status.",
    "7. Indemnification. Seller agrees to indemnify and hold Broker harmless from any claims, losses, damages, costs, and attorneys' fees arising from false, incomplete, or misleading information supplied by Seller, or from Seller's breach of any obligation under this Agreement.",
    "8. Governing Law; Venue. This Agreement is governed by the laws of the Commonwealth of Pennsylvania. Any action shall be brought in Dauphin County, Pennsylvania, or the federal court serving Harrisburg, PA, unless otherwise required by law. The prevailing party is entitled to reasonable attorneys' fees.",
    "9. Electronic Signatures. Electronic signatures and electronic delivery are valid and binding to the fullest extent permitted by Pennsylvania's Electronic Transactions Act, 73 P.S. § 2260.101 et seq.",
    '10. Entire Agreement. This Agreement contains the entire understanding of the parties and supersedes all prior discussions, negotiations, and representations. It may be modified only in a signed writing executed by both parties.',
  ]
}

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
