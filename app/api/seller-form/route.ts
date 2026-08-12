import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { SELLER_FORM_SCHEMAS, type SellerFormType } from '@/lib/sellerFormSchemas'

// ---------------------------------------------------------------------------
// GET /api/seller-form?listingId=&token= — fetch a seller form for the
// no-login remote-signing page. The token is the only auth — same "token IS
// the auth" pattern as the client portal and buyer NDA routes. Service-role
// only; seller_forms has no public RLS policy.
// ---------------------------------------------------------------------------

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const svc = createServerClient()
  if (!svc) return NextResponse.json({ ok: false, error: 'Not configured.' }, { status: 503 })

  const listingId = req.nextUrl.searchParams.get('listingId') || ''
  const token = req.nextUrl.searchParams.get('token') || ''
  if (!listingId || !token) return NextResponse.json({ ok: false, error: 'Missing listingId or token.' }, { status: 400 })

  const { data: row, error } = await svc
    .from('seller_forms')
    .select('*')
    .eq('listing_id', listingId)
    .eq('share_token', token)
    .maybeSingle()
  if (error || !row) return NextResponse.json({ ok: false, error: 'This link is invalid or has expired.' }, { status: 404 })

  const schema = SELLER_FORM_SCHEMAS[row.form_type as SellerFormType]
  if (!schema) return NextResponse.json({ ok: false, error: 'Unknown form type.' }, { status: 500 })

  const { data: listing } = await svc.from('listings').select('business_name').eq('id', listingId).maybeSingle()

  return NextResponse.json({
    ok: true,
    schema: { title: schema.title, intro: schema.intro, sections: schema.sections, requiresSignature: schema.requiresSignature },
    formData: row.form_data || {},
    status: row.status,
    signerName: row.signer_name,
    signedAt: row.signed_at,
    businessName: listing?.business_name || null,
  })
}
