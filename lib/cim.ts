import { supabase } from '@/lib/supabase/client'
import type { Listing } from '@/lib/listings'

// ---------------------------------------------------------------------------
// CIM (Confidential Information Memorandum) generator — 25+ section,
// investment-bank quality. Uses cim_versions table (sql/full_schema.sql).
// ---------------------------------------------------------------------------

export interface CimSection {
  id: string
  title: string
  subsections: { heading: string; body: string[] }[]
}

export interface CimContent {
  title: string
  subtitle: string
  generatedAt: string
  confidential: boolean
  sections: CimSection[]
}

export interface CimVersion {
  id: string
  listing_id: string | null
  version: number
  title: string | null
  content_json: CimContent | null
  status: string
  created_at?: string | null
  updated_at?: string | null
}

const fmt = (n: number | null | undefined): string => {
  if (n === null || n === undefined || isNaN(n)) return '$—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
const pct = (n: number | null | undefined): string =>
  n === null || n === undefined || isNaN(n) ? '—' : (n * 100).toFixed(1) + '%'

// ---------------------------------------------------------------------------
// Generate a print-ready, 25+ section CIM from listing data
// ---------------------------------------------------------------------------
export function generateCimContent(listing: Listing): CimContent {
  const now = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const price = listing.asking_price
  const revenue = listing.annual_revenue
  const sde = listing.sde
  const ebitda = listing.ebitda
  const priceRev = revenue && price ? price / revenue : null
  const priceEbitda = ebitda && price ? price / ebitda : null
  const sdeMultiple = sde && price ? price / sde : null
  const grossMargin = revenue ? (revenue - (listing.inventory_value || 0)) / revenue : null
  const industry = listing.industry || 'business services'

  const sections: CimSection[] = [
    // ---- Cover data / front matter ----
    { id: 'disclaimer', title: 'Important Notice & Confidentiality', subsections: [{ heading: 'Confidentiality', body: [
      `This Confidential Information Memorandum ("CIM") has been prepared for the sole purpose of providing prospective buyers with information about the sale of ${listing.business_name || 'the business'}. It is being provided subject to the terms of a Non-Disclosure Agreement.`,
      'This document does not constitute an offer or solicitation. All figures are derived from owner-provided financial information and have not been independently audited. Prospective buyers should conduct their own due diligence.',
    ] }] },
    { id: 'table-of-contents', title: 'Table of Contents', subsections: [{ heading: 'Sections', body: [
      '1. Executive Summary', '2. The Offering', '3. Business Overview', '4. Products & Services', '5. Customer Analysis',
      '6. Financial Summary', '7. Historical Financial Performance', '8. Recast / Normalized Earnings', '9. Valuation Metrics',
      '10. Industry Analysis', '11. Market Position & Competitive Landscape', '12. Growth Opportunities', '13. Sales & Marketing',
      '14. Operations & Facilities', '15. Equipment & Assets', '16. Real Estate', '17. Employees & Management', '18. Key Person Risk & Transition',
      '19. Legal & Regulatory', '20. Franchise / Licensing (if applicable)', '21. Technology & Systems', '22. Risk Factors',
      '23. Investment Highlights', '24. Reasons for Sale', '25. Transaction Summary & Process', '26. Confidential Buyer Questionnaire',
    ] }] },

    // ---- Business ----
    { id: 'executive-summary', title: '1. Executive Summary', subsections: [
      { heading: 'Overview', body: [
        listing.description || `${listing.business_name} is being offered for sale. This CIM provides an overview of the business, operations, financial performance, and growth opportunities for prospective buyers.`,
        `The Company generates annual revenue of ${fmt(revenue)} with normalized Seller's Discretionary Earnings (SDE) of ${fmt(sde)}${ebitda ? ` and EBITDA of ${fmt(ebitda)}` : ''} as presented in Section 8.`,
      ] },
      { heading: 'Business at a Glance', body: [
        `Asking Price: ${fmt(price)}`,
        `Gross Revenue: ${fmt(revenue)}`,
        `SDE: ${fmt(sde)}`,
        ...(ebitda ? [`EBITDA: ${fmt(ebitda)}`] : []),
        `Industry: ${industry}`,
        `Location: ${listing.location_general || 'N/A'}`,
        `Real Estate Included: ${listing.real_estate_included ? 'Yes' : 'No'}`,
        `Inventory: ${fmt(listing.inventory_value)}`,
        `FF&E: ${fmt(listing.ffe_value)}`,
      ] },
    ] },
    { id: 'offering', title: '2. The Offering', subsections: [
      { heading: 'The Opportunity', body: [
        `${listing.business_name} presents a compelling acquisition opportunity in the ${industry} sector${listing.location_general ? `, located in ${listing.location_general}` : ''}.`,
        'The transaction is offered on a sale-of-assets basis with a full transition period to ensure continuity of operations and client relationships.',
      ] },
      { heading: 'Terms', body: [
        `The current asking price is ${fmt(price)}. The structure is negotiable and may be tailored to the buyer's financing profile.`,
        'Seller financing is available for qualified purchasers. An asset purchase structure is anticipated with no historical liabilities assumed.',
      ] },
    ] },
    { id: 'business-overview', title: '3. Business Overview', subsections: [
      { heading: 'History & Background', body: [
        `${listing.business_name || 'The Company'} operates in the ${industry} sector, having established a presence that reflects years of consistent service and customer relationships.`,
        'The business has developed efficient operating processes and a repeatable service model, enabling stable performance with manageable capital requirements.',
      ] },
      { heading: 'Business Model', body: [
        'The company generates revenue through its core operating activities, with a mix of recurring and transactional revenue streams that provide financial stability.',
        'Operating margins benefit from established supplier relationships, loyal clientele, and an asset-light structure.',
      ] },
    ] },
    { id: 'products-services', title: '4. Products & Services', subsections: [
      { heading: 'Core Offerings', body: [
        'The business provides a defined set of core products/services within its market, delivered with consistent quality and service standards.',
        'The service portfolio is structured to maximize recurring revenue and deepen client relationships over time.',
      ] },
      { heading: 'Pricing', body: [
        'Pricing reflects the competitive position in the market and is reviewed periodically to maintain margin while remaining attractive to clients.',
        'There is opportunity to introduce tiered pricing and premium service packages under new ownership.',
      ] },
    ] },
    { id: 'customer-analysis', title: '5. Customer Analysis', subsections: [
      { heading: 'Customer Base', body: [
        'The customer base is diversified, reducing reliance on any single client and providing stable, recurring revenue.',
        'Client relationships are characterized by high retention, driven by service quality and account management.',
      ] },
      { heading: 'Concentration Risk', body: [
        'Customer concentration is monitored; the largest clients contribute meaningfully but do not represent undue risk to the enterprise.',
        'A detailed client list and concentration analysis is available to qualified buyers under NDA.',
      ] },
    ] },

    // ---- Financial ----
    { id: 'financial-summary', title: '6. Financial Summary', subsections: [
      { heading: 'Highlights', body: [
        `Annual Revenue: ${fmt(revenue)}`,
        `SDE: ${fmt(sde)}`,
        ...(ebitda ? [`EBITDA: ${fmt(ebitda)}`] : []),
        `Gross Margin: ${pct(grossMargin)}`,
      ] },
      { heading: 'Key Ratios', body: [
        `Revenue Growth: Stable / modest growth trajectory`,
        `SDE Margin: ${sde && revenue ? pct(sde / revenue) : '—'}`,
        `Working Capital: Adequate for operating requirements`,
      ] },
    ] },
    { id: 'historical-financials', title: '7. Historical Financial Performance', subsections: [
      { heading: 'Performance Overview', body: [
        `The business has delivered annual revenue of approximately ${fmt(revenue)} with normalized earnings of ${fmt(sde)}.`,
        'Detailed 3-year historical P&L statements, tax returns, and balance sheet information are available to qualified buyers under NDA.',
        'Owner-provided figures have been normalized to reflect true economic earnings (see Section 8).',
      ] },
    ] },
    { id: 'recast-earnings', title: '8. Recast / Normalized Earnings', subsections: [
      { heading: 'Normalization Adjustments', body: [
        'The SDE and EBITDA figures shown throughout this document reflect normalized earnings after standard broker add-backs, including:',
      ] },
      { heading: 'Typical Add-Backs', body: [
        '• Owner compensation above market rate — added back',
        '• Owner health benefits, retirement, and auto — added back',
        '• Depreciation and amortization — added back',
        '• Interest expense (non-operating) — added back',
        '• One-time, non-recurring, and discretionary expenses — added back',
        '• Non-arm\'s-length payments (family, related parties) — added back',
        '• Personal expenses (travel, meals, charitable) — added back',
      ] },
      { heading: 'Note', body: [
        'A complete, itemized recast is available to qualified buyers under NDA. Figures should be verified by the buyer\'s accountant or lender.',
      ] },
    ] },
    { id: 'valuation-metrics', title: '9. Valuation Metrics', subsections: [
      { heading: 'Multiple Analysis', body: [
        `Asking Price: ${fmt(price)}`,
        `Price / Revenue: ${priceRev ? priceRev.toFixed(2) + 'x' : 'N/A'}`,
        `SDE Multiple: ${sdeMultiple ? sdeMultiple.toFixed(2) + 'x' : 'N/A'}`,
        ...(priceEbitda ? [`Price / EBITDA: ${priceEbitda.toFixed(2)}x`] : []),
        'These multiples are within or favorable to current market comparables for businesses in this sector (see Section 11).',
      ] },
    ] },

    // ---- Market ----
    { id: 'industry-analysis', title: '10. Industry Analysis', subsections: [
      { heading: 'Market Overview', body: [
        `The ${industry} industry continues to demonstrate resilience with steady demand. Businesses in this sector benefit from recurring revenue, established client relationships, and moderate capital requirements.`,
        'Industry trends favor consolidation, creating opportunity for strategic and financial buyers to achieve scale and efficiency.',
      ] },
      { heading: 'Key Drivers', body: [
        'Demand is supported by durable end-market fundamentals and recurring consumption patterns.',
        'Technology adoption, operational efficiency, and service differentiation are the primary competitive levers.',
      ] },
    ] },
    { id: 'competitive-landscape', title: '11. Market Position & Competitive Landscape', subsections: [
      { heading: 'Positioning', body: [
        'The market is fragmented, with a mix of owner-operated and regional players. The subject business has established a defensible position through its client base and reputation.',
        'This fragmentation presents an opportunity to differentiate through service quality, technology adoption, and targeted marketing.',
      ] },
      { heading: 'Comparable Transactions', body: [
        `Transactions in this sector typically transact at multiples with a strong correlation to profitability and growth.`,
        'Comparables and market data are available to qualified buyers as part of the due diligence package.',
      ] },
    ] },
    { id: 'growth-opportunities', title: '12. Growth Opportunities', subsections: [
      { heading: 'Strategic Growth Levers', body: [
        '1. Expand client acquisition through digital marketing and referral programs.',
        '2. Introduce tiered service offerings and recurring-retainer models to increase revenue per client.',
        '3. Add complementary services to broaden the addressable market.',
        '4. Leverage technology to improve operational efficiency and margins.',
        '5. Geographic expansion into adjacent markets under new ownership.',
      ] },
      { heading: 'Upside Potential', body: [
        'These growth initiatives are largely incremental to current operations and require modest capital investment, offering attractive returns on investment.',
      ] },
    ] },
    { id: 'sales-marketing', title: '13. Sales & Marketing', subsections: [
      { heading: 'Current Approach', body: [
        'The business acquires customers through a combination of direct relationships, referrals, and local/industry marketing.',
        'A portion of revenue is recurring, providing a stable base on which new marketing can layer growth.',
      ] },
      { heading: 'Opportunity', body: [
        'There is meaningful upside from formalizing the marketing function, increasing digital presence, and implementing lead-generation systems.',
      ] },
    ] },

    // ---- Operations / Assets ----
    { id: 'operations-facilities', title: '14. Operations & Facilities', subsections: [
      { heading: 'Operations', body: [
        'The business operates with established processes, vendor relationships, and operational controls that support consistent delivery.',
        'Day-to-day operations are well-documented and transferable to a new owner.',
      ] },
      { heading: 'Facilities', body: [
        `Facilities support current operations${listing.location_general ? ` at ${listing.location_general}` : ''}. Lease terms and facility details are available to qualified buyers.`,
      ] },
    ] },
    { id: 'equipment-assets', title: '15. Equipment & Assets', subsections: [
      { heading: 'FF&E and Equipment', body: [
        `Furniture, fixtures, and equipment are valued at approximately ${fmt(listing.ffe_value)} and are included in the sale.`,
        'A detailed asset schedule is available to qualified buyers under NDA.',
      ] },
      { heading: 'Inventory', body: [
        `Inventory is valued at approximately ${fmt(listing.inventory_value)} and included in the purchase at market value.`,
      ] },
    ] },
    { id: 'real-estate', title: '16. Real Estate', subsections: [
      { heading: 'Ownership', body: [
        listing.real_estate_included
          ? 'Real estate is included in the sale, offering the buyer ownership of the underlying property in addition to the operating business.'
          : 'Real estate is not included in the sale. The business operates under a lease, with terms available to qualified buyers.',
      ] },
      { heading: 'Implication', body: [
        'Potential buyers should evaluate financing structure and real estate strategy as part of their acquisition plan.',
      ] },
    ] },

    // ---- Human capital ----
    { id: 'employees', title: '17. Employees & Management', subsections: [
      { heading: 'Workforce', body: [
        'The business employs a team that supports day-to-day operations and service delivery.',
        'A detailed staffing summary, including roles, tenure, and compensation, is available to qualified buyers under NDA.',
      ] },
      { heading: 'Organizational Dependence', body: [
        'Operations are supported by the current owner. Compensation and management transition are addressed in Section 18.',
      ] },
    ] },
    { id: 'key-person-transition', title: '18. Key Person Risk & Transition', subsections: [
      { heading: 'Owner Dependence', body: [
        listing.real_estate_included
          ? 'The current owner is a hands-on operator benefiting from strong client relationships. A transition period is available to transfer knowledge and introduce the new owner to key clients and vendors.'
          : 'The current owner has established efficient operating processes. A defined transition period is available to transfer institutional knowledge, client relationships, and vendor relationships.',
      ] },
      { heading: 'Post-Sale Support', body: [
        'A transition assistance period is included to support the buyer, covering introductions to clients, vendor relationships, and operational handover.',
        'The owner is prepared to remain available for consultation to ensure a seamless transition.',
      ] },
    ] },

    // ---- Legal / Risk ----
    { id: 'legal-regulatory', title: '19. Legal & Regulatory', subsections: [
      { heading: 'Compliance', body: [
        'The business maintains the necessary licenses, permits, and registrations to operate in its jurisdiction.',
        'Details of any regulatory exposure and compliance status are available to qualified buyers.',
      ] },
      { heading: 'Contracts', body: [
        'Material contracts (supplier, customer, employment) are transferable and available for review during due diligence.',
      ] },
    ] },
    { id: 'franchise-licensing', title: '20. Franchise & Licensing (if applicable)', subsections: [
      { heading: 'Status', body: [
        'The business operates under its own brand and does not rely on third-party franchises or restrictive licenses for ongoing operations.',
        'Any applicable transferable licenses are documented for buyer review.',
      ] },
    ] },
    { id: 'technology-systems', title: '21. Technology & Systems', subsections: [
      { heading: 'Systems Stack', body: [
        'The business utilizes standard, transferable technology tools for operations, accounting, and customer management.',
        'Systems are documented and can be fully transitioned to the buyer, minimizing operational disruption.',
      ] },
      { heading: 'Data & IP', body: [
        'Customer data, operational documentation, and intellectual property transfer with the sale, subject to NDAs and industry regulations.',
      ] },
    ] },
    { id: 'risk-factors', title: '22. Risk Factors', subsections: [
      { heading: 'Considerations for Buyers', body: [
        '• Owner transition: dependence on current ownership addressed via transition period.',
        '• Customer concentration: monitored; detailed analysis provided under NDA.',
        '• Market conditions: subject to industry and macroeconomic factors.',
        '• Financing: buyer must secure adequate financing to complete the transaction.',
        'These risks are typical for businesses of this type and are mitigated by the business model and transition support.',
      ] },
    ] },

    // ---- Investment case ----
    { id: 'investment-highlights', title: '23. Investment Highlights', subsections: [
      { heading: 'Key Strengths', body: [
        `Established business in the ${industry} sector with a track record of performance.`,
        `Revenue of ${fmt(revenue)} with normalized earnings of ${fmt(sde)}.`,
        'Diversified client base providing stability and recurring revenue characteristics.',
        'Clear growth runway requiring modest incremental investment.',
        'Favorable valuation relative to comparable transactions in the market.',
      ] },
    ] },
    { id: 'reasons-for-sale', title: '24. Reasons for Sale', subsections: [
      { heading: 'Owner Motivation', body: [
        listing.reason_for_sale
          ? `The owners are pursuing a sale for the following reasons: ${listing.reason_for_sale}.`
          : 'The owners are pursuing a sale to transition to retirement and focus on other ventures.',
        'The sale is a lifestyle and succession decision, not a reflection of business performance or distress.',
      ] },
    ] },

    // ---- Process ----
    { id: 'transaction-summary', title: '25. Transaction Summary & Process', subsections: [
      { heading: 'Process', body: [
        '1. Sign NDA to receive full financial details.',
        '2. Submit Confidential Buyer Questionnaire (Section 26).',
        '3. Site visit / management call for qualified buyers.',
        '4. Submit Indication of Interest.',
        '5. Negotiation and execution of Letter of Intent.',
        '6. Due diligence.',
        '7. Closing.',
      ] },
      { heading: 'Timeline', body: [
        'The seller seeks a timely, efficient process. Interested parties are encouraged to move promptly to secure exclusivity.',
      ] },
    ] },
    { id: 'buyer-questionnaire', title: '26. Confidential Buyer Questionnaire', subsections: [
      { heading: 'Please Provide', body: [
        '• Corporate / personal background and experience',
        '• Acquisition objectives and intended use',
        '• Financial capacity and proof of funds',
        '• Proposed structure or financing plan',
        '• Timing and ability to close',
        '• References (bank, professional)',
      ] },
    ] },
  ]

  return {
    title: listing.business_name || 'Confidential Business',
    subtitle: listing.headline || 'Confidential Information Memorandum',
    generatedAt: now,
    confidential: true,
    sections,
  }
}

// ---------------------------------------------------------------------------
// Shareable link — creates a public share key stored on the version row.
// Real deployment: host the CIM at /share/cim/[id] behind a public read.
// ---------------------------------------------------------------------------
export async function createCimShareLink(versionId: string): Promise<string> {
  // A share is represented by making the version public + generating a link.
  // For real deployments, add a `share_token` + `is_public` column and a public
  // read policy. Here we return the in-app share path.
  const { data } = await supabase.auth.getUser()
  return `/share/cim/${versionId}?token=${''}&sharer=${data?.user?.id || ''}`
}

// ---------------------------------------------------------------------------
// Version control
// ---------------------------------------------------------------------------
export async function fetchCimVersions(listingId: string): Promise<CimVersion[]> {
  const { data, error } = await supabase
    .from('cim_versions')
    .select('*')
    .eq('listing_id', listingId)
    .order('version', { ascending: false })
  if (error) {
    console.error('fetchCimVersions error:', error)
    throw new Error(error.message || 'Failed to load CIM versions')
  }
  return (data as CimVersion[]) || []
}

export async function saveCimVersion(
  listingId: string,
  content: CimContent,
  status: string = 'draft'
): Promise<CimVersion> {
  const versions = await fetchCimVersions(listingId).catch(() => [])
  const nextVersion = versions.length ? versions[0].version + 1 : 1

  const { data, error } = await supabase
    .from('cim_versions')
    .insert({ listing_id: listingId, version: nextVersion, title: content.title, content_json: content, status })
    .select()
    .single()
  if (error) {
    console.error('saveCimVersion error:', error)
    throw new Error(error.message || 'Failed to save CIM version')
  }
  return data as CimVersion
}
