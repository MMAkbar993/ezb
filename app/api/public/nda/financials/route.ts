import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// GET /api/public/nda/financials?listingId=&token= — returns the full
// financial figures for ONE listing, ONLY if the token matches a recorded
// NDA signature for that exact listing. This is the only path by which
// financials reach a buyer who hasn't been granted public visibility by the
// broker (public_listings.show_financials) — the safe public_listing_feed
// view itself is never loosened.
// ---------------------------------------------------------------------------

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const svc = createServerClient()
  if (!svc) return NextResponse.json({ ok: false, error: 'Not configured.' }, { status: 503 })

  const listingId = req.nextUrl.searchParams.get('listingId') || ''
  const token = req.nextUrl.searchParams.get('token') || ''
  if (!listingId || !token) {
    return NextResponse.json({ ok: false, error: 'Missing listingId or token.' }, { status: 400 })
  }

  const { data: signature } = await svc
    .from('listing_nda_signatures')
    .select('id')
    .eq('listing_id', listingId)
    .eq('unlock_token', token)
    .maybeSingle()
  if (!signature) {
    return NextResponse.json({ ok: false, error: 'No valid NDA on file for this listing.' }, { status: 403 })
  }

  const { data: listing, error } = await svc
    .from('listings')
    .select('annual_revenue, sde, ebitda, inventory_value, ffe_value')
    .eq('id', listingId)
    .maybeSingle()
  if (error || !listing) {
    return NextResponse.json({ ok: false, error: 'Listing not found.' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, financials: listing })
}
