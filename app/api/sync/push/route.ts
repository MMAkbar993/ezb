import { NextRequest, NextResponse } from 'next/server'
import { fetchListing } from '@/lib/listings'
import { syncListingToBbs } from '@/lib/bbs'
import { requireUser, unauthorized } from '@/lib/apiAuth'

// ---------------------------------------------------------------------------
// POST /api/sync/push — push a listing to external marketplaces (BizBuySell).
// Called by the workflow Step 8 (auto-publish) and manually from the sync UI.
// Requires a signed-in broker session. Graceful: returns ok even if
// marketplace credentials aren't configured (the existing sync service
// simulates the push and records it).
// ---------------------------------------------------------------------------

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth) return unauthorized()

  const { listingId, provider } = await req.json().catch(() => ({}))
  if (!listingId) return NextResponse.json({ ok: false, error: 'missing listingId' }, { status: 400 })

  try {
    const listing = await fetchListing(listingId)
    if (!listing) return NextResponse.json({ ok: false, error: 'listing not found' }, { status: 404 })

    // BizBuySell (always push to BBS on listing).
    if (!provider || provider === 'bizbuysell') {
      await syncListingToBbs(listing)
    }

    return NextResponse.json({ ok: true, pushed: [provider || 'bizbuysell'] })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'push failed' }, { status: 500 })
  }
}
