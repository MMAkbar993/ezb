import { NextRequest, NextResponse } from 'next/server'
import { getRecastPreview } from '@/lib/autoGenerate'
import { createServerClient } from '@/lib/supabase/server'

// =============================================================================
// GET /api/financial/recast-preview?listingId=uuid
// -----------------------------------------------------------------------------
// Read-only: returns the real, AI-extracted financial history for a listing's
// uploaded documents (same extraction runAutoGeneration uses for BOV/CIM),
// with no generation and no writes. Used by the standalone Recast tool to
// start from real numbers instead of a blank form.
// =============================================================================

export const runtime = 'nodejs'

function bearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  return m ? m[1] : null
}

export async function GET(req: NextRequest) {
  const token = bearerToken(req)
  const supabase = createServerClient()
  if (!supabase) return NextResponse.json({ ok: false, error: 'Server client not configured.' }, { status: 500 })
  if (!token) return NextResponse.json({ ok: false, error: 'Missing authorization header.' }, { status: 401 })
  const { data: user, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user?.user) return NextResponse.json({ ok: false, error: 'Invalid or expired session.' }, { status: 401 })

  const listingId = req.nextUrl.searchParams.get('listingId') || ''
  if (!listingId) return NextResponse.json({ ok: false, error: 'listingId is required.' }, { status: 400 })

  try {
    const result = await getRecastPreview(listingId)
    return NextResponse.json(result, { status: result.ok ? 200 : 500 })
  } catch (err) {
    const msg = (err as Error)?.message || 'Preview failed'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
