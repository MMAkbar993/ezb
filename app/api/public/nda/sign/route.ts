import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServerClient } from '@/lib/supabase/server'
import { generateNdaProfilePdf } from '@/lib/buyerFormPdf.server'
import { FF_BUCKET } from '@/lib/storageBuckets'

// ---------------------------------------------------------------------------
// POST /api/public/nda/sign — accountless, per-listing NDA + Buyer Profile
// Form signature. Body: { listingId, name, email, guideAcknowledged,
// ndaFormData, buyerProfile }. Returns: { ok, token } — the token unlocks
// ONLY this listing's financials via GET /api/public/nda/financials. No
// login, no account, nothing else on the site is gated by this.
// ---------------------------------------------------------------------------

export const runtime = 'nodejs'

function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

export async function POST(req: NextRequest) {
  const svc = createServerClient()
  if (!svc) return NextResponse.json({ ok: false, error: 'Not configured.' }, { status: 503 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 })
  }

  const listingId = String(body?.listingId || '')
  const name = String(body?.name || '').trim()
  const email = String(body?.email || '').trim()
  const guideAcknowledged = body?.guideAcknowledged === true
  const ndaFormData = (body?.ndaFormData && typeof body.ndaFormData === 'object') ? body.ndaFormData : {}
  const buyerProfile = (body?.buyerProfile && typeof body.buyerProfile === 'object') ? body.buyerProfile : {}

  if (!listingId || !name || !email) {
    return NextResponse.json({ ok: false, error: 'Name, email, and listing are required.' }, { status: 400 })
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: 'Please enter a valid email address.' }, { status: 400 })
  }
  if (!guideAcknowledged) {
    return NextResponse.json({ ok: false, error: 'Please confirm you have read the Buyer Forms Overview & Confidentiality Guide.' }, { status: 400 })
  }

  // Only a published listing can be NDA'd — the same gate the public feed uses.
  const { data: listing, error: listingErr } = await svc
    .from('public_listing_feed')
    .select('id, business_name, industry')
    .eq('id', listingId)
    .maybeSingle()
  if (listingErr || !listing) {
    return NextResponse.json({ ok: false, error: 'Listing not found.' }, { status: 404 })
  }

  const token = crypto.randomBytes(32).toString('hex')
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  const userAgent = req.headers.get('user-agent') || null
  const signedAt = new Date().toISOString()

  // Generate the buyer's REAL Confidentiality Agreement + Buyer Profile Form
  // (his actual branded PDFs, filled in — not a re-typeset summary) for the
  // broker's records. Contains the buyer's home address, driver's
  // license/EIN, and net worth — goes in the private financial_docs bucket,
  // never the public one. pdf_url stores the storage PATH; the broker
  // dashboard resolves a signed URL on demand. Best-effort — a PDF failure
  // should never block the buyer's unlock.
  let pdfPath: string | null = null
  try {
    const bytes = await generateNdaProfilePdf({
      listingId, businessCategory: listing.industry, ndaFormData, buyerProfile, signerName: name, signedAt,
    })

    const path = `nda-forms/${listingId}/${Date.now()}-${email.replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`
    const { error: upErr } = await svc.storage.from(FF_BUCKET).upload(path, Buffer.from(bytes), { contentType: 'application/pdf', upsert: false })
    if (!upErr) pdfPath = path
  } catch {
    /* non-fatal */
  }

  const { error: insErr } = await svc.from('listing_nda_signatures').insert({
    listing_id: listingId,
    buyer_name: name,
    buyer_email: email,
    unlock_token: token,
    ip_address: ip,
    user_agent: userAgent,
    nda_form_data: ndaFormData,
    buyer_profile: buyerProfile,
    guide_acknowledged: guideAcknowledged,
    pdf_url: pdfPath,
  })
  if (insErr) {
    return NextResponse.json({ ok: false, error: 'Could not record signature. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, token })
}
