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
import type { SellerFormType } from '@/lib/sellerFormSchemas'
import type { FormValues } from '@/components/forms/DynamicFormFields'

export interface SellerFormRow {
  id: string
  listing_id: string
  form_type: SellerFormType
  form_data: FormValues
  status: 'draft' | 'sent' | 'signed'
  share_token: string | null
  signer_name: string | null
  signer_title: string | null
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
