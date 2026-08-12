// =============================================================================
// lib/buyerFormSchemas.ts — field definitions for the buyer-side gate: the
// remaining Confidentiality/NDA fields (doc 7, minus Business Listing ID No.
// and Business Category — those are pre-filled from the listing, never
// buyer-entered) and the full Buyer Profile Form (doc 8), transcribed from
// EZ Business Advisors LLC's actual paper forms.
// -----------------------------------------------------------------------------
// No 'use client' directive — plain data, shared between the public gate
// component, the sign API route, and the PDF generator.
// =============================================================================

import type { SellerFormField, SellerFormSection } from '@/lib/sellerFormSchemas'

const yesNo: SellerFormField['options'] = ['', 'Yes', 'No']

export const NDA_FORM_SECTIONS: SellerFormSection[] = [
  {
    title: 'Your Information',
    fields: [
      { key: 'prospect_full_legal_name', label: 'Full Legal Name', type: 'text' },
      { key: 'address', label: 'Address', type: 'text' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'state', label: 'State', type: 'text' },
      { key: 'zip', label: 'ZIP', type: 'text' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'cell', label: 'Cell', type: 'text' },
      { key: 'fax', label: 'Fax', type: 'text' },
      { key: 'drivers_license_or_ein', label: "Driver's License No. / EIN", type: 'text' },
    ],
  },
]

export const BUYER_PROFILE_SECTIONS: SellerFormSection[] = [
  {
    title: 'Personal Information',
    fields: [
      { key: 'last_name', label: 'Last Name', type: 'text' },
      { key: 'first_name', label: 'First Name', type: 'text' },
      { key: 'middle_initial', label: 'Middle Initial', type: 'text' },
      { key: 'spouse_partner_name', label: "Spouse's / Partner's Name", type: 'text' },
      { key: 'address', label: 'Address', type: 'text' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'state', label: 'State', type: 'text' },
      { key: 'zip', label: 'ZIP', type: 'text' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'mobile', label: 'Mobile', type: 'text' },
      { key: 'marital_status', label: 'Marital Status', type: 'select', options: ['', 'Married', 'Single', 'Divorced'] },
      { key: 'currently_employed', label: 'Currently Employed', type: 'select', options: yesNo },
      { key: 'relocating', label: 'Relocating', type: 'select', options: yesNo },
    ],
  },
  {
    title: 'Business Preferences',
    fields: [
      { key: 'type_of_business_preferred', label: 'Type of Business Preferred (in order of preference)', type: 'textarea' },
      { key: 'location_preference', label: 'Location Preference — County / City (in order of preference)', type: 'textarea' },
      { key: 'consider_franchise', label: 'Will you consider a franchise?', type: 'select', options: yesNo },
      { key: 'franchise_type', label: 'If yes, what type', type: 'text' },
      { key: 'when_plan_to_buy', label: 'When do you plan to buy a business?', type: 'text' },
      { key: 'issues_preventing_purchase', label: 'Are there any issues preventing you from buying a business now?', type: 'text' },
    ],
  },
  {
    title: 'Background',
    fields: [
      { key: 'education', label: 'Education', type: 'select', options: ['', 'High School', 'Some College', "Bachelor's Degree", 'Graduate Degree'] },
      { key: 'field_of_study', label: 'Field of Study / Major', type: 'text' },
      { key: 'owned_business_before', label: 'Have you owned a business?', type: 'select', options: yesNo },
      { key: 'owned_business_type', label: 'If yes, what type?', type: 'text' },
      { key: 'present_occupation', label: 'Present Occupation / Business', type: 'text' },
      { key: 'current_annual_income', label: 'Current Annual Income ($)', type: 'number' },
      { key: 'previous_occupation', label: 'Previous Occupation / Business', type: 'text' },
      { key: 'other_involved_in_decision', label: 'Who, besides yourself, is involved in this acquisition decision?', type: 'text' },
    ],
  },
  {
    title: 'Financial Information',
    fields: [
      { key: 'down_payment_amount', label: 'Amount Set Aside for Down Payment ($)', type: 'number' },
      { key: 'funds_available_when', label: 'When Will Funds Be Available?', type: 'text' },
      { key: 'minimum_owner_benefit', label: 'Minimum Owner Benefit / EBITDA Required ($)', type: 'number' },
      { key: 'qualified_sba_loan', label: 'Qualified for SBA Loan?', type: 'select', options: yesNo },
      { key: 'source_down_payment_savings', label: 'Source: Personal Savings', type: 'checkbox' },
      { key: 'source_down_payment_401k', label: 'Source: 401(k) / Retirement Funds', type: 'checkbox' },
      { key: 'source_down_payment_home_equity', label: 'Source: Home Equity Loan', type: 'checkbox' },
      { key: 'source_down_payment_business_loan', label: 'Source: Business Loan', type: 'checkbox' },
      { key: 'source_down_payment_other', label: 'Source: Other (describe)', type: 'text' },
    ],
  },
  {
    title: 'Assets',
    fields: [
      { key: 'asset_cash_bank', label: 'Cash & Bank Accounts ($)', type: 'number' },
      { key: 'asset_listed_securities', label: 'Listed Securities ($)', type: 'number' },
      { key: 'asset_unlisted_securities', label: 'Unlisted Securities ($)', type: 'number' },
      { key: 'asset_accounts_receivable', label: 'Accounts Receivable ($)', type: 'number' },
      { key: 'asset_loans_notes_receivable', label: 'Loans / Mortgages / Notes Receivable ($)', type: 'number' },
      { key: 'asset_real_estate_homestead', label: 'Real Estate — Homestead ($)', type: 'number' },
      { key: 'asset_real_estate_other', label: 'Real Estate — Other ($)', type: 'number' },
      { key: 'asset_automobiles', label: 'Automobiles (market value) ($)', type: 'number' },
      { key: 'asset_life_insurance_cash_value', label: 'Cash Value — Life Insurance ($)', type: 'number' },
      { key: 'asset_collectibles', label: 'Collectibles / Personal Property ($)', type: 'number' },
      { key: 'asset_escrow_other', label: 'Escrow / Other Accounts ($)', type: 'number' },
    ],
  },
  {
    title: 'Liabilities',
    fields: [
      { key: 'liability_notes_secured', label: 'Notes Payable to Banks (Secured) ($)', type: 'number' },
      { key: 'liability_notes_unsecured', label: 'Notes Payable to Banks (Unsecured) ($)', type: 'number' },
      { key: 'liability_amounts_payable_others', label: 'Amounts Payable to Others ($)', type: 'number' },
      { key: 'liability_current_accounts_bills', label: 'Current Accounts & Bills Payable ($)', type: 'number' },
      { key: 'liability_real_estate_mortgages', label: 'Real Estate Mortgages Payable ($)', type: 'number' },
      { key: 'liability_other_mortgages_liens', label: 'Other Mortgages / Liens ($)', type: 'number' },
      { key: 'liability_other', label: 'Other Liabilities ($)', type: 'number' },
    ],
  },
]

export const BUYER_GUIDE_TEXT = `The Confidentiality, Disclosure, and Registration Agreement (NDA) protects sensitive business information disclosed by Sellers and Broker. By proceeding you agree to: keep all business information strictly confidential; conduct all communications exclusively through Broker; and not contact the Seller, employees, customers, or suppliers without Broker's prior written approval.

The Buyer Profile Form (BPF) is a structured summary of your experience, background, financial capacity, and acquisition goals — it helps Broker and Seller confirm you're genuinely qualified and financially prepared before releasing sensitive business information. No confidential information is released until both are complete.

EZ Business Advisors LLC acts solely as a business broker and transaction intermediary — not a real estate broker, attorney, accountant, or tax advisor. You are strongly encouraged to consult your own independent legal, financial, and tax professionals before making any acquisition decision.`
