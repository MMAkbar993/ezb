'use client'

// =============================================================================
// lib/buyerInquiries.ts — broker-side read access to the real, publicly
// signed NDA + Buyer Profile Form submissions (listing_nda_signatures) for a
// listing. Distinct from the manually-tracked buyer list in Step 9 — this is
// the actual accountless public gate's signed record.
// -----------------------------------------------------------------------------
// listing_nda_signatures deliberately has ZERO RLS policies (service-role
// only — see sql/listing_nda_signatures.sql), so this goes through an
// authenticated API route rather than the anon client directly.
// =============================================================================

import { getAccessToken } from '@/lib/financialFiles'
import type { FormValues } from '@/components/forms/DynamicFormFields'

export interface BuyerInquiry {
  id: string
  listing_id: string
  buyer_name: string
  buyer_email: string
  nda_form_data: FormValues
  buyer_profile: FormValues
  guide_acknowledged: boolean
  pdf_url: string | null
  signed_at: string
  ip_address: string | null
}

/** Pass no listingId to fetch every signed inquiry across all listings (Documents dashboard). */
export async function fetchBuyerInquiries(listingId?: string): Promise<BuyerInquiry[]> {
  const token = await getAccessToken()
  if (!token) throw new Error('You need to be signed in to view buyer inquiries.')
  const qs = listingId ? `?listingId=${encodeURIComponent(listingId)}` : ''
  const res = await fetch(`/api/listing-nda-signatures${qs}`, {
    headers: { Authorization: 'Bearer ' + token },
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'Failed to load buyer inquiries')
  return data.inquiries as BuyerInquiry[]
}

/** Agent-entered buyer NDA + Buyer Profile Form — same output as the public gate. */
export async function submitAgentBuyerInquiry(input: {
  listingId: string
  buyerName: string
  buyerEmail: string
  ndaFormData: FormValues
  buyerProfile: FormValues
}): Promise<BuyerInquiry> {
  const token = await getAccessToken()
  if (!token) throw new Error('You need to be signed in to record a buyer inquiry.')
  const res = await fetch('/api/listing-nda-signatures', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(input),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'Failed to record buyer inquiry')
  return data.inquiry as BuyerInquiry
}
