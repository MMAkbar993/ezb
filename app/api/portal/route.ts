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

  const party: 'seller' | 'buyer' = access.party_type === 'buyer' ? 'buyer' : 'seller'
  const visibilityCol = party === 'buyer' ? 'visible_to_buyer' : 'visible_to_seller'

  const [dealRes, dealDocsRes, milsRes, msgsRes] = await Promise.all([
    SVC.from('deals').select('*').eq('id', dealId).single(),
    SVC.from('deal_documents').select('*').eq('deal_id', dealId).eq(visibilityCol, true).order('created_at', { ascending: false }),
    SVC.from('due_diligence_items').select('title, due_date, status').eq('deal_id', dealId),
    SVC.from('portal_messages').select('*').eq('deal_id', dealId).order('created_at', { ascending: true }),
  ])

  // The real generated CIM/BOV/financial documents live in
  // financial_documents (listing-scoped), not deal_documents — resolve the
  // deal's listing_id and pull those in too, filtered by the same
  // visibility column, so buyers/sellers actually see their CIM/BOV here.
  // Signed seller legal documents (seller_forms) and the buyer NDA + Buyer
  // Profile Form (listing_nda_signatures) are also listing-scoped and were
  // previously never surfaced in the portal at all — only source/generated
  // financial files and manually-uploaded deal documents were, so a signed
  // Marketing Agreement or LLC Resolution never showed up here for either
  // party to download.
  const listingId = dealRes.data?.listing_id || null
  const [financialDocsRes, sellerFormsRes, buyerNdaRes] = listingId
    ? await Promise.all([
        SVC.from('financial_documents').select('*').eq('listing_id', listingId).eq(visibilityCol, true).order('uploaded_at', { ascending: false }),
        SVC.from('seller_forms').select('id, form_type, pdf_url, signer_name, signed_at, status').eq('listing_id', listingId).eq('status', 'signed').not('pdf_url', 'is', null),
        SVC.from('listing_nda_signatures').select('id, buyer_name, pdf_url, signed_at').eq('listing_id', listingId).not('pdf_url', 'is', null),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }, { data: [] as any[] }]

  // Resolve a fresh short-lived signed URL for documents uploaded to the
  // private financial_docs bucket (storage_path set); rows from before this
  // fix (public 'documents' bucket, no storage_path) keep their stored
  // file_url as-is for backward compatibility.
  const dealDocuments = await Promise.all(
    (dealDocsRes.data || []).map(async (d) => {
      if (!d.storage_path) return { ...d, source: 'deal' as const }
      const { data: signed } = await SVC.storage.from(FF_BUCKET).createSignedUrl(d.storage_path, 3600)
      return { ...d, file_url: signed?.signedUrl || d.file_url, source: 'deal' as const }
    })
  )
  const financialDocuments = await Promise.all(
    ((financialDocsRes.data as any[]) || []).map(async (d) => {
      if (!d.storage_path) return { ...d, source: 'financial' as const }
      const { data: signed } = await SVC.storage.from(FF_BUCKET).createSignedUrl(d.storage_path, 3600)
      return { ...d, file_url: signed?.signedUrl || d.file_url, source: 'financial' as const }
    })
  )
  // Seller legal documents (visible to seller by default; shared with the
  // buyer only via the same broker-controlled visibility toggle other
  // documents use — no per-row visibility columns exist yet on seller_forms,
  // so treat them as seller-only for now, matching the pre-portal default).
  const sellerFormDocuments = party === 'seller'
    ? await Promise.all(
        ((sellerFormsRes.data as any[]) || []).map(async (d) => {
          const { data: signed } = await SVC.storage.from(FF_BUCKET).createSignedUrl(d.pdf_url, 3600)
          return { id: d.id, file_url: signed?.signedUrl || null, file_name: `${d.form_type.replace(/_/g, ' ')} (signed).pdf`, category: 'Legal Document', created_at: d.signed_at, source: 'seller_form' as const }
        })
      )
    : []
  // Buyer NDA + Buyer Profile Form — visible only to the buyer who signed it
  // (and the seller doesn't need to see other buyers' financial disclosures).
  const buyerNdaDocuments = party === 'buyer'
    ? await Promise.all(
        ((buyerNdaRes.data as any[]) || []).map(async (d) => {
          const { data: signed } = await SVC.storage.from(FF_BUCKET).createSignedUrl(d.pdf_url, 3600)
          return { id: d.id, file_url: signed?.signedUrl || null, file_name: `NDA + Buyer Profile — ${d.buyer_name}.pdf`, category: 'NDA + Buyer Profile', created_at: d.signed_at, source: 'buyer_form' as const }
        })
      )
    : []

  return NextResponse.json({
    ok: true,
    clientName: access.client_name,
    partyType: party,
    deal: dealRes.data || null,
    documents: [...financialDocuments, ...dealDocuments, ...sellerFormDocuments, ...buyerNdaDocuments],
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

  const uploaderRole: 'seller' | 'buyer' = access.party_type === 'buyer' ? 'buyer' : 'seller'

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
      // Own uploads are visible to whoever uploaded them and to the broker by
      // default (not auto-shared with the other party — the broker decides).
      const { error: insErr } = await SVC.from('deal_documents').insert({
        deal_id: dealId, file_name: file.name, storage_path: path, file_url: signed?.signedUrl || null, category: kind,
        uploaded_by_role: uploaderRole,
        visible_to_seller: uploaderRole === 'seller' ? true : false,
        visible_to_buyer: uploaderRole === 'buyer' ? true : false,
      })
      if (insErr) return NextResponse.json({ ok: false, error: 'record failed' }, { status: 500 })
      return NextResponse.json({ ok: true })
    } catch {
      return NextResponse.json({ ok: false, error: 'upload error' }, { status: 500 })
    }
  }

  if (action === 'delete') {
    const docId = jsonBody.docId
    if (!docId) return NextResponse.json({ ok: false, error: 'missing docId' }, { status: 400 })
    // A party may only remove documents they themselves uploaded — broker-
    // shared documents (CIM, BOV, etc.) can only be removed from the dashboard.
    const { data: doc } = await SVC.from('deal_documents').select('id, storage_path, uploaded_by_role').eq('id', docId).eq('deal_id', dealId).maybeSingle()
    if (!doc || doc.uploaded_by_role !== uploaderRole) {
      return NextResponse.json({ ok: false, error: 'not authorized to remove this document' }, { status: 403 })
    }
    if (doc.storage_path) await SVC.storage.from(FF_BUCKET).remove([doc.storage_path]).catch(() => {})
    const { error: delErr } = await SVC.from('deal_documents').delete().eq('id', docId)
    if (delErr) return NextResponse.json({ ok: false, error: 'delete failed' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: false, error: 'unknown action' }, { status: 400 })
}
