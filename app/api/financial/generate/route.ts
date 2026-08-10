import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { runAutoGeneration } from '@/lib/autoGenerate'
import { createServerClient } from '@/lib/supabase/server'

// =============================================================================
// POST /api/financial/generate — One-Click auto-generation pipeline.
// -----------------------------------------------------------------------------
// Body:
//   {
//     "listingId": "uuid",          // the listing to generate documents for
//     "dealId":     "uuid" | null    // optional deal to attach generated docs
//   }
//
// Runs Recast -> BOV -> CIM -> BLI server-side (deterministic generators +
// Claude-assisted financial extraction), writes each PDF to the 'documents'
// bucket, records generated_document rows in financial_documents, and marks
// source uploads as processed. Returns the pipeline artifacts + notes.
//
// SECURITY: server-only. The service-role key + Anthropic key never ship to
// the browser. A dynamic import keeps this route from bloating the client.
// =============================================================================

const generateSchema = z.object({
  listingId: z.string().uuid(),
  dealId: z.string().uuid().nullish(),
})

export const runtime = 'nodejs'

// Extract a Supabase access token from the Authorization header.
function bearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  return m ? m[1] : null
}

export async function POST(req: NextRequest) {
  // 0) Auth gate — the pipeline writes documents via the service-role client
  //    (bypasses RLS), so we must confirm the caller is a signed-in user.
  const token = bearerToken(req)
  const supabase = createServerClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'Server client not configured.' }, { status: 500 })
  }
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Missing authorization header.' }, { status: 401 })
  }
  const { data: user, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user?.user) {
    return NextResponse.json({ ok: false, error: 'Invalid or expired session.' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  const parsed = generateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Validation failed', detail: parsed.error.issues[0]?.message },
      { status: 422 },
    )
  }

  const { listingId, dealId } = parsed.data

  try {
    const result = await runAutoGeneration({ listingId, dealId: dealId ?? null })
    return NextResponse.json(result, { status: result.ok ? 200 : 500 })
  } catch (err) {
    const msg = (err as Error)?.message || 'Auto-generation failed'
    console.error('[financial/generate] error:', msg)
    return NextResponse.json({ ok: false, error: msg, artifacts: [], notes: [] }, { status: 500 })
  }
}
