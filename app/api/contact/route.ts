import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'

// ---------------------------------------------------------------------------
// POST /api/contact — public "Contact Us" form submission handler.
// No auth (by design — public route). Validates input, then reuses the
// existing email service (lib/email.ts): delivers via SMTP if configured,
// otherwise queues to email_emails so nothing is silently lost.
// ---------------------------------------------------------------------------

const CONTACT_INBOX = process.env.CONTACT_INBOX_EMAIL || 'info@ezbusinessadvisors.com'

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 })
  }

  const name = String(body?.name || '').trim()
  const email = String(body?.email || '').trim()
  const phone = String(body?.phone || '').trim()
  const message = String(body?.message || '').trim()

  if (!name || !email || !message) {
    return NextResponse.json({ ok: false, error: 'Name, email, and message are required' }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: 'Please enter a valid email address' }, { status: 400 })
  }

  const html = `
    <p>New message from the public "Contact Us" form.</p>
    <table style="font-size:14px;border-collapse:collapse;width:100%;">
      <tr><td style="padding:6px 0;color:#8a8678;width:30%;">Name</td><td style="padding:6px 0;font-weight:600;">${esc(name)}</td></tr>
      <tr><td style="padding:6px 0;color:#8a8678;">Email</td><td style="padding:6px 0;font-weight:600;">${esc(email)}</td></tr>
      <tr><td style="padding:6px 0;color:#8a8678;">Phone</td><td style="padding:6px 0;font-weight:600;">${esc(phone || '—')}</td></tr>
    </table>
    <p style="margin-top:16px;white-space:pre-wrap;">${esc(message)}</p>
  `

  const result = await sendEmail({
    to: CONTACT_INBOX,
    subject: `Contact form: ${name}`,
    html,
    kind: 'generic',
    meta: { name, email, phone, source: 'contact_form' },
  })

  return NextResponse.json({ ok: result.ok })
}
