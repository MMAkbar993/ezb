import { readFile } from 'fs/promises'
import path from 'path'
import { composeFilledPdf } from '@/lib/pdfOverlay'
import { NDA_TEMPLATE, BUYER_PROFILE_TEMPLATE } from '@/lib/pdfOverlayMaps'
import type { FormValues } from '@/components/forms/DynamicFormFields'

// =============================================================================
// Server-only: fills the client's two REAL branded PDFs — his actual
// Confidentiality, Disclosure & Commission Protection Agreement, followed by
// his actual Buyer Profile Form — and returns one combined signed PDF.
// Shared by both places a buyer NDA + Profile gets recorded: the public
// accountless gate (app/api/public/nda/sign) and the broker's in-app agent
// entry (app/api/listing-nda-signatures POST) — same real documents either
// way, not a re-typeset summary.
// =============================================================================

async function loadTemplate(fileName: string): Promise<Uint8Array> {
  const buf = await readFile(path.join(process.cwd(), 'public', 'document-templates', fileName))
  return new Uint8Array(buf)
}

export async function generateNdaProfilePdf(input: {
  listingId: string
  businessCategory: string | null
  ndaFormData: FormValues
  buyerProfile: FormValues
  signerName: string
  signedAt: string
}): Promise<Uint8Array> {
  const [ndaBytes, profileBytes] = await Promise.all([
    loadTemplate('nda.pdf'),
    loadTemplate('buyer-profile.pdf'),
  ])

  return composeFilledPdf(
    [
      { template: NDA_TEMPLATE, templateBytes: ndaBytes, values: { ...input.ndaFormData, _business_category: input.businessCategory || '—' } },
      { template: BUYER_PROFILE_TEMPLATE, templateBytes: profileBytes, values: input.buyerProfile },
    ],
    { signerName: input.signerName, signedAt: input.signedAt },
  )
}
