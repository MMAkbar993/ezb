import { NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Social OAuth callback — proxy to the oauth handler so both
//   /api/social/oauth and /api/social/callback work for provider redirects.
// ---------------------------------------------------------------------------
export async function GET(req: Request) {
  const url = new URL(req.url)
  const params = url.searchParams
  const targetUrl = new URL('/api/social/oauth', url.origin)
  for (const [k, v] of params.entries()) {
    targetUrl.searchParams.set(k, v)
  }
  const upstream = await fetch(targetUrl.toString(), { headers: { cookie: req.headers.get('cookie') || '' } })
  const body = await upstream.json()
  return NextResponse.json(body, { status: upstream.status })
}

export const POST = GET
