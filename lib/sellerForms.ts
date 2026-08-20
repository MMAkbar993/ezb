'use client'

// =============================================================================
// lib/sellerForms.ts — broker-side data layer for the 5 seller legal-document
// forms. Authenticated reads/writes go straight through the anon client + RLS
// (seller_forms has full "any authenticated broker" policies, same convention
// as every other CRM table) — no API route needed for the broker's own side.
// The seller-facing sign flow (no login) is a separate service-role route,
// see app/api/seller-form/*.
// =============================================================================

import { supabase } from '@/lib/supabase/client'
import { SELLER_FORM_SCHEMAS, buildListingAgreementClauses, type SellerFormType } from '@/lib/sellerFormSchemas'
import type { FormValues } from '@/components/forms/DynamicFormFields'
import { exportFilledFormToPdf } from '@/lib/formPdf'
import { composeFilledPdf, type AdditionalSigner } from '@/lib/pdfOverlay'
import { SELLER_FORM_TEMPLATES } from '@/lib/pdfOverlayMaps'
import { FF_BUCKET } from '@/lib/storageBuckets'

export type { AdditionalSigner }

export interface SellerFormRow {
  id: string
  listing_id: string
  form_type: SellerFormType
  form_data: FormValues
  status: 'draft' | 'sent' | 'signed'
  share_token: string | null
  signer_name: string | null
  signer_title: string | null
  additional_signers: AdditionalSigner[]
  signed_at: string | null
  pdf_url: string | null
  created_at: string
  updated_at: string
}

export async function fetchSellerForms(listingId: string): Promise<SellerFormRow[]> {
  const { data, error } = await supabase
    .from('seller_forms')
    .select('*')
    .eq('listing_id', listingId)
  if (error) throw new Error(error.message)
  return (data || []) as SellerFormRow[]
}

/** Upsert a draft — creates the row on first save, updates form_data thereafter. */
export async function saveSellerFormDraft(listingId: string, formType: SellerFormType, formData: FormValues): Promise<SellerFormRow> {
  const { data: userData } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('seller_forms')
    .upsert(
      { listing_id: listingId, form_type: formType, form_data: formData, created_by: userData?.user?.id || null, updated_at: new Date().toISOString() },
      { onConflict: 'listing_id,form_type' },
    )
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as SellerFormRow
}

// ---------------------------------------------------------------------------
// Complete a form directly in-app — the broker fills it in on behalf of the
// seller (in person, by phone, etc.) and generates the final signed PDF
// immediately, without a separate no-login share-link round trip. Previously
// the ONLY way a completed form ever produced a downloadable PDF was through
// the remote /seller-form/[listingId]/[token] sign flow — a broker-filled
// draft that was never sent out (or was filled faster than the seller could
// click the link) stayed stuck with no PDF at all.
// ---------------------------------------------------------------------------
export async function completeSellerFormInApp(
  listingId: string,
  formType: SellerFormType,
  formData: FormValues,
  signerName: string,
  signerTitle: string,
  additionalSigners: AdditionalSigner[] = [],
): Promise<SellerFormRow> {
  const schema = SELLER_FORM_SCHEMAS[formType]
  const { data: listing } = await supabase.from('listings').select('business_name').eq('id', listingId).maybeSingle()
  const signedAt = new Date().toISOString()

  const mapped = SELLER_FORM_TEMPLATES[formType]
  let bytes: Uint8Array
  if (mapped) {
    // Fill the seller's real branded PDF (his actual Corporate/LLC Resolution,
    // Marketing Agreement, etc.) instead of a from-scratch summary.
    const templateBytes = await fetch(`/document-templates/${mapped.file}`).then((r) => r.arrayBuffer())
    bytes = await composeFilledPdf(
      [{ template: mapped.template, templateBytes, values: formData }],
      { signerName: signerName || undefined, signerTitle: signerTitle || undefined, signedAt, additionalSigners },
    )
  } else {
    bytes = exportFilledFormToPdf(
      {
        title: schema.title,
        subtitle: (listing as any)?.business_name || 'Business Listing',
        intro: schema.intro,
        sections: schema.sections,
        values: formData,
        signerName: signerName || undefined,
        signerTitle: signerTitle || undefined,
        signedAt,
        ipNote: 'Completed in-app by broker on behalf of signer.',
        ...(formType === 'listing_agreement' ? { clauseTitle: 'Agreement Terms', clauseText: buildListingAgreementClauses(formData) } : {}),
      },
      { returnBytes: true },
    ) as Uint8Array
  }

  const path = `seller-forms/${listingId}/${Date.now()}-${formType}.pdf`
  const { error: upErr } = await supabase.storage
    .from(FF_BUCKET)
    .upload(path, new Blob([bytes as BlobPart], { type: 'application/pdf' }), { contentType: 'application/pdf', upsert: false })
  if (upErr) throw new Error(upErr.message)

  const { data: userData } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('seller_forms')
    .upsert(
      {
        listing_id: listingId, form_type: formType, form_data: formData,
        status: 'signed', signer_name: signerName || null, signer_title: signerTitle || null,
        additional_signers: additionalSigners,
        signed_at: signedAt, pdf_url: path, created_by: userData?.user?.id || null, updated_at: signedAt,
      },
      { onConflict: 'listing_id,form_type' },
    )
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as SellerFormRow
}

function randomToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Generates (or reuses) a share link for the seller to fill/sign remotely, no login. */
export async function sendSellerFormToSeller(listingId: string, formType: SellerFormType, formData: FormValues): Promise<string> {
  const { data: existing } = await supabase
    .from('seller_forms')
    .select('share_token, status')
    .eq('listing_id', listingId)
    .eq('form_type', formType)
    .maybeSingle()

  const token = existing?.share_token || randomToken()
  const { data: userData } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('seller_forms')
    .upsert(
      {
        listing_id: listingId, form_type: formType, form_data: formData,
        share_token: token, status: existing?.status === 'signed' ? 'signed' : 'sent',
        created_by: userData?.user?.id || null, updated_at: new Date().toISOString(),
      },
      { onConflict: 'listing_id,form_type' },
    )
  if (error) throw new Error(error.message)
  return token
}
