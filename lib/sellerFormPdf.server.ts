import { readFile } from 'fs/promises'
import path from 'path'
import { composeFilledPdf, type AdditionalSigner } from '@/lib/pdfOverlay'
import { SELLER_FORM_TEMPLATES } from '@/lib/pdfOverlayMaps'
import { SELLER_FORM_SCHEMAS, buildListingAgreementClauses, type SellerFormType } from '@/lib/sellerFormSchemas'
import { exportFilledFormToPdf } from '@/lib/formPdf'
import type { FormValues } from '@/components/forms/DynamicFormFields'

// =============================================================================
// Server-only: fills the seller's REAL branded PDF (his actual Corporate/LLC
// Resolution, Marketing Agreement, etc.) when a real template is mapped in
// SELLER_FORM_TEMPLATES; falls back to the older from-scratch jsPDF renderer
// (lib/formPdf.ts) for any form type that doesn't have one yet.
// =============================================================================

export async function generateSellerFormPdf(input: {
  formType: SellerFormType
  businessName: string | null
  formData: FormValues
  signerName: string
  signerTitle: string
  signedAt: string
  additionalSigners?: AdditionalSigner[]
}): Promise<Uint8Array> {
  const mapped = SELLER_FORM_TEMPLATES[input.formType]

  if (mapped) {
    const buf = await readFile(path.join(process.cwd(), 'public', 'document-templates', mapped.file))
    return composeFilledPdf(
      [{ template: mapped.template, templateBytes: new Uint8Array(buf), values: input.formData }],
      { signerName: input.signerName, signerTitle: input.signerTitle, signedAt: input.signedAt, additionalSigners: input.additionalSigners },
    )
  }

  // Fallback: the old from-scratch renderer, for form types not yet mapped
  // to a real template.
  const schema = SELLER_FORM_SCHEMAS[input.formType]
  return exportFilledFormToPdf(
    {
      title: schema.title,
      subtitle: input.businessName || 'Business Listing',
      intro: schema.intro,
      sections: schema.sections,
      values: input.formData,
      signerName: input.signerName || undefined,
      signerTitle: input.signerTitle || undefined,
      signedAt: input.signedAt,
      ...(input.formType === 'listing_agreement'
        ? { clauseTitle: 'Agreement Terms', clauseText: buildListingAgreementClauses(input.formData) }
        : {}),
    },
    { returnBytes: true },
  ) as Uint8Array
}
