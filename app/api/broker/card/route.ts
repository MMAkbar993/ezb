import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// GET /api/broker/card?brokerId=<uuid>
// Public card data fetch (no auth) for the shared /card/<id> and /qr/<id>
// pages. Uses the service role so anyone with the share link can view the card
// even without a Supabase session. Resolves broker_profiles + brand + agency.
// ---------------------------------------------------------------------------

export const runtime = 'nodejs'

const SVC = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || 'NO_KEY', {
      auth: { persistSession: false },
    })
  : null

export async function GET(req: NextRequest) {
  const brokerId = req.nextUrl.searchParams.get('brokerId') || ''
  if (!brokerId || !SVC) {
    return NextResponse.json({ ok: false, error: 'missing params or not configured' }, { status: 400 })
  }

  const { data: profile, error } = await SVC
    .from('broker_profiles')
    .select('*')
    .eq('id', brokerId)
    .eq('is_public', true)
    .maybeSingle()

  if (error || !profile) {
    return NextResponse.json({ ok: false, error: 'broker not found' }, { status: 404 })
  }

  // Resolve agency brand + name.
  let agency: Record<string, unknown> | null = null
  if (profile.agency_id) {
    const mem = await SVC.from('agency_members')
      .select('agency:agencies(id, name, brand_primary_color, brand_secondary_color, brand_accent_color, brand_font, brand_logo_url, brand_color, accent_color, logo_url)')
      .eq('agency_id', profile.agency_id)
      .eq('profile_id', profile.profile_id)
      .maybeSingle()
    agency = (mem.data as any)?.agency || null
  }

  return NextResponse.json({
    ok: true,
    card: {
      id: profile.id,
      public_name: profile.public_name,
      title: profile.title,
      bio: profile.bio,
      phone: profile.phone,
      email_public: profile.email_public,
      website: profile.website,
      photo_url: profile.photo_url,
      back_text: profile.back_text,
      qr_code_url: profile.qr_code_url || `${req.nextUrl.origin}/qr/${profile.id}`,
      vcard_data: profile.vcard_data || null,
      brand: {
        primaryColor: profile.card_primary_color || agency?.brand_primary_color || agency?.brand_color || '#1a1a2e',
        secondaryColor: profile.card_secondary_color || agency?.brand_secondary_color || '#16213e',
        accentColor: profile.card_accent_color || agency?.brand_accent_color || agency?.accent_color || '#c9a84c',
        font: profile.card_font || agency?.brand_font || 'georgia',
        logoUrl: profile.card_logo_url || agency?.brand_logo_url || agency?.logo_url || null,
        layout: profile.card_layout || 'classic',
      },
      agency: agency ? { id: (agency as any).id, name: (agency as any).name } : null,
    },
  })
}
