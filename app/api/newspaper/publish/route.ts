import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { renderNewspaperHtml } from '@/lib/newspaper'
import { requireUser, unauthorized } from '@/lib/apiAuth'

// ---------------------------------------------------------------------------
// POST /api/newspaper/publish — distributes a published edition to all active
// subscribers. Runs server-side with the service role so the email queue rows
// (email_emails) are inserted even though subscribers are external (no
// Supabase session) and the smtp send is attempted by the worker. Triggering
// a send requires a signed-in broker session — subscribers themselves never
// call this route.
// ---------------------------------------------------------------------------

export const runtime = 'nodejs'

const SVC = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || 'NO_KEY', {
      auth: { persistSession: false },
    })
  : null

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth) return unauthorized()

  if (!SVC) return NextResponse.json({ ok: false, error: 'server not configured' }, { status: 503 })
  const { editionId } = await req.json().catch(() => ({}))
  if (!editionId) return NextResponse.json({ ok: false, error: 'missing editionId' }, { status: 400 })

  const { data: edition } = await SVC.from('newspaper_editions').select('*').eq('id', editionId).single()
  if (!edition) return NextResponse.json({ ok: false, error: 'edition not found' }, { status: 404 })
  if (edition.status !== 'published') {
    return NextResponse.json({ ok: false, error: 'edition must be published first' }, { status: 400 })
  }

  const { data: articles } = await SVC.from('newspaper_articles').select('*').eq('edition_id', editionId).order('sort_order', { ascending: true })
  const { data: subs } = await SVC.from('newspaper_subscriptions').select('*').eq('status', 'active')

  const html = renderNewspaperHtml(edition, (articles || []) as any)
  const subject = `Concord Weekly — ${edition.issue_label || ''}`

  let sent = 0, failed = 0
  for (const sub of (subs || [])) {
    const emailHtml = welcomeTop(sub) + html
    const text = (articles || [])
      .map((a) => `${a.section}: ${a.headline}\n${(a.body || '').replace(/\n/g, ' ')}`)
      .join('\n\n')
    const { error } = await SVC.from('email_emails').insert({
      email_to: sub.email,
      subject,
      html: emailHtml,
      text,
      kind: 'newspaper_weekly',
      meta: { edition_id: editionId },
      status: 'queued',
    })
    if (error) { failed++ ; continue }
    await SVC.from('newspaper_delivery_log').insert({ edition_id: editionId, email: sub.email, status: 'sent' })
    sent++
  }

  return NextResponse.json({ ok: true, sent, failed, total: (subs || []).length })
}

function welcomeTop(sub: any): string {
  const name = sub?.name || sub?.email?.split('@')[0] || 'there'
  return `<p style="font-size:13px;color:#6a6a7a;margin:0 0 12px">Hi ${esc(name)}, here's your weekly briefing from the CONCORD Deal Platform.</p>`
}
function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}
