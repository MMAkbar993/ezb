// =============================================================================
// lib/sellerFormSchemas.ts — field definitions for the 5 seller legal-document
// forms (Seller Interview, Exclusive Marketing & Listing Agreement, Corporate
// Authorization Resolution, LLC Authorization Resolution, Documentation
// Checklist), transcribed from EZ Business Advisors LLC's actual paper forms.
// -----------------------------------------------------------------------------
// No 'use client' directive — plain data, safe to import from both client
// components and server-only code (PDF generation, API routes). See
// lib/storageBuckets.ts for why that distinction matters in this codebase.
// =============================================================================

export type SellerFormType = 'seller_interview' | 'listing_agreement' | 'corp_resolution' | 'llc_resolution' | 'doc_checklist'

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox'

export interface SellerFormField {
  key: string
  label: string
  type: FieldType
  options?: string[]
  placeholder?: string
}

export interface SellerFormSection {
  title: string
  fields: SellerFormField[]
}

export interface SellerFormSchema {
  type: SellerFormType
  title: string
  intro?: string
  requiresSignature: boolean
  sections: SellerFormSection[]
}

const yesNo: SellerFormField['options'] = ['', 'Yes', 'No']

export const SELLER_FORM_SCHEMAS: Record<SellerFormType, SellerFormSchema> = {
  seller_interview: {
    type: 'seller_interview',
    title: 'Seller Interview Form',
    intro: 'Complete every field as thoroughly as possible. This information is used to prepare the Business Listing Information (BLI) and market the business to qualified buyers. All information is held in strict confidence.',
    requiresSignature: true,
    sections: [
      {
        title: 'Seller Information',
        fields: [
          { key: 'principal_home_address', label: 'Principal Home Address', type: 'text' },
          { key: 'city', label: 'City', type: 'text' },
          { key: 'county', label: 'County', type: 'text' },
          { key: 'state', label: 'State', type: 'text' },
          { key: 'zip_code', label: 'ZIP Code', type: 'text' },
          { key: 'best_contact_phone', label: 'Best Contact Phone', type: 'text' },
          { key: 'reason_for_sale', label: 'Reason for Sale', type: 'textarea' },
        ],
      },
      {
        title: 'Business Details',
        fields: [
          { key: 'business_name', label: 'Business Name', type: 'text' },
          { key: 'legal_entity_name', label: 'Legal Entity Name', type: 'text' },
          { key: 'business_telephone', label: 'Business Telephone', type: 'text' },
          { key: 'fax', label: 'Fax', type: 'text' },
          { key: 'website', label: 'Website', type: 'text' },
          { key: 'hours_of_operation', label: 'Hours of Operation', type: 'text' },
          { key: 'hours_owner_works_per_week', label: 'Hours Owner Works per Week', type: 'text' },
          { key: 'years_established', label: 'Years Established', type: 'number' },
          { key: 'years_under_current_ownership', label: 'Years Under Current Ownership', type: 'number' },
          { key: 'state_of_incorporation', label: 'State of Incorporation / Formation', type: 'text' },
          { key: 'organization_type', label: 'Organization Type (LLC / Corp / SP / Other)', type: 'text' },
          { key: 'is_relocatable', label: 'Is Business Relocatable?', type: 'select', options: yesNo },
          { key: 'home_based', label: 'Home-Based?', type: 'select', options: yesNo },
          { key: 'franchise', label: 'Franchise?', type: 'select', options: yesNo },
        ],
      },
      {
        title: 'Employees (Excluding Owner)',
        fields: [
          { key: 'managers', label: 'Managers', type: 'number' },
          { key: 'full_time', label: 'Full Time', type: 'number' },
          { key: 'part_time', label: 'Part Time', type: 'number' },
          { key: 'seasonal_contract', label: 'Seasonal / Contract', type: 'number' },
        ],
      },
      {
        title: 'Legal and Operations',
        fields: [
          { key: 'lawsuits_pending', label: 'Lawsuits Existing or Pending?', type: 'select', options: yesNo },
          { key: 'tax_liens', label: 'Tax Liens?', type: 'select', options: yesNo },
          { key: 'legal_explain', label: 'If yes to either, please explain', type: 'textarea' },
          { key: 'skills_licenses_required', label: 'Skills / Licenses Required to Operate', type: 'text' },
          { key: 'business_category', label: 'Business Category', type: 'text' },
          { key: 'business_sub_category', label: 'Business Sub-Category / Detail', type: 'text' },
        ],
      },
      {
        title: 'Business Profile',
        fields: [
          { key: 'business_description', label: 'Business Description', type: 'textarea' },
          { key: 'business_history', label: 'Business History', type: 'textarea' },
          { key: 'growth_opportunities', label: 'Potential Growth Opportunities', type: 'textarea' },
          { key: 'competitive_overview', label: 'Competitive Overview', type: 'textarea' },
        ],
      },
      {
        title: 'Location',
        fields: [
          { key: 'general_location', label: 'General Location', type: 'text' },
          { key: 'facility_type', label: 'Facility Type (Office / Retail / Warehouse / Other)', type: 'text' },
          { key: 'building_type', label: 'Building Type (Own / Lease)', type: 'text' },
          { key: 'leasable_sqft', label: 'Leasable Square Feet', type: 'number' },
          { key: 'monthly_rent', label: 'Monthly Rent / Lease ($)', type: 'number' },
          { key: 'lease_expiration_date', label: 'Lease Expiration Date', type: 'date' },
          { key: 'rent_includes_insurance_etc', label: 'Rent/Lease Includes Insurance, Maintenance, Taxes?', type: 'select', options: yesNo },
          { key: 'renewal_options', label: 'Renewal Options', type: 'text' },
          { key: 'formal_appraisal_last_12mo', label: 'Formal Appraisal in Last 12 Months?', type: 'select', options: yesNo },
        ],
      },
      {
        title: 'Assets Included in Sale Value',
        fields: [
          { key: 'asset_leasehold_improvements', label: 'Leasehold Improvements ($)', type: 'number' },
          { key: 'asset_ffe', label: 'Furniture, Fixtures & Equipment ($)', type: 'number' },
          { key: 'asset_inventory', label: 'Inventory ($)', type: 'number' },
          { key: 'asset_vehicles', label: 'Vehicles ($)', type: 'number' },
          { key: 'asset_goodwill', label: 'Goodwill / Trade Name ($)', type: 'number' },
          { key: 'asset_other', label: 'Other ($)', type: 'number' },
        ],
      },
      {
        title: 'Assets Not Included in Sale Value',
        fields: [
          { key: 'excluded_accounts_receivable', label: 'Accounts Receivable ($)', type: 'number' },
          { key: 'excluded_other_1', label: 'Other ($)', type: 'number' },
          { key: 'excluded_other_2', label: 'Other ($)', type: 'number' },
        ],
      },
      {
        title: 'Liabilities',
        fields: [
          { key: 'liabilities_to_be_paid', label: 'Liabilities to Be Paid at Closing', type: 'textarea' },
        ],
      },
    ],
  },

  listing_agreement: {
    type: 'listing_agreement',
    title: 'Exclusive Marketing & Listing Agreement',
    intro: 'EZ Business Advisors LLC acts solely as a Business Broker and Transaction Intermediary. Not a Real Estate Broker or Real Estate Agent.',
    requiresSignature: true,
    sections: [
      {
        title: 'Business & Seller Information',
        fields: [
          { key: 'business_name', label: 'Business Name', type: 'text' },
          { key: 'seller_legal_name', label: 'Seller Legal Name', type: 'text' },
          { key: 'business_address', label: 'Business Address', type: 'text' },
          { key: 'city', label: 'City', type: 'text' },
          { key: 'state', label: 'State', type: 'text' },
          { key: 'zip', label: 'ZIP', type: 'text' },
          { key: 'principal_name', label: 'Principal Name', type: 'text' },
          { key: 'cell_phone', label: 'Cell Phone', type: 'text' },
          { key: 'private_email', label: 'Private Email', type: 'text' },
        ],
      },
      {
        title: 'Transaction Terms',
        fields: [
          { key: 'non_compete_radius', label: 'Non-Compete Radius', type: 'text' },
          { key: 'non_compete_term_years', label: 'Non-Compete Term (years)', type: 'number' },
          { key: 'training_period_weeks', label: 'Training Period at No Cost (weeks)', type: 'number' },
          { key: 'inventory_included_value', label: 'Inventory Included ($)', type: 'number' },
          { key: 'annual_sales', label: 'Annual Sales ($) — Owner will prove at closing', type: 'number' },
          { key: 'sde', label: "Seller's Discretionary Earnings (SDE) ($) — Owner will prove at closing", type: 'number' },
          { key: 'total_asking_price', label: 'Total Asking Price ($)', type: 'number' },
          { key: 'down_payment', label: 'Down Payment ($)', type: 'number' },
          { key: 'seller_note', label: 'Seller Note ($)', type: 'number' },
          { key: 'interest_rate', label: 'Interest Rate', type: 'text' },
          { key: 'monthly_payment', label: 'Monthly Payment ($)', type: 'number' },
          { key: 'term_months', label: 'Seller Note Repayment Term (months)', type: 'number' },
          { key: 'additional_provisions', label: 'Additional Provisions', type: 'textarea' },
        ],
      },
      {
        title: 'Agreement Terms',
        fields: [
          { key: 'agreement_term_months', label: 'Agreement Term (months)', type: 'number', placeholder: 'e.g. 12' },
          { key: 'broker_commission_percent', label: 'Broker Commission (%)', type: 'number', placeholder: 'e.g. 8' },
          { key: 'commission_minimum_fee', label: 'Minimum Commission Fee ($)', type: 'number', placeholder: 'e.g. 15000' },
        ],
      },
    ],
  },

  corp_resolution: {
    type: 'corp_resolution',
    title: 'Corporate Authorization Resolution',
    intro: 'Use when Seller is organized as a Corporation. An authorized officer must complete all fields and sign below.',
    requiresSignature: true,
    sections: [
      {
        title: 'Corporate Identification',
        fields: [
          { key: 'corporation_full_legal_name', label: 'Corporation Full Legal Name', type: 'text' },
          { key: 'state_of_incorporation', label: 'State of Incorporation', type: 'text' },
          { key: 'authorized_officer_full_name', label: 'Authorized Officer Full Name', type: 'text' },
          { key: 'officer_title', label: 'Title', type: 'text' },
          { key: 'meeting_consent_date', label: 'Meeting / Consent Date', type: 'date' },
          { key: 'county_state_of_meeting', label: 'County and State of Meeting', type: 'text' },
          { key: 'authorized_person_full_name', label: 'Full Name of Person Authorized to Act on Behalf of Corporation', type: 'text' },
        ],
      },
    ],
  },

  llc_resolution: {
    type: 'llc_resolution',
    title: 'LLC Authorization Resolution',
    intro: 'Use when Seller is organized as a Limited Liability Company (LLC). The Managing Member must complete all fields and sign below.',
    requiresSignature: true,
    sections: [
      {
        title: 'LLC Identification',
        fields: [
          { key: 'company_full_legal_name', label: 'Company Full Legal Name', type: 'text' },
          { key: 'state_of_organization', label: 'State of Organization', type: 'text' },
          { key: 'managing_member_full_name', label: 'Managing Member Full Name', type: 'text' },
          { key: 'member_title', label: 'Title', type: 'text' },
          { key: 'meeting_consent_date', label: 'Meeting / Consent Date', type: 'date' },
          { key: 'county_state_of_meeting', label: 'County and State of Meeting', type: 'text' },
          { key: 'authorized_person_full_name', label: 'Full Name of Person Authorized to Act on Behalf of the Company', type: 'text' },
        ],
      },
    ],
  },

  doc_checklist: {
    type: 'doc_checklist',
    title: 'Documentation Checklist',
    intro: 'Check off what you can provide now — anything missing can be added later. This is used to prepare your Business Listing Information (BLI).',
    requiresSignature: false,
    sections: [
      {
        title: 'Financial Documents',
        fields: [
          { key: 'fin_tax_returns_3yr', label: 'Last 3 years of federal and state business income tax returns', type: 'checkbox' },
          { key: 'fin_yearend_pl_3yr', label: 'Year-end Profit & Loss Statements for the last 3 years', type: 'checkbox' },
          { key: 'fin_interim_pl', label: 'Current year interim (year-to-date) Profit & Loss Statement', type: 'checkbox' },
          { key: 'fin_balance_sheets', label: 'Year-end Balance Sheets for the last 3 years and current interim Balance Sheet', type: 'checkbox' },
          { key: 'fin_monthly_sales_3yr', label: 'Monthly sales reports for the last 3 years', type: 'checkbox' },
          { key: 'fin_accountant_contact', label: 'Name, firm, phone, and email of your Accountant or CPA', type: 'checkbox' },
        ],
      },
      {
        title: 'Facility Documents',
        fields: [
          { key: 'fac_lease_or_deed', label: 'Complete copy of current Lease(s) and/or Deed for business premises', type: 'checkbox' },
          { key: 'fac_ffe_list', label: 'Complete itemized list of all Furniture, Fixtures, and Equipment (FF&E)', type: 'checkbox' },
          { key: 'fac_non_owned_equipment', label: 'Separate list of any equipment NOT owned by the business', type: 'checkbox' },
          { key: 'fac_appraisals', label: 'Any appraisals for business property or equipment in the last 24 months', type: 'checkbox' },
        ],
      },
      {
        title: 'Business Operations',
        fields: [
          { key: 'ops_top_customers', label: 'Top five (5) customers by revenue contribution', type: 'checkbox' },
          { key: 'ops_suppliers', label: 'List of major suppliers and copies of any key supplier contracts', type: 'checkbox' },
          { key: 'ops_employee_list', label: 'Complete employee list (name, title, length of service, compensation)', type: 'checkbox' },
          { key: 'ops_creditors', label: 'List of all major creditors and outstanding balances owed', type: 'checkbox' },
          { key: 'ops_contractual_obligations', label: 'Ongoing/upcoming contractual obligations to be assumed by Purchaser', type: 'checkbox' },
        ],
      },
      {
        title: 'Marketing Materials',
        fields: [
          { key: 'mkt_price_lists', label: 'Current price lists', type: 'checkbox' },
          { key: 'mkt_menus_or_offerings', label: 'Menus, service descriptions, or product offering information', type: 'checkbox' },
          { key: 'mkt_franchise_docs', label: 'Franchise documents and contracts (if applicable)', type: 'checkbox' },
          { key: 'mkt_brochures', label: 'Company brochures, flyers, and marketing collateral', type: 'checkbox' },
          { key: 'mkt_website_social', label: 'Website URL(s), login credentials (for transfer), social media profiles', type: 'checkbox' },
          { key: 'mkt_catalogs', label: 'Product catalogs or portfolios', type: 'checkbox' },
        ],
      },
    ],
  },
}

export const SELLER_FORM_ORDER: SellerFormType[] = [
  'seller_interview', 'listing_agreement', 'corp_resolution', 'llc_resolution', 'doc_checklist',
]

// -----------------------------------------------------------------------------
// The Exclusive Marketing & Listing Agreement's numbered clauses, with
// commission % / minimum fee / term interpolated from the filled values
// (falling back to EZ Business Advisors' standard terms — 8%, $15,000
// minimum, 12 months — when left blank). The other clauses are fixed
// boilerplate, reproduced verbatim from the source agreement. Shared by the
// remote seller-sign API route and the broker's in-app "complete now" path
// so the two never drift out of sync.
// -----------------------------------------------------------------------------
export function buildListingAgreementClauses(formData: Record<string, unknown>): string[] {
  const commission = formData.broker_commission_percent ? Number(formData.broker_commission_percent) : 8
  const minFee = formData.commission_minimum_fee ? Number(formData.commission_minimum_fee) : 15000
  const termMonths = formData.agreement_term_months ? Number(formData.agreement_term_months) : 12
  const minFeeStr = minFee.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

  return [
    '1. Exclusive Right to Market. Seller grants Broker the exclusive right to market and seek a purchaser for the Business during the Term. Broker is a licensed business broker acting solely as a transaction intermediary. Broker is NOT a real estate broker or real estate agent, and this Agreement does not confer real estate brokerage authority.',
    `2. Term. The initial term of this Agreement is ${termMonths} month${termMonths === 1 ? '' : 's'} beginning on the date of execution, unless extended in writing by the parties.`,
    "3. Marketing and Co-Brokerage. Broker may advertise, market, and co-broke the listing in Broker's sole discretion, including listing on business-for-sale platforms, co-brokering with other business brokers, and any other lawful marketing activity.",
    `4. Broker Compensation. Seller shall pay Broker ${commission}% of the total sales price, with a minimum fee of ${minFeeStr}, due upon Closing or upon Broker's procurement of a ready, willing, and able buyer on terms acceptable to Seller, whichever occurs first.`,
    '5. Seller Cooperation. Seller shall cooperate fully with Broker, including timely referral of all inquiries, prompt disclosure of all relevant information, attendance at closing if requested, and delivery of all closing documents in a timely manner.',
    "6. Seller Representations. Seller represents that all information supplied is accurate to the best of Seller's knowledge and may be relied upon by Broker and prospective purchasers. Seller shall promptly notify Broker of any material change in business conditions, financial performance, or legal status.",
    "7. Indemnification. Seller agrees to indemnify and hold Broker harmless from any claims, losses, damages, costs, and attorneys' fees arising from false, incomplete, or misleading information supplied by Seller, or from Seller's breach of any obligation under this Agreement.",
    "8. Governing Law; Venue. This Agreement is governed by the laws of the Commonwealth of Pennsylvania. Any action shall be brought in Dauphin County, Pennsylvania, or the federal court serving Harrisburg, PA, unless otherwise required by law. The prevailing party is entitled to reasonable attorneys' fees.",
    "9. Electronic Signatures. Electronic signatures and electronic delivery are valid and binding to the fullest extent permitted by Pennsylvania's Electronic Transactions Act, 73 P.S. § 2260.101 et seq.",
    '10. Entire Agreement. This Agreement contains the entire understanding of the parties and supersedes all prior discussions, negotiations, and representations. It may be modified only in a signed writing executed by both parties.',
  ]
}
