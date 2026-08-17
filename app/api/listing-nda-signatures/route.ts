import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { requireUser, unauthorized } from '@/lib/apiAuth'
import { NDA_FORM_SECTIONS, BUYER_PROFILE_SECTIONS } from '@/lib/buyerFormSchemas'
import { exportFilledFormToPdf } from '@/lib/formPdf'
import { FF_BUCKET } from '@/lib/storageBuckets'

// ---------------------------------------------------------------------------
// GET /api/listing-nda-signatures?listingId= — authenticated brokers only.
// Omit listingId to get every signed inquiry across all listings (used by
// the unified Documents dashboard). listing_nda_signatures deliberately has
// zero RLS policies (service-role only, see sql/listing_nda_signatures.sql),
// so real signed buyer NDA + Buyer Profile Form submissions are only
// readable through this route.
// ---------------------------------------------------------------------------

export const runtime = 'nodejs'

const SELECT_COLUMNS = 'id, listing_id, buyer_name, buyer_email, nda_form_data, buyer_profile, guide_acknowledged, pdf_url, signed_at, ip_address'

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth) return unauthorized()

  const listingId = req.nextUrl.searchParams.get('listingId') || ''

  let query = auth.supabase.from('listing_nda_signatures').select(SELECT_COLUMNS).order('signed_at', { ascending: false })
  if (listingId) query = query.eq('listing_id', listingId)

  const { data, error } = await query
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, inquiries: data || [] })
}

// ---------------------------------------------------------------------------
// POST /api/listing-nda-signatures — authenticated brokers only. Lets an
// agent record a buyer's NDA + Buyer Profile Form directly in the dashboard
// (buyer called in, filled it out in person, etc.) instead of requiring the
// buyer to use the public accountless gate. Produces the exact same signed
// PDF + listing_nda_signatures row the public flow does, so it shows up
// identically in the broker's Buyer Inquiries list.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth) return unauthorized()

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 }) }

  const listingId = String(body?.listingId || '')
  const buyerName = String(body?.buyerName || '').trim()
  const buyerEmail = String(body?.buyerEmail || '').trim()
  const ndaFormData = (body?.ndaFormData && typeof body.ndaFormData === 'object') ? body.ndaFormData : {}
  const buyerProfile = (body?.buyerProfile && typeof body.buyerProfile === 'object') ? body.buyerProfile : {}

  if (!listingId || !buyerName || !buyerEmail) {
    return NextResponse.json({ ok: false, error: 'Listing, buyer name, and buyer email are required.' }, { status: 400 })
  }

  const { data: listing, error: listingErr } = await auth.supabase.from('listings').select('id, business_name, industry').eq('id', listingId).maybeSingle()
  if (listingErr || !listing) return NextResponse.json({ ok: false, error: 'Listing not found.' }, { status: 404 })

  const token = crypto.randomBytes(32).toString('hex')
  const signedAt = new Date().toISOString()

  let pdfPath: string | null = null
  try {
    const bytes = exportFilledFormToPdf(
      {
        title: 'Confidentiality & Registration Agreement + Buyer Profile Form',
        subtitle: listing.business_name || 'Business Listing',
        sections: [
          { title: 'Listing', fields: [
            { key: '_listing_id', label: 'Business Listing ID No.', type: 'text' },
            { key: '_business_category', label: 'Business Category', type: 'text' },
          ] },
          ...NDA_FORM_SECTIONS,
          ...BUYER_PROFILE_SECTIONS,
        ],
        values: { _listing_id: listing.id, _business_category: listing.industry || '—', ...ndaFormData, ...buyerProfile },
        signerName: buyerName,
        signedAt,
        ipNote: `Entered in-app by broker (${auth.user.email || auth.user.id}) on behalf of the buyer.`,
      },
      { returnBytes: true },
    ) as Uint8Array

    const path = `nda-forms/${listingId}/${Date.now()}-${buyerEmail.replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`
    const { error: upErr } = await auth.supabase.storage.from(FF_BUCKET).upload(path, Buffer.from(bytes), { contentType: 'application/pdf', upsert: false })
    if (!upErr) pdfPath = path
  } catch {
    /* non-fatal — the structured form data is still saved below */
  }

  const { data, error: insErr } = await auth.supabase.from('listing_nda_signatures').insert({
    listing_id: listingId,
    buyer_name: buyerName,
    buyer_email: buyerEmail,
    unlock_token: token,
    nda_form_data: ndaFormData,
    buyer_profile: buyerProfile,
    guide_acknowledged: true,
    pdf_url: pdfPath,
  }).select(SELECT_COLUMNS).single()
  if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, inquiry: data })
}
