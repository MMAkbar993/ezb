import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { validateServerInput, commonSchemas } from '@cosmstack/blackshield/server'

// =============================================================================
// BizBuySell webhook — receives lead + sync events from the platform.
// Requires a service-role key to write to the leads/webhook tables bypassing
// RLS. In production, protect with a shared secret header (e.g. x-bbs-token).
//
// Security hardening (blackshield):
//   * Secret-header auth required in production.
//   * Incoming JSON payload is validated against a Zod schema before any
//     write to the DB — rejects malformed / oversized / type-confused input.
//   * Signed-cookie style helpers available; here we rely on secret + schema.
// =============================================================================

const BBS_WEBHOOK_SECRET = process.env.BBS_WEBHOOK_SECRET || 'dev-secret'
const MAX_PAYLOAD_BYTES = 64 * 1024 // 64 KB cap to avoid abuse

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

// --- Server-side input contract ---------------------------------------------
// Accept a flexible but *bounded* event shape. Fields we consume are
// validated; unknown fields are allowed but truncated for logging.
const webhookEventSchema = z.object({
  event: z.string().max(64).optional(),
  type: z.string().max(64).optional(),
  event_type: z.string().max(64).optional(),
  buyerEmail: commonSchemas.email.optional(),
  email: commonSchemas.email.optional(),
  contact_email: commonSchemas.email.optional(),
  buyerPhone: z.string().max(40).optional(),
  phone: z.string().max(40).optional(),
  listingId: commonSchemas.id.optional(),
  listing_id: commonSchemas.id.optional(),
}) as z.ZodType<Record<string, unknown>>

export async function POST(req: NextRequest) {
  // 1) Auth: shared-secret header (required in production)
  if (process.env.NODE_ENV === 'production') {
    const token = req.headers.get('x-bbs-token')
    if (!token || token !== BBS_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // 2) Bounded body
  const raw = await req.text().catch(() => '')
  if (!raw) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  if (Buffer.byteLength(raw, 'utf8') > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // 3) Validate with blackshield
  const validation = validateServerInput(webhookEventSchema, body)
  if (!validation.isValid) {
    const first = Object.values(validation.errors)[0]?.[0]
    return NextResponse.json({ error: 'Validation failed', detail: first }, { status: 422 })
  }
  const safe = body as Record<string, unknown>

  const supabase = adminClient()
  const eventType = String(safe.event || safe.type || safe.event_type || 'lead').slice(0, 64)

  // 4) Log the event (truncate nested objects to avoid huge rows)
  const safeEmail = String(
    safe.buyerEmail || safe.email || safe.contact_email || '',
  ).slice(0, 254)
  const safePhone = String(safe.buyerPhone || safe.phone || '').slice(0, 40)
  const safeId = String(safe.listingId || safe.listing_id || '').slice(0, 36)

  const logPayload: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(safe)) {
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null) {
      logPayload[k] = typeof v === 'string' ? v.slice(0, 512) : v
    }
  }

  try {
    const { error: logErr } = await supabase.from('webhook_events').insert({
      provider: 'bizbuysell',
      event_type: eventType,
      payload_json: logPayload,
      processed: true,
    })
    if (logErr) throw logErr
  } catch (err: any) {
    console.error('webhook_events insert failed:', err?.message)
  }

  // 5) If it's a lead event, create a buyer lead (validated email required)
  if (eventType.toLowerCase().includes('lead')) {
    if (!safeEmail) {
      return NextResponse.json({ error: 'Missing email for lead event' }, { status: 422 })
    }
    const { error } = await supabase.from('buyer_leads').insert({
      email: safeEmail || null,
      phone: safePhone || null,
      status: 'new',
    })
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
