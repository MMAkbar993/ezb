import type { OverlayTemplate } from '@/lib/pdfOverlay'
import type { SellerFormType } from '@/lib/sellerFormSchemas'

// =============================================================================
// Field coordinate maps for the client's real PDF templates
// (public/document-templates/*.pdf). Coordinates are pdf-lib space (origin
// bottom-left of a 612x792pt Letter page), derived from the templates' own
// real text-label positions (extracted directly from the PDFs) plus visual
// inspection of a rendered preview — not guessed from scratch.
// =============================================================================

export const NDA_TEMPLATE: OverlayTemplate = {
  name: 'Confidentiality, Disclosure & Commission Protection Agreement',
  fields: [
    { key: 'prospect_full_legal_name', page: 0, x: 178, y: 446.7, fontSize: 10 },
    // Address / City / State / ZIP row — one shared line beneath the header labels
    { key: 'address', page: 0, x: 75, y: 402, fontSize: 9.5 },
    { key: 'city', page: 0, x: 240, y: 402, fontSize: 9.5 },
    { key: 'state', page: 0, x: 355, y: 402, fontSize: 9.5 },
    { key: 'zip', page: 0, x: 445, y: 402, fontSize: 9.5 },
    // Email / Driver's License row
    { key: 'email', page: 0, x: 75, y: 300, fontSize: 9.5 },
    { key: 'drivers_license_or_ein', page: 0, x: 320, y: 300, fontSize: 9.5 },
    // Phone / Cell / Fax row
    { key: 'phone', page: 0, x: 75, y: 260, fontSize: 9.5 },
    { key: 'cell', page: 0, x: 175, y: 260, fontSize: 9.5 },
    { key: 'fax', page: 0, x: 350, y: 260, fontSize: 9.5 },
    { key: '_business_category', page: 0, x: 232, y: 212.4, fontSize: 10 },
  ],
  signature: {
    page: 3,
    nameX: 255, nameY: 644.9,
    dateX: 110, dateY: 611.8,
    noteX: 71.3, noteY: 480,
  },
}

export const SELLER_INTERVIEW_TEMPLATE: OverlayTemplate = {
  name: 'Seller Interview Form',
  fields: [
    // Seller Information
    { key: 'principal_home_address', page: 0, x: 190, y: 568.5, fontSize: 9.5 },
    { key: 'city', page: 0, x: 340, y: 568.5, fontSize: 9.5 },
    { key: 'county', page: 0, x: 100, y: 546.8, fontSize: 9.5 },
    { key: 'state', page: 0, x: 340, y: 546.8, fontSize: 9.5 },
    { key: 'zip_code', page: 0, x: 105, y: 525.1, fontSize: 9.5 },
    { key: 'best_contact_phone', page: 0, x: 420, y: 525.1, fontSize: 9.5 },
    { key: 'reason_for_sale', page: 0, x: 50, y: 490, kind: 'multiline', maxWidth: 520, maxLines: 3, fontSize: 9.5 },
    // Business Details
    { key: 'business_name', page: 0, x: 120, y: 424.5, fontSize: 9.5 },
    { key: 'legal_entity_name', page: 0, x: 400, y: 424.5, fontSize: 9.5 },
    { key: 'business_telephone', page: 0, x: 140, y: 402.8, fontSize: 9.5 },
    { key: 'fax', page: 0, x: 340, y: 402.8, fontSize: 9.5 },
    { key: 'website', page: 0, x: 95, y: 381.1, fontSize: 9.5 },
    { key: 'hours_of_operation', page: 0, x: 420, y: 381.1, fontSize: 9.5 },
    { key: 'hours_owner_works_per_week', page: 0, x: 140, y: 355.3, fontSize: 9.5 },
    { key: 'years_established', page: 0, x: 420, y: 359.3, fontSize: 9.5 },
    { key: 'years_under_current_ownership', page: 0, x: 140, y: 333.6, fontSize: 9.5 },
    { key: 'state_of_incorporation', page: 0, x: 420, y: 333.6, fontSize: 9.5 },
    { key: 'organization_type', page: 0, x: 140, y: 311.9, fontSize: 9.5 },
    { key: 'is_relocatable', page: 0, x: 387.0, y: 319.9, kind: 'check', matchValue: 'Yes' },
    { key: 'is_relocatable', page: 0, x: 320.2, y: 311.9, kind: 'check', matchValue: 'No' },
    { key: 'home_based', page: 0, x: 88.1, y: 294.2, kind: 'check', matchValue: 'Yes' },
    { key: 'home_based', page: 0, x: 108.2, y: 294.2, kind: 'check', matchValue: 'No' },
    { key: 'franchise', page: 0, x: 343.3, y: 294.2, kind: 'check', matchValue: 'Yes' },
    { key: 'franchise', page: 0, x: 363.4, y: 294.2, kind: 'check', matchValue: 'No' },
    // Employees
    { key: 'managers', page: 0, x: 100, y: 246.5, fontSize: 9.5 },
    { key: 'full_time', page: 0, x: 230, y: 246.5, fontSize: 9.5 },
    { key: 'part_time', page: 0, x: 360, y: 246.5, fontSize: 9.5 },
    { key: 'seasonal_contract', page: 0, x: 490, y: 242.5, fontSize: 9.5 },
    // Legal and Operations
    { key: 'lawsuits_pending', page: 0, x: 42.6, y: 194.7, kind: 'check', matchValue: 'Yes' },
    { key: 'lawsuits_pending', page: 0, x: 62.7, y: 194.7, kind: 'check', matchValue: 'No' },
    { key: 'tax_liens', page: 0, x: 342.6, y: 198.7, kind: 'check', matchValue: 'Yes' },
    { key: 'tax_liens', page: 0, x: 362.7, y: 198.7, kind: 'check', matchValue: 'No' },
    { key: 'legal_explain', page: 0, x: 50, y: 165, kind: 'multiline', maxWidth: 520, maxLines: 2, fontSize: 9.5 },
    { key: 'skills_licenses_required', page: 0, x: 50, y: 113, kind: 'multiline', maxWidth: 520, maxLines: 2, fontSize: 9.5 },
    { key: 'business_category', page: 0, x: 140, y: 92.1, fontSize: 9.5 },
    { key: 'business_sub_category', page: 0, x: 420, y: 88.1, fontSize: 9.5 },

    // Page 2 — Business Profile
    { key: 'business_description', page: 1, x: 50, y: 642, kind: 'multiline', maxWidth: 520, maxLines: 4, fontSize: 9.5 },
    { key: 'business_history', page: 1, x: 50, y: 568, kind: 'multiline', maxWidth: 520, maxLines: 4, fontSize: 9.5 },
    { key: 'growth_opportunities', page: 1, x: 50, y: 495, kind: 'multiline', maxWidth: 520, maxLines: 3, fontSize: 9.5 },
    { key: 'competitive_overview', page: 1, x: 50, y: 442, kind: 'multiline', maxWidth: 520, maxLines: 3, fontSize: 9.5 },
    // Location
    { key: 'general_location', page: 1, x: 130, y: 375.3, fontSize: 9.5 },
    { key: 'facility_type', page: 1, x: 430, y: 371.3, fontSize: 9.5 },
    { key: 'building_type', page: 1, x: 190, y: 353.5, fontSize: 9.5 },
    { key: 'leasable_sqft', page: 1, x: 430, y: 353.5, fontSize: 9.5 },
    { key: 'monthly_rent', page: 1, x: 170, y: 331.8, fontSize: 9.5 },
    { key: 'lease_expiration_date', page: 1, x: 430, y: 331.8, fontSize: 9.5 },
    { key: 'rent_includes_insurance_etc', page: 1, x: 66.8, y: 302.1, kind: 'check', matchValue: 'Yes' },
    { key: 'rent_includes_insurance_etc', page: 1, x: 86.9, y: 302.1, kind: 'check', matchValue: 'No' },
    { key: 'renewal_options', page: 1, x: 390, y: 310.1, fontSize: 9.5 },
    { key: 'formal_appraisal_last_12mo', page: 1, x: 71.5, y: 284.4, kind: 'check', matchValue: 'Yes' },
    { key: 'formal_appraisal_last_12mo', page: 1, x: 91.6, y: 284.4, kind: 'check', matchValue: 'No' },
    // Assets included
    { key: 'asset_leasehold_improvements', page: 1, x: 245, y: 225.2, fontSize: 9 },
    { key: 'asset_ffe', page: 1, x: 245, y: 207.2, fontSize: 9 },
    { key: 'asset_inventory', page: 1, x: 245, y: 189.2, fontSize: 9 },
    { key: 'asset_vehicles', page: 1, x: 245, y: 171.2, fontSize: 9 },
    { key: 'asset_goodwill', page: 1, x: 245, y: 153.2, fontSize: 9 },
    { key: 'asset_other', page: 1, x: 245, y: 135.2, fontSize: 9 },
    // Assets not included
    { key: 'excluded_accounts_receivable', page: 1, x: 495, y: 225.2, fontSize: 9 },
    { key: 'excluded_other_1', page: 1, x: 495, y: 207.2, fontSize: 9 },
    { key: 'excluded_other_2', page: 1, x: 495, y: 189.2, fontSize: 9 },
    { key: 'liabilities_to_be_paid', page: 1, x: 50, y: 100, kind: 'multiline', maxWidth: 520, maxLines: 2, fontSize: 9.5 },
    // Signature page — "CORPORATION/COMPANY" column (left) is the second
    // co-seller slot (see signature2 below); "SELLER SIGNATURE" column
    // (right) is the primary signer's printed name + title.
    { key: '_signer_name', page: 2, x: 375, y: 538.7, fontSize: 9.5 },
    { key: '_signer_title', page: 2, x: 340, y: 519.3, fontSize: 9.5 },
    { key: '_signer2_name', page: 2, x: 115, y: 538.7, fontSize: 9.5 },
    { key: '_signer2_title', page: 2, x: 80, y: 519.3, fontSize: 9.5 },
  ],
  signature: {
    page: 2,
    nameX: 375, nameY: 558.2,
    dateX: 375, dateY: 499.9,
  },
  signature2: {
    page: 2,
    nameX: 115, nameY: 558.2,
    dateX: 80, dateY: 499.9,
  },
}

export const CORP_RESOLUTION_TEMPLATE: OverlayTemplate = {
  name: 'Corporate Authorization Resolution',
  fields: [
    { key: 'corporation_full_legal_name', page: 0, x: 200, y: 557.0, fontSize: 9.5 },
    { key: 'state_of_incorporation', page: 0, x: 420, y: 557.0, fontSize: 9.5 },
    { key: 'authorized_officer_full_name', page: 0, x: 210, y: 535.3, fontSize: 9.5 },
    { key: 'officer_title', page: 0, x: 340, y: 535.3, fontSize: 9.5 },
    { key: 'meeting_consent_date', page: 0, x: 180, y: 513.6, fontSize: 9.5 },
    { key: 'county_state_of_meeting', page: 0, x: 460, y: 513.6, fontSize: 9.5 },
    { key: 'authorized_person_full_name', page: 0, x: 50, y: 480, fontSize: 9.5 },
    // "SELLER SIGNATURE" column (right) — primary signer's printed name/title.
    { key: 'authorized_officer_full_name', page: 0, x: 375, y: 111.1, fontSize: 9.5 },
    { key: 'officer_title', page: 0, x: 340, y: 91.6, fontSize: 9.5 },
    // "CORPORATION" column (left) — second co-seller slot, when provided.
    { key: '_signer2_name', page: 0, x: 115, y: 111.1, fontSize: 9.5 },
    { key: '_signer2_title', page: 0, x: 80, y: 91.6, fontSize: 9.5 },
  ],
  signature: {
    page: 0,
    nameX: 375, nameY: 130.5,
    dateX: 340, dateY: 72.2,
  },
  signature2: {
    page: 0,
    nameX: 115, nameY: 130.5,
    dateX: 80, dateY: 72.2,
  },
}

export const LLC_RESOLUTION_TEMPLATE: OverlayTemplate = {
  name: 'LLC Authorization Resolution',
  fields: [
    { key: 'company_full_legal_name', page: 0, x: 200, y: 557.0, fontSize: 9.5 },
    { key: 'state_of_organization', page: 0, x: 420, y: 557.0, fontSize: 9.5 },
    { key: 'managing_member_full_name', page: 0, x: 220, y: 535.3, fontSize: 9.5 },
    { key: 'member_title', page: 0, x: 340, y: 535.3, fontSize: 9.5 },
    { key: 'meeting_consent_date', page: 0, x: 180, y: 513.6, fontSize: 9.5 },
    { key: 'county_state_of_meeting', page: 0, x: 460, y: 513.6, fontSize: 9.5 },
    { key: 'authorized_person_full_name', page: 0, x: 50, y: 480, fontSize: 9.5 },
    // "SELLER SIGNATURE" column (right) — primary signer's printed name/title.
    { key: 'managing_member_full_name', page: 0, x: 375, y: 111.1, fontSize: 9.5 },
    { key: 'member_title', page: 0, x: 340, y: 91.6, fontSize: 9.5 },
    // "COMPANY NAME" column (left) — second co-seller slot, when provided.
    { key: '_signer2_name', page: 0, x: 115, y: 111.1, fontSize: 9.5 },
    { key: '_signer2_title', page: 0, x: 80, y: 91.6, fontSize: 9.5 },
  ],
  signature: {
    page: 0,
    nameX: 375, nameY: 130.5,
    dateX: 340, dateY: 72.2,
  },
  signature2: {
    page: 0,
    nameX: 115, nameY: 130.5,
    dateX: 80, dateY: 72.2,
  },
}

export const MARKETING_AGREEMENT_TEMPLATE: OverlayTemplate = {
  name: 'Exclusive Marketing & Listing Agreement',
  fields: [
    { key: 'business_name', page: 0, x: 115, y: 571.5, fontSize: 9.5 },
    { key: 'seller_legal_name', page: 0, x: 400, y: 571.5, fontSize: 9.5 },
    { key: 'business_address', page: 0, x: 125, y: 549.8, fontSize: 9.5 },
    { key: 'city', page: 0, x: 340, y: 549.8, fontSize: 9.5 },
    { key: 'state', page: 0, x: 80, y: 528.1, fontSize: 9.5 },
    { key: 'zip', page: 0, x: 340, y: 528.1, fontSize: 9.5 },
    { key: 'principal_name', page: 0, x: 115, y: 506.4, fontSize: 9.5 },
    { key: 'cell_phone', page: 0, x: 370, y: 506.4, fontSize: 9.5 },
    { key: 'private_email', page: 0, x: 50, y: 473, fontSize: 9.5 },
    { key: 'non_compete_radius', page: 0, x: 140, y: 426.7, fontSize: 9.5 },
    { key: 'non_compete_term_years', page: 0, x: 460, y: 426.7, fontSize: 9.5 },
    { key: 'training_period_weeks', page: 0, x: 140, y: 400.9, fontSize: 9.5 },
    { key: 'inventory_included_value', page: 0, x: 400, y: 404.9, fontSize: 9.5 },
    { key: 'annual_sales', page: 0, x: 115, y: 383.2, fontSize: 9.5 },
    { key: 'sde', page: 0, x: 130, y: 357.5, fontSize: 9.5 },
    { key: 'total_asking_price', page: 0, x: 140, y: 339.8, fontSize: 9.5 },
    { key: 'down_payment', page: 0, x: 390, y: 339.8, fontSize: 9.5 },
    { key: 'seller_note', page: 0, x: 110, y: 318.1, fontSize: 9.5 },
    { key: 'interest_rate', page: 0, x: 380, y: 318.1, fontSize: 9.5 },
    { key: 'monthly_payment', page: 0, x: 140, y: 296.3, fontSize: 9.5 },
    { key: 'term_months', page: 0, x: 380, y: 296.3, fontSize: 9.5 },
    { key: 'additional_provisions', page: 0, x: 50, y: 263, kind: 'multiline', maxWidth: 520, maxLines: 3, fontSize: 9.5 },
    // Page 2 — "Dated as of:", both signature-block columns
    { key: '_signed_date', page: 1, x: 100, y: 459.5, fontSize: 9.5 },
    { key: '_signer_name', page: 1, x: 115, y: 398.0, fontSize: 9.5 },
    { key: '_signer_title', page: 1, x: 80, y: 378.6, fontSize: 9.5 },
    { key: 'literal:Rabin Timsina', page: 1, x: 375, y: 398.0, fontSize: 9.5 },
    { key: 'literal:Business Broker (Agent)', page: 1, x: 350, y: 378.6, fontSize: 9.5 },
  ],
  signature: {
    page: 1,
    nameX: 115, nameY: 417.5,
    dateX: 110, dateY: 359.1,
  },
}

export const DOCUMENTATION_CHECKLIST_TEMPLATE: OverlayTemplate = {
  name: 'Documentation Checklist',
  fields: [
    { key: 'fin_tax_returns_3yr', page: 0, x: 40.6, y: 532.9, kind: 'check' },
    { key: 'fin_yearend_pl_3yr', page: 0, x: 40.6, y: 517.4, kind: 'check' },
    { key: 'fin_interim_pl', page: 0, x: 40.6, y: 501.9, kind: 'check' },
    { key: 'fin_balance_sheets', page: 0, x: 40.6, y: 486.4, kind: 'check' },
    { key: 'fin_monthly_sales_3yr', page: 0, x: 40.6, y: 470.9, kind: 'check' },
    { key: 'fin_accountant_contact', page: 0, x: 40.6, y: 455.4, kind: 'check' },
    { key: 'fac_lease_or_deed', page: 0, x: 40.6, y: 409.9, kind: 'check' },
    { key: 'fac_ffe_list', page: 0, x: 40.6, y: 394.4, kind: 'check' },
    { key: 'fac_non_owned_equipment', page: 0, x: 40.6, y: 366.4, kind: 'check' },
    { key: 'fac_appraisals', page: 0, x: 40.6, y: 338.4, kind: 'check' },
    { key: 'ops_top_customers', page: 0, x: 40.6, y: 292.9, kind: 'check' },
    { key: 'ops_suppliers', page: 0, x: 40.6, y: 277.4, kind: 'check' },
    { key: 'ops_employee_list', page: 0, x: 40.6, y: 261.9, kind: 'check' },
    { key: 'ops_creditors', page: 0, x: 40.6, y: 246.4, kind: 'check' },
    { key: 'ops_contractual_obligations', page: 0, x: 40.6, y: 230.9, kind: 'check' },
    { key: 'mkt_price_lists', page: 0, x: 40.6, y: 172.9, kind: 'check' },
    { key: 'mkt_menus_or_offerings', page: 0, x: 40.6, y: 157.4, kind: 'check' },
    { key: 'mkt_franchise_docs', page: 0, x: 40.6, y: 141.9, kind: 'check' },
    { key: 'mkt_brochures', page: 0, x: 40.6, y: 126.4, kind: 'check' },
    { key: 'mkt_website_social', page: 0, x: 40.6, y: 110.9, kind: 'check' },
    { key: 'mkt_catalogs', page: 0, x: 40.6, y: 95.4, kind: 'check' },
  ],
}

export const BUYER_PROFILE_TEMPLATE: OverlayTemplate = {
  name: 'Buyer Profile Form',
  fields: [
    // Personal information
    { key: 'last_name', page: 0, x: 112, y: 568.5, fontSize: 9.5 },
    { key: 'first_name', page: 0, x: 285, y: 568.5, fontSize: 9.5 },
    { key: 'middle_initial', page: 0, x: 460, y: 568.5, fontSize: 9.5 },
    { key: 'spouse_partner_name', page: 0, x: 185, y: 546.8, fontSize: 9.5 },
    { key: 'address', page: 0, x: 355, y: 546.8, fontSize: 9.5 },
    { key: 'city', page: 0, x: 75, y: 525.1, fontSize: 9.5 },
    { key: 'state', page: 0, x: 250, y: 525.1, fontSize: 9.5 },
    { key: 'zip', page: 0, x: 425, y: 525.1, fontSize: 9.5 },
    { key: 'phone', page: 0, x: 80, y: 503.4, fontSize: 9.5 },
    { key: 'mobile', page: 0, x: 260, y: 503.4, fontSize: 9.5 },
    { key: 'fax', page: 0, x: 420, y: 503.4, fontSize: 9.5 },
    { key: 'email', page: 0, x: 90, y: 487.0, fontSize: 9.5 },
    { key: 'marital_status', page: 0, x: 95.6, y: 454.0, kind: 'check', matchValue: 'Married' },
    { key: 'marital_status', page: 0, x: 130.9, y: 454.0, kind: 'check', matchValue: 'Single' },
    { key: 'marital_status', page: 0, x: 161.6, y: 454.0, kind: 'check', matchValue: 'Divorced' },
    { key: 'currently_employed', page: 0, x: 271.1, y: 454.0, kind: 'check', matchValue: 'Yes' },
    { key: 'currently_employed', page: 0, x: 293.9, y: 454.0, kind: 'check', matchValue: 'No' },
    { key: 'relocating', page: 0, x: 353.0, y: 454.0, kind: 'check', matchValue: 'Yes' },
    { key: 'relocating', page: 0, x: 375.8, y: 454.0, kind: 'check', matchValue: 'No' },
    // Business preferences
    { key: 'type_of_business_preferred', page: 0, x: 50, y: 395, kind: 'multiline', maxWidth: 520, maxLines: 3, fontSize: 9.5 },
    { key: 'location_preference', page: 0, x: 50, y: 342, kind: 'multiline', maxWidth: 520, maxLines: 3, fontSize: 9.5 },
    { key: 'consider_franchise', page: 0, x: 141.3, y: 305.3, kind: 'check', matchValue: 'Yes' },
    { key: 'consider_franchise', page: 0, x: 161.4, y: 305.3, kind: 'check', matchValue: 'No' },
    { key: 'franchise_type', page: 0, x: 140, y: 295.3, fontSize: 9.5 },
    { key: 'when_plan_to_buy', page: 0, x: 50, y: 248, fontSize: 9.5 },
    { key: 'issues_preventing_purchase', page: 0, x: 50, y: 216, fontSize: 9.5 },
    { key: 'education', page: 0, x: 83.1, y: 172.3, kind: 'check', matchValue: 'High School' },
    { key: 'education', page: 0, x: 133.4, y: 172.3, kind: 'check', matchValue: 'Some College' },
    { key: 'education', page: 0, x: 190.4, y: 172.3, kind: 'check', matchValue: "Bachelor's Degree" },
    { key: 'education', page: 0, x: 261.7, y: 172.3, kind: 'check', matchValue: 'Graduate Degree' },
    { key: 'field_of_study', page: 0, x: 50, y: 143, fontSize: 9.5 },
    { key: 'owned_business_before', page: 0, x: 138.1, y: 126.3, kind: 'check', matchValue: 'Yes' },
    { key: 'owned_business_before', page: 0, x: 158.2, y: 126.3, kind: 'check', matchValue: 'No' },
    { key: 'owned_business_type', page: 0, x: 140, y: 116.3, fontSize: 9.5 },

    // Page 2
    { key: 'present_occupation', page: 1, x: 65, y: 681, fontSize: 9.5 },
    { key: 'current_annual_income', page: 1, x: 180, y: 658.5, fontSize: 9.5 },
    { key: 'previous_occupation', page: 1, x: 470, y: 658.5, fontSize: 9.5 },
    { key: 'other_involved_in_decision', page: 1, x: 50, y: 625, fontSize: 9.5 },
    { key: 'down_payment_amount', page: 1, x: 180, y: 578, fontSize: 9.5 },
    { key: 'funds_available_when', page: 1, x: 470, y: 578, fontSize: 9.5 },
    { key: 'minimum_owner_benefit', page: 1, x: 180, y: 557, fontSize: 9.5 },
    { key: 'qualified_sba_loan', page: 1, x: 383.4, y: 561.1, kind: 'check', matchValue: 'Yes' },
    { key: 'qualified_sba_loan', page: 1, x: 306.8, y: 553.1, kind: 'check', matchValue: 'No' },
    { key: 'source_down_payment_savings', page: 1, x: 45.6, y: 531.7, kind: 'check' },
    { key: 'source_down_payment_401k', page: 1, x: 113.8, y: 531.7, kind: 'check' },
    { key: 'source_down_payment_home_equity', page: 1, x: 210.8, y: 531.7, kind: 'check' },
    { key: 'source_down_payment_business_loan', page: 1, x: 282.4, y: 531.7, kind: 'check' },
    { key: 'source_down_payment_other', page: 1, x: 420, y: 531.7, fontSize: 9 },
    // Assets column (x=245.8)
    { key: 'asset_cash_bank', page: 1, x: 245, y: 466.9, fontSize: 9 },
    { key: 'asset_listed_securities', page: 1, x: 245, y: 448.9, fontSize: 9 },
    { key: 'asset_unlisted_securities', page: 1, x: 245, y: 430.9, fontSize: 9 },
    { key: 'asset_accounts_receivable', page: 1, x: 245, y: 412.9, fontSize: 9 },
    { key: 'asset_loans_notes_receivable', page: 1, x: 245, y: 394.9, fontSize: 9 },
    { key: 'asset_real_estate_homestead', page: 1, x: 245, y: 376.9, fontSize: 9 },
    { key: 'asset_real_estate_other', page: 1, x: 245, y: 358.9, fontSize: 9 },
    { key: 'asset_automobiles', page: 1, x: 245, y: 340.9, fontSize: 9 },
    { key: 'asset_life_insurance_cash_value', page: 1, x: 245, y: 322.9, fontSize: 9 },
    { key: 'asset_collectibles', page: 1, x: 245, y: 304.9, fontSize: 9 },
    { key: 'asset_escrow_other', page: 1, x: 245, y: 286.9, fontSize: 9 },
    // Liabilities column (x=501.4)
    { key: 'liability_notes_secured', page: 1, x: 501, y: 466.9, fontSize: 9 },
    { key: 'liability_notes_unsecured', page: 1, x: 501, y: 448.9, fontSize: 9 },
    { key: 'liability_amounts_payable_others', page: 1, x: 501, y: 430.9, fontSize: 9 },
    { key: 'liability_current_accounts_bills', page: 1, x: 501, y: 412.9, fontSize: 9 },
    { key: 'liability_real_estate_mortgages', page: 1, x: 501, y: 394.9, fontSize: 9 },
    { key: 'liability_other_mortgages_liens', page: 1, x: 501, y: 376.9, fontSize: 9 },
    { key: 'liability_other', page: 1, x: 501, y: 358.9, fontSize: 9 },
  ],
  signature: {
    page: 1,
    nameX: 145, nameY: 199.5,
    dateX: 295, dateY: 199.5,
  },
}

// -----------------------------------------------------------------------------
// Registry: which seller form types have a real overlay template mapped, and
// under what filename in public/document-templates/. A type with no entry
// here still works — lib/sellerFormPdf.server.ts and lib/sellerForms.ts fall
// back to the older from-scratch jsPDF renderer (lib/formPdf.ts) for it.
// -----------------------------------------------------------------------------
export const SELLER_FORM_TEMPLATES: Partial<Record<SellerFormType, { file: string; template: OverlayTemplate }>> = {
  corp_resolution: { file: 'corp-resolution.pdf', template: CORP_RESOLUTION_TEMPLATE },
  seller_interview: { file: 'seller-interview.pdf', template: SELLER_INTERVIEW_TEMPLATE },
  llc_resolution: { file: 'llc-resolution.pdf', template: LLC_RESOLUTION_TEMPLATE },
  listing_agreement: { file: 'marketing-agreement.pdf', template: MARKETING_AGREEMENT_TEMPLATE },
  doc_checklist: { file: 'documentation-checklist.pdf', template: DOCUMENTATION_CHECKLIST_TEMPLATE },
}
