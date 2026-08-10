import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireUser, unauthorized } from '@/lib/apiAuth'

// ---------------------------------------------------------------------------
// POST /api/broker/upload-photo
// Uploads a broker headshot/logo for the business card. Validates file type
// (JPG/PNG/WebP) and size (max 2MB), stores it in the `broker_photos` public
// bucket under broker-photos/<userId>/, and returns the public URL. Uses the
// service role, gated behind a verified session — the uploader id comes from
// the Supabase-verified token, not a client-supplied header (which was
// previously spoofable via `x-user-id`).
// ---------------------------------------------------------------------------

export const runtime = 'nodejs'

const SVC = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || 'NO_KEY', {
      auth: { persistSession: false },
    })
  : null

const MAX_BYTES = 2 * 1024 * 1024 // 2MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

export async function POST(req: NextRequest) {
  if (!SVC) {
    return NextResponse.json({ ok: false, error: 'storage not configured' }, { status: 503 })
  }

  const auth = await requireUser(req)
  if (!auth) return unauthorized()
  const userId = auth.user.id
  const form = await req.formData().catch(() => null)
  if (!form) {
    return NextResponse.json({ ok: false, error: 'Expected multipart form-data' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'Missing file field' }, { status: 400 })
  }

  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ ok: false, error: 'Only JPG, PNG, or WebP images are allowed' }, { status: 415 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: 'Image must be under 2MB' }, { status: 413 })
  }

  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type] || 'bin'
  const path = `broker-photos/${userId}-${Date.now()}.${ext}`
  const buf = Buffer.from(await file.arrayBuffer())

  const { error: upErr } = await SVC.storage
    .from('broker_photos')
    .upload(path, buf, { contentType: file.type, cacheControl: '3600', upsert: false })
  if (upErr) {
    return NextResponse.json({ ok: false, error: upErr.message || 'Upload failed' }, { status: 500 })
  }

  const { data: { publicUrl } } = SVC.storage.from('broker_photos').getPublicUrl(path)
  return NextResponse.json({ ok: true, url: publicUrl })
}
