import { NextRequest, NextResponse } from 'next/server'
import { requireUser, unauthorized } from '@/lib/apiAuth'

// ---------------------------------------------------------------------------
// GET /api/listing-nda-signatures?listingId= — authenticated brokers only.
// listing_nda_signatures deliberately has zero RLS policies (service-role
// only, see sql/listing_nda_signatures.sql), so real signed buyer NDA +
// Buyer Profile Form submissions are only readable through this route.
// ---------------------------------------------------------------------------

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth) return unauthorized()

  const listingId = req.nextUrl.searchParams.get('listingId') || ''
  if (!listingId) return NextResponse.json({ ok: false, error: 'Missing listingId.' }, { status: 400 })

  const { data, error } = await auth.supabase
    .from('listing_nda_signatures')
    .select('id, listing_id, buyer_name, buyer_email, nda_form_data, buyer_profile, guide_acknowledged, pdf_url, signed_at, ip_address')
    .eq('listing_id', listingId)
    .order('signed_at', { ascending: false })

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, inquiries: data || [] })
}
