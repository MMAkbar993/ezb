import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { FF_BUCKET } from '@/lib/storageBuckets'

// ---------------------------------------------------------------------------
// Server-side Client Portal API.
// The token in the URL is the client's authorization (they have no Supabase
// session), so these read/write with the SERVICE ROLE. This module runs only
// on the server — the service key never reaches the browser.
// ---------------------------------------------------------------------------

export const runtime = 'nodejs'

const SVC = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || 'NO_KEY', {
      auth: { persistSession: false },
    })
  : null

export async function GET(req: NextRequest) {
  const dealId = req.nextUrl.searchParams.get('dealId') || ''
  const token = req.nextUrl.searchParams.get('token') || ''
  if (!dealId || !token) return NextResponse.json({ ok: false, error: 'missing params' }, { status: 400 })
  if (!SVC) return NextResponse.json({ ok: false, error: 'portal not configured' }, { status: 503 })

  // Validate token → get client name + authorization
  const { data: access, error: aErr } = await SVC.from('client_portal_access')
    .select('*').eq('deal_id', dealId).eq('token', token).eq('status', 'active').maybeSingle()
  if (aErr || !access) return NextResponse.json({ ok: false, error: 'invalid or revoked link' }, { status: 404 })

  const [dealRes, docsRes, milsRes, msgsRes] = await Promise.all([
    SVC.from('deals').select('*').eq('id', dealId).single(),
    SVC.from('deal_documents').select('*').eq('deal_id', dealId).order('created_at', { ascending: false }),
    SVC.from('due_diligence_items').select('title, due_date, status').eq('deal_id', dealId),
    SVC.from('portal_messages').select('*').eq('deal_id', dealId).order('created_at', { ascending: true }),
  ])

  // Resolve a fresh short-lived signed URL for documents uploaded to the
  // private financial_docs bucket (storage_path set); rows from before this
  // fix (public 'documents' bucket, no storage_path) keep their stored
  // file_url as-is for backward compatibility.
  const documents = await Promise.all(
    (docsRes.data || []).map(async (d) => {
      if (!d.storage_path) return d
      const { data: signed } = await SVC.storage.from(FF_BUCKET).createSignedUrl(d.storage_path, 3600)
      return { ...d, file_url: signed?.signedUrl || d.file_url }
    })
  )

  return NextResponse.json({
    ok: true,
    clientName: access.client_name,
    deal: dealRes.data || null,
    documents,
    milestones: (milsRes.data || []).map((m) => ({
      title: m.title, date: m.due_date ? String(m.due_date) : undefined, status: m.status,
    })),
    messages: msgsRes.data || [],
  })
}

export async function POST(req: NextRequest) {
  if (!SVC) return NextResponse.json({ ok: false, error: 'portal not configured' }, { status: 503 })

  // A request body can only be consumed once — req.json() on a multipart
  // upload would throw AND lock the stream, breaking the later
  // req.formData() call too. Branch on Content-Type before parsing at all,
  // and only ever call one of the two. Uploads send dealId/token via the
  // query string (matching what the client actually does); message sends
  // them inside the JSON body.
  const isMultipart = (req.headers.get('content-type') || '').includes('multipart/form-data')

  let dealId: string, token: string, action: string
  let jsonBody: any = {}

  if (isMultipart) {
    dealId = req.nextUrl.searchParams.get('dealId') || ''
    token = req.nextUrl.searchParams.get('token') || ''
    action = 'upload'
  } else {
    jsonBody = await req.json().catch(() => ({}))
    dealId = jsonBody.dealId
    token = jsonBody.token
    action = jsonBody.action
  }
  if (!dealId || !token || !action) return NextResponse.json({ ok: false, error: 'missing params' }, { status: 400 })

  const { data: access, error: aErr } = await SVC.from('client_portal_access')
    .select('*').eq('deal_id', dealId).eq('token', token).eq('status', 'active').maybeSingle()
  if (aErr || !access) return NextResponse.json({ ok: false, error: 'invalid or revoked link' }, { status: 404 })

  if (action === 'message') {
    const { body: msgText, clientName } = jsonBody
    if (!msgText || !String(msgText).trim()) return NextResponse.json({ ok: false, error: 'empty message' }, { status: 400 })
    const { data, error } = await SVC.from('portal_messages').insert({
      deal_id: dealId, author: 'client', author_name: clientName || access.client_name, body: String(msgText).trim(),
    }).select().single()
    if (error) return NextResponse.json({ ok: false, error: 'message failed' }, { status: 500 })
    return NextResponse.json({ ok: true, message: data })
  }

  if (action === 'upload') {
    const form = await req.formData().catch(() => null)
    const file = form?.get('file')
    const kind = String(form?.get('kind') || 'Client Upload')
    if (!file || !(file instanceof File)) return NextResponse.json({ ok: false, error: 'no file' }, { status: 400 })
    try {
      const clean = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `portal/${dealId}/${Date.now()}-${clean}`
      const { error: upErr } = await SVC.storage.from(FF_BUCKET).upload(path, file, { contentType: file.type })
      if (upErr) return NextResponse.json({ ok: false, error: 'upload failed' }, { status: 500 })
      const { data: signed } = await SVC.storage.from(FF_BUCKET).createSignedUrl(path, 3600)
      const { error: insErr } = await SVC.from('deal_documents').insert({
        deal_id: dealId, file_name: file.name, storage_path: path, file_url: signed?.signedUrl || null, category: kind,
      })
      if (insErr) return NextResponse.json({ ok: false, error: 'record failed' }, { status: 500 })
      return NextResponse.json({ ok: true })
    } catch {
      return NextResponse.json({ ok: false, error: 'upload error' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: false, error: 'unknown action' }, { status: 400 })
}
