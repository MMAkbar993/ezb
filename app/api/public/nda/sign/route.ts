import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServerClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// POST /api/public/nda/sign — accountless, per-listing NDA signature.
// Body: { listingId, name, email }
// Returns: { ok, token } — the token unlocks ONLY this listing's financials
// via GET /api/public/nda/financials. No login, no account, nothing else on
// the site is gated by this.
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

  if (!listingId || !name || !email) {
    return NextResponse.json({ ok: false, error: 'Name, email, and listing are required.' }, { status: 400 })
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: 'Please enter a valid email address.' }, { status: 400 })
  }

  // Only a published listing can be NDA'd — the same gate the public feed uses.
  const { data: listing, error: listingErr } = await svc
    .from('public_listing_feed')
    .select('id')
    .eq('id', listingId)
    .maybeSingle()
  if (listingErr || !listing) {
    return NextResponse.json({ ok: false, error: 'Listing not found.' }, { status: 404 })
  }

  const token = crypto.randomBytes(32).toString('hex')
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  const userAgent = req.headers.get('user-agent') || null

  const { error: insErr } = await svc.from('listing_nda_signatures').insert({
    listing_id: listingId,
    buyer_name: name,
    buyer_email: email,
    unlock_token: token,
    ip_address: ip,
    user_agent: userAgent,
  })
  if (insErr) {
    return NextResponse.json({ ok: false, error: 'Could not record signature. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, token })
}
