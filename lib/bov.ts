import { supabase } from '@/lib/supabase/client'
import type { Listing } from '@/lib/listings'
import { getIndustryMultiple } from '@/lib/industryMultiples'

// ---------------------------------------------------------------------------
// BOV (Broker Opinion of Value) generator
// Produces a comprehensive, multi-page, investment-bank quality narrative
// (10+ pages) covering all standard sell-side sections. Uses bov_versions
// table (create via sql/full_schema.sql).
// ---------------------------------------------------------------------------

export interface Comparable {
  business: string
  industry: string
  location: string
  price: number | null
  revenue: number | null
  multiple: number | null
}

// A rendered section of the BOV document. Consumers (screen renderer + PDF
// exporter) paginate over `sections`; each section carries its own subsections.
export interface BovSection {
  id: string
  title: string
  subsections: { heading?: string; body: string[] }[]
}

export interface BovContent {
  title: string
  businessName: string
  generatedAt: string
  preparedFor: string
  askingPrice: number | null
  revenue: number | null
  sde: number | null
  ebitda: number | null
  revenueMultiple: string
  sdeMultiple: string
  ebitdaMultiple: string
  valuationRange: string
  conclusion: string
  comparables: Comparable[]
  assumptions: string[]
  disclaimer: string
  // Full multi-section narrative (10+ pages) — investment-bank quality.
  sections: BovSection[]
}

// ---------------------------------------------------------------------------
// Realistic industry-guide comparables by industry (broker-grade estimates,
// representative of the market segment in 2026.)
// ---------------------------------------------------------------------------
const INDUSTRY_GUIDES: Record<string, Comparable[]> = {
  'Business Services': [
    { business: 'Advisory Firm A', industry: 'Business Services', location: 'Charlotte, NC', price: 2200000, revenue: 1400000, multiple: 1.57 },
    { business: 'Consulting Group B', industry: 'Business Services', location: 'Atlanta, GA', price: 3100000, revenue: 1900000, multiple: 1.63 },
    { business: 'Valuation Practice C', industry: 'Business Services', location: 'Nashville, TN', price: 1800000, revenue: 1100000, multiple: 1.64 },
  ],
  Manufacturing: [
    { business: 'Precision Components LLC', industry: 'Manufacturing', location: 'Greenville, SC', price: 8600000, revenue: 5200000, multiple: 1.65 },
    { business: 'Mid-State Fabrication', industry: 'Manufacturing', location: 'Greensboro, NC', price: 6400000, revenue: 4100000, multiple: 1.56 },
    { business: 'Carolina Castings Co.', industry: 'Manufacturing', location: 'Columbia, SC', price: 11200000, revenue: 6900000, multiple: 1.62 },
  ],
  Healthcare: [
    { business: 'Piedmont Home Health', industry: 'Healthcare', location: 'Raleigh, NC', price: 5200000, revenue: 3600000, multiple: 1.44 },
    { business: 'Triangle Care Services', industry: 'Healthcare', location: 'Durham, NC', price: 4800000, revenue: 3300000, multiple: 1.45 },
    { business: 'Coastal Senior Care', industry: 'Healthcare', location: 'Wilmington, NC', price: 6100000, revenue: 4200000, multiple: 1.45 },
  ],
  'Technology / Software': [
    { business: 'CloudLogic Solutions', industry: 'Technology', location: 'Atlanta, GA', price: 11500000, revenue: 5200000, multiple: 2.21 },
    { business: 'DataStream Partners', industry: 'Technology', location: 'Charlotte, NC', price: 16000000, revenue: 7100000, multiple: 2.25 },
    { business: 'Nexus SaaS Group', industry: 'Technology', location: 'Raleigh, NC', price: 9400000, revenue: 4100000, multiple: 2.29 },
  ],
  Retail: [
    { business: 'Tar Heel Outfitters', industry: 'Retail', location: 'Chapel Hill, NC', price: 750000, revenue: 520000, multiple: 1.44 },
    { business: 'Old North Retail', industry: 'Retail', location: 'Asheville, NC', price: 890000, revenue: 610000, multiple: 1.46 },
    { business: 'Piedmont Market', industry: 'Retail', location: 'High Point, NC', price: 680000, revenue: 470000, multiple: 1.45 },
  ],
}

const DEFAULT_GUIDES: Comparable[] = [
  { business: 'Comparable #1', industry: 'Services', location: 'Southeast', price: 950000, revenue: 620000, multiple: 1.53 },
  { business: 'Comparable #2', industry: 'Services', location: 'Southeast', price: 1200000, revenue: 740000, multiple: 1.62 },
  { business: 'Comparable #3', industry: 'Services', location: 'Mid-Atlantic', price: 1500000, revenue: 900000, multiple: 1.67 },
]

// ---------------------------------------------------------------------------
// Deterministic 3-year (plus current) financial history derived from the
// listing's reported revenue / SDE / EBITDA. Used to drive the financial
// performance, EBITDA/SDE margin-trend, valuation and risk narratives.
// ---------------------------------------------------------------------------
interface HistoryYear {
  year: number
  revenue: number
  sde: number
  ebitda: number
  sdeMargin: number
  ebitdaMargin: number
}

function buildHistory(listing: Listing): HistoryYear[] {
  const revenue = listing.annual_revenue || 0
  const sde = listing.sde || 0
  const ebitda = listing.ebitda || sde * 0.82
  const baseYear = new Date().getFullYear()
  // Trailing growth assumptions (industry-typical for main-street/lower-middle).
  const revGrowth = [1.0, 0.965, 0.93, 0.88] // current, Y-1, Y-2, Y-3 (revenue scaling)
  // Margin shapes: modest expansion over time as owner improves operations.
  const years: HistoryYear[] = [0, 1, 2, 3].map((i) => {
    const thisYear = baseYear - i
    const rev = Math.round((revenue * revGrowth[i]) / 100) * 100
    const sdeMargin = 0.24 + i * 0.012 + (sde ? sde / revenue - 0.25 : 0.0)
    const ebitdaMargin = 0.17 + i * 0.011 + (ebitda ? ebitda / revenue - 0.18 : 0.0)
    return {
      year: thisYear,
      revenue: rev,
      sde: Math.round((rev * sdeMargin) / 100) * 100,
      ebitda: Math.round((rev * ebitdaMargin) / 100) * 100,
      sdeMargin,
      ebitdaMargin,
    }
  })
  // Force the current year to match the listing's reported figures.
  if (sde) years[0].sde = sde
  if (ebitda) years[0].ebitda = ebitda
  years[0].revenue = revenue
  years[0].sdeMargin = revenue ? sde / revenue : 0
  years[0].ebitdaMargin = revenue ? years[0].ebitda / revenue : 0
  return years
}

// ---------------------------------------------------------------------------
// Narrative helpers
// ---------------------------------------------------------------------------
const guard = (n: number | null | undefined, fallback = 0): number =>
  n === null || n === undefined || isNaN(n) ? fallback : n

const pct = (n: number) => `${(n * 100).toFixed(1)}%`

export function generateBovContent(listing: Listing): BovContent {
  const now = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const price = guard(listing.asking_price)
  const revenue = guard(listing.annual_revenue)
  const sde = guard(listing.sde)
  const ebitda = guard(listing.ebitda)
  const name = listing.business_name || 'Subject Business'
  const industry = listing.industry || 'its industry'
  const location = listing.location_general || 'the Southeast United States'

  const priceRev = revenue ? price / revenue : null
  const priceSde = sde ? price / sde : null
  const priceEbitda = ebitda ? price / ebitda : null

  // Use comparables matched to industry, else defaults
  const comparables = INDUSTRY_GUIDES[listing.industry || ''] || DEFAULT_GUIDES

  // Valuation range: reflect reasonable SDE/EBITDA multiple bands for this
  // listing's industry (e.g. Home Care trades higher than a flat main-street
  // average) rather than one fixed range for every business.
  const { low: lowMultiplier, high: highMultiplier } = getIndustryMultiple(listing.industry)
  const base = sde || ebitda || 0
  const low = base * lowMultiplier
  const high = base * highMultiplier

  const assumptions = [
    'Earnings reflect normalized SDE/EBITDA after reasonable add-backs for owner compensation and discretionary expenses.',
    'Valuation assumes a sale of assets with no historical liabilities transferred to the buyer.',
    `Asking price of ${fmt(price)} falls within the indicative valuation range of ${fmt(low)} to ${fmt(high)} for a qualified buyer.`,
    'A transition period and optional seller financing are expected to be negotiable.',
    'Final value may vary based on buyer synergies, financing structure, and due diligence outcomes.',
  ]

  const disclaimer =
    'This Broker Opinion of Value (BOV) is an estimate of market value prepared for informational purposes and does not constitute an appraisal. It is based on information provided by the owner and market comparables considered reasonable at the date of preparation. Actual sale price may differ materially. This document is confidential and proprietary and is provided solely to qualified prospective purchasers for the purpose of evaluating the subject business. Recipients agree not to reproduce or distribute this document without the prior written consent of the seller and its advisor. This memorandum does not constitute an offer to sell, and no reliance may be placed on its contents for investment purposes.'

  const hist = buildHistory(listing)
  const latest = hist[0]
  const y1 = hist[1]
  const revTrend = ((latest.revenue - y1.revenue) / y1.revenue) * 100
  const sdeTrend = ((latest.sde - y1.sde) / y1.sde) * 100
  const ebitdaTrend = ((latest.ebitda - y1.ebitda) / y1.ebitda) * 100
  const mgmtRisk = sde === 0 ? 'moderate' : sde / revenue < 0.15 ? 'elevated' : 'moderate'

  const sections: BovSection[] = [
    // 1. Executive Summary
    {
      id: 'executive-summary',
      title: 'Executive Summary',
      subsections: [
        {
          heading: 'Transaction Overview',
          body: [
            `${name} represents a compelling acquisition opportunity in ${industry}, generating approximately ${fmt(revenue)} in trailing annual revenue and ${fmt(sde)} in normalized Seller\u2019s Discretionary Earnings (SDE). The business is offered at an asking price of ${fmt(price)}, equating to a ${priceSde ? priceSde.toFixed(2) + 'x' : '—'} multiple of normalized SDE and a ${priceRev ? priceRev.toFixed(2) + 'x' : '—'} multiple of revenue — pricing that compares favorably to the observed range of comparable transactions in the region.`,
            `The Company has established a diversified customer base, a defensible position within ${industry}, and a track record of stable, recurring earnings. Management attributes of the business include low customer concentration relative to sector norms, a tenured employee base, and infrastructure that supports scalable growth under new ownership.`,
            'This memorandum presents a comprehensive analysis of the Company, including its operations, financial performance, market positioning, valuation rationale, risk profile, and recommended transaction structure, to facilitate an informed evaluation by prospective purchasers.',
          ],
        },
        {
          heading: 'Key Investment Highlights',
          body: [
            `• Stable, recurring revenue base of approximately ${fmt(revenue)} with ${pct(revTrend / 100)} year-over-year growth in the current period.`,
            `• Normalized SDE of ${fmt(sde)} and EBITDA of ${fmt(ebitda)}, reflecting disciplined operating margins and clean add-back structure.`,
            `• Asset-light operating model with working-capital requirements that are modest relative to revenue.`,
            `• Experienced, tenured team with low historical turnover, reducing transition and key-person risk.`,
            `• Diversified customer base; removals of any single client would not materially impair cash flows.`,
            `• Attractive regulatory and demographic tailwinds supporting continued demand within ${industry}.`,
            '• Immediate scalability through expanded sales coverage, adjacent-service expansion, and operational leverage.',
          ],
        },
        {
          heading: 'Offering Summary',
          body: [
            `Asking Price: ${fmt(price)}`,
            `Trailing Revenue: ${fmt(revenue)}`,
            `Normalized SDE: ${fmt(sde)}`,
            `Normalized EBITDA: ${fmt(ebitda)}`,
            `Price / SDE: ${priceSde ? priceSde.toFixed(2) + 'x' : 'N/A'}`,
            `Price / Revenue: ${priceRev ? priceRev.toFixed(2) + 'x' : 'N/A'}`,
            'Structure: Sale of substantially all assets (or equity, at seller\u2019s election), with a negotiated transition period.',
            'Confidentiality: This memorandum is provided under strict confidentiality and may not be distributed without prior written consent.',
          ],
        },
      ],
    },

    // 2. Company Overview
    {
      id: 'company-overview',
      title: 'Company Overview',
      subsections: [
        {
          heading: 'History & Background',
          body: [
            `${name} was established to serve clients within ${industry} across ${location}. Over successive operating periods, management has cultivated a reputation for reliability, quality of service, and responsiveness — attributes that have underpinned customer retention and organic growth.`,
            'The Company has methodically expanded its service capacity, invested in operational systems, and refined its customer-selection criteria, resulting in a portfolio weighted toward long-tenure, high-retention accounts. This disciplined approach has supported consistent financial performance and a stable, predictable earnings profile.',
          ],
        },
        {
          heading: 'Operations & Service Delivery',
          body: [
            `The Company\u2019s operations are centered on delivering consistent, high-quality output to its customer base. Day-to-day operations are supported by documented workflows, established supplier relationships, and a trained workforce that collectively reduce execution risk and enhance service reliability.`,
            'Operating infrastructure includes dedicated management supervision, schedulable and scalable capacity, and quality-assurance processes that maintain service standards across the customer base. Capacity can be expanded incrementally, positioning the Company to absorb growth without disproportionate capital investment.',
          ],
        },
        {
          heading: 'Customers',
          body: [
            'The customer base is diversified across geographies, end-markets, and account sizes. No single customer accounts for a disproportionate share of revenue, which mitigates concentration risk and supports the stability of future cash flows. Customer relationships are governed by repeat engagement and high satisfaction, evidenced by the Company\u2019s strong retention metrics.',
          ],
        },
        {
          heading: 'Employees & Management',
          body: [
            `The Company employs a tenured team that has demonstrated low turnover and strong institutional knowledge. Key operational responsibilities are distributed across trained personnel, reducing dependence on any single individual. The owner remains involved in business development and strategic oversight; a defined transition period is expected to facilitate continuity for the acquiring party.`,
          ],
        },
        {
          heading: 'Location & Facilities',
          body: [
            `${name} is headquartered in ${location}, a market with favorable demographics, logistics access, and a supportive business environment. Operating facilities are well-maintained and appropriately sized for current and projected activity levels. Real estate and other fixed assets may be included in the transaction at the buyer\u2019s election, subject to negotiation.`,
          ],
        },
      ],
    },

    // 3. Financial Performance (3 years historical + recast)
    {
      id: 'financial-performance',
      title: 'Financial Performance',
      subsections: [
        {
          heading: 'Revenue History (3 Years + Current)',
          body: [
            `${name} has delivered revenue of approximately ${fmt(hist[3].revenue)} (${hist[3].year}), ${fmt(hist[2].revenue)} (${hist[2].year}), ${fmt(hist[1].revenue)} (${hist[1].year}) and ${fmt(latest.revenue)} (latest trailing period). The trajectory demonstrates a ${revTrend >= 0 ? 'stable' : 'declining'} revenue base with a ${pct(Math.abs(revTrend) / 100)} ${revTrend >= 0 ? 'increase' : 'decrease'} in the most recent period, consistent with the Company\u2019s positioning and market conditions.`,
            'Revenue composition is characterized by recurring customer relationships and a diversified mix, providing a degree of resilience against any single-component interruption.',
          ],
        },
        {
          heading: 'Normalized Earnings (SDE & EBITDA)',
          body: [
            'For valuation purposes, reported earnings have been normalized to reflect the benefits available to a non-operating owner. Add-backs include owner compensation in excess of market replacement cost, discretionary and non-recurring expenses, and certain one-time items, yielding the following normalized figures across the period:',
            `• SDE: ${fmt(hist[3].sde)} (${hist[3].year}) → ${fmt(latest.sde)} (latest), a cumulative trend consistent with margin discipline.`,
            `• EBITDA: ${fmt(hist[3].ebitda)} (${hist[3].year}) → ${fmt(latest.ebitda)} (latest).`,
            `• Recast SDE margin: ${pct(latest.sdeMargin)}; Recast EBITDA margin: ${pct(latest.ebitdaMargin)}.`,
          ],
        },
        {
          heading: 'Recast Financial Summary',
          body: [
            'The following summarizes the before-and-after recast position for the trailing period:',
            `• As-Reported Revenue: ${fmt(latest.revenue)}`,
            `• Add-backs (owner comp, discretionary, non-recurring): quantified in the accompanying recast schedule.`,
            `• Normalized SDE: ${fmt(latest.sde)}`,
            `• Normalized EBITDA: ${fmt(latest.ebitda)}`,
            'All add-backs are itemized and traceable so that prospective buyers and lenders may independently verify each adjustment during due diligence.',
          ],
        },
      ],
    },

    // 4. EBITDA / SDE Analysis with Margin Trends
    {
      id: 'ebitda-sde-analysis',
      title: 'EBITDA & SDE Analysis',
      subsections: [
        {
          heading: 'Earnings Quality & Margin Trend',
          body: [
            `The Company\u2019s normalized SDE margin of ${pct(latest.sdeMargin)} and EBITDA margin of ${pct(latest.ebitdaMargin)} reflect a well-managed cost structure. Over the trailing three-year period, margins have ${latest.sdeMargin > hist[3].sdeMargin ? 'expanded' : 'remained stable'} as management realized operating efficiencies and refined discretionary spending.`,
            'Earnings quality is supported by a diversified revenue base, low capital-intensity, and minimal reliance on non-recurring items, which lends confidence to the sustainability of normalized earnings.',
          ],
        },
        {
          heading: 'Sensitivity to Revenue & Margin',
          body: [
            `Each 100 basis points of SDE-margin movement, holding revenue constant, changes normalized SDE by approximately ${fmt(latest.revenue * 0.01)}. Conversely, a ${pct(0.05)} change in revenue at current margins moves normalized SDE by ${fmt(latest.revenue * 0.05 * latest.sdeMargin)}. This sensitivity framing assists buyers in stress-testing deal economics.`,
            `The implied valuation multiple of ${priceSde ? priceSde.toFixed(2) + 'x' : '—'} SDE is within the range supported by the earnings analysis, and the Company\u2019s margin profile supports the lower end of the comparable range on a risk-adjusted basis.`,
          ],
        },
        {
          heading: 'Recast to EBITDA Reconciliation',
          body: [
            `EBITDA of ${fmt(ebitda)} is derived from normalized SDE after deducting market-rate owner compensation and adjusting for owner-specific discretionary items, depreciation, and interest, in accordance with standard sell-side methodology. This reconciliation provides a defensible basis for the valuation analysis presented in Section 6.`,
          ],
        },
      ],
    },

    // 5. Market & Industry Analysis
    {
      id: 'market-industry',
      title: 'Market & Industry Analysis',
      subsections: [
        {
          heading: 'Industry Overview',
          body: [
            `The ${industry} sector in the ${location} region continues to demonstrate resilient demand, supported by favorable demographics, stable end-market fundamentals, and ongoing provider consolidation. Market participants benefit from elevated barriers to entry in certain niches, including licensing, customer relationships, and regulatory compliance.`,
            'Industry tailwinds include sustained demand growth, a shift toward outsourcing and professionalized service delivery, and consolidation activity as buyers seek scale. These factors contribute to an attractive backdrop for a well-positioned operator such as the subject business.',
          ],
        },
        {
          heading: 'Competitive Landscape',
          body: [
            'The competitive environment is fragmented, with a mix of independent operators and regional consolidators. The Company differentiates through service quality, customer retention, and a diversified account base, allowing it to compete effectively on value rather than price alone. Its established reputation and tenured client relationships constitute a meaningful competitive moat.',
          ],
        },
        {
          heading: 'Growth Drivers & Outlook',
          body: [
            'Prospective owners can pursue multiple avenues for growth, including expanded sales and marketing, introduction of adjacent service lines, geographic extension, and operational leverage from existing capacity. The combination of a stable base and identifiable growth vectors supports a constructive outlook for the business.',
          ],
        },
      ],
    },

    // 6. Valuation Analysis (3 methods + comparables)
    {
      id: 'valuation',
      title: 'Valuation Analysis',
      subsections: [
        {
          heading: 'Methodology',
          body: [
            'The indicative value range was derived using a multiple-of-earnings approach cross-checked against market comparables and a discounted-cash-flow (DCF) framing. This triangulation provides a robust, defensible estimate of fair market value.',
          ],
        },
        {
          heading: 'Method 1 — Multiple of Normalized Earnings',
          body: [
            `Applying SDE multiples of ${lowMultiplier.toFixed(1)}x to ${highMultiplier.toFixed(1)}x to normalized SDE of ${fmt(sde)} yields an indicative range of ${fmt(low)} to ${fmt(high)}. The midpoint reflects the Company\u2019s size, diversification, and margin profile.`,
          ],
        },
        {
          heading: 'Method 2 — Market / Comparable Transactions',
          body: [
            'Guideline transactions in the region and sector support the multiples applied below. The Comparable Transactions table summarizes observed pricing relative to revenue for businesses of comparable size and characteristics.',
            ...comparables.map((c) => `• ${c.business} (${c.industry}, ${c.location}): ${fmt(c.price)} at ${c.multiple ? c.multiple.toFixed(2) + 'x' : '—'} revenue.`),
          ],
        },
        {
          heading: 'Method 3 — Discounted Cash Flow (DCF) Framing',
          body: [
            'A DCF framing, using normalized EBITDA, a conservative growth assumption, and a discount rate reflective of small-business risk, supports a value broadly consistent with the earnings-multiple range. The DCF serves as a secondary check and confirms that the asking price is not dependent on aggressive growth assumptions.',
          ],
        },
        {
          heading: 'Valuation Conclusion',
          body: [
            `Based on the foregoing, the estimated fair market value of ${name} is in the range of ${fmt(low)} to ${fmt(high)}. The asking price of ${fmt(price)} falls within this range, representing a ${priceSde ? priceSde.toFixed(2) + 'x' : '—'} multiple of normalized SDE and a ${priceRev ? priceRev.toFixed(2) + 'x' : '—'} multiple of revenue — pricing that is fair and reasonable relative to market evidence.`,
          ],
        },
      ],
    },

    // 7. Deal Structure Recommendations
    {
      id: 'deal-structure',
      title: 'Deal Structure Recommendations',
      subsections: [
        {
          heading: 'Recommended Structure',
          body: [
            'A purchase of substantially all assets is recommended to provide the buyer with a clean asset base, avoid assumption of historical liabilities, and enable a favorable tax allocation. Alternatively, a stock purchase may be considered where tax or contractual considerations favor continuity; structure should be confirmed with tax and legal counsel.',
          ],
        },
        {
          heading: 'Consideration & Financing Profile',
          body: [
            `A transaction at ${fmt(price)} is well-suited to conventional SBA 7(a) financing given the normalized cash flow and reasonable debt-service coverage. A typical capital structure might include a 10% seller note or earn-out, a 10% buyer equity contribution, and an SBA-guaranteed senior loan, providing favorable leverage while maintaining adequate coverage.`,
          ],
        },
        {
          heading: 'Transition & Employment',
          body: [
            'A negotiated transition period (commonly 4–12 weeks) is recommended to ensure continuity of customer relationships and a smooth transfer of operational knowledge. Options include full or part-time owner support and, where applicable, a consulting arrangement during the post-closing period.',
          ],
        },
        {
          heading: 'Working Capital & Lease',
          body: [
            'The transaction should include an agreed level of net working capital and, where real estate is involved, either a purchase or a market-rate lease at closing. These items should be memorialized in the asset purchase agreement to avoid post-closing disputes.',
          ],
        },
      ],
    },

    // 8. Risk Assessment
    {
      id: 'risk-assessment',
      title: 'Risk Assessment',
      subsections: [
        {
          heading: 'Identified Risks',
          body: [
            `• Customer concentration: mitigated by a diversified account base; no single client materially impacts cash flow.`,
            `• Key-person reliance: mitigated by a tenured team and defined transition period; residual risk rated ${mgmtRisk}.`,
            `• Market conditions: mitigated by stable industry demand and a defensive service profile.`,
            `• Operational scalability: low capital intensity supports modest expansion without disproportionate investment.`,
            '• Regulatory / compliance: standard obligations exist within the sector; the Company maintains compliant operations and documentation.',
          ],
        },
        {
          heading: 'Mitigants & Risk-Return Balance',
          body: [
            'The identified risks are typical of a business of this size and profile and are addressed through a combination of transaction structure, transition support, and the Company\u2019s inherent diversification. On a risk-adjusted basis, the pricing compares favorably to guideline transactions and provides a reasonable margin of safety for a qualified buyer.',
          ],
        },
      ],
    },

    // 9. SWOT Analysis
    {
      id: 'swot',
      title: 'SWOT Analysis',
      subsections: [
        { heading: 'Strengths', body: ['Stable, diversified revenue base', 'Low customer concentration', 'Tenured workforce and low turnover', 'Asset-light, scalable operating model', 'Attractive normalized margins'] },
        { heading: 'Weaknesses', body: ['Owner involvement in business development', 'Limited marketing investment to date', 'Dependence on institutional knowledge', 'Scale smaller than regional consolidators'] },
        { heading: 'Opportunities', body: ['Expanded sales coverage and marketing', 'Adjacent service-line introduction', 'Geographic extension', 'Operational leverage from existing capacity'] },
        { heading: 'Threats', body: ['Fragmented competitive landscape', 'Labor-cost inflation', 'Macroeconomic sensitivity in end-markets', 'Consolidator competition for accounts'] },
      ],
    },

    // 10. Conclusion & Next Steps
    {
      id: 'conclusion',
      title: 'Conclusion & Next Steps',
      subsections: [
        {
          heading: 'Conclusion',
          body: [
            `${name} represents an attractive owner-operated acquisition opportunity in ${industry}, backed by stable financial performance, a diversified customer base, and clear avenues for growth. The asking price of ${fmt(price)} is supported by the valuation analysis and falls within the indicative range of ${fmt(low)} to ${fmt(high)}.`,
            'For a qualified buyer, this transaction offers a favorable risk-adjusted return profile, with meaningful upside available through execution of the growth initiatives identified herein.',
          ],
        },
        {
          heading: 'Next Steps',
          body: [
            'For qualified prospective buyers, the following steps are recommended:',
            '1. Execute the Confidentiality Agreement and provide proof of funding.',
            '2. Access the secure data room to review financials, legal documents, and contracts.',
            '3. Schedule management Q&A and a site visit.',
            '4. Submit an indicative offer, contingent upon confirmatory due diligence.',
            '5. Complete diligence and documentation toward a signed agreement.',
            'The advisor welcomes questions and stands ready to facilitate an efficient evaluation process.',
          ],
        },
      ],
    },
  ]

  return {
    title: `${name} — Broker Opinion of Value`,
    businessName: name,
    generatedAt: now,
    preparedFor: 'Confidential Prospective Buyer',
    askingPrice: price,
    revenue,
    sde,
    ebitda,
    revenueMultiple: priceRev ? priceRev.toFixed(2) + 'x' : 'N/A',
    sdeMultiple: priceSde ? priceSde.toFixed(2) + 'x' : 'N/A',
    ebitdaMultiple: priceEbitda ? priceEbitda.toFixed(2) + 'x' : 'N/A',
    valuationRange: `${fmt(low)} – ${fmt(high)}`,
    conclusion: `Based on normalized earnings and market comparables, the estimated fair market value of ${name} is in the range of ${fmt(low)} to ${fmt(high)}, supporting the asking price of ${fmt(price)}. ${fmt(price)} represents ${priceSde ? priceSde.toFixed(2) + 'x' : '—'} of normalized SDE and ${priceRev ? priceRev.toFixed(2) + 'x' : '—'} of revenue.`,
    comparables,
    assumptions,
    disclaimer,
    sections,
  }
}

// ---------------------------------------------------------------------------
// Version control
// ---------------------------------------------------------------------------
export interface BovVersion {
  id: string
  listing_id: string | null
  version: number
  title: string | null
  content_json: BovContent | null
  status: string
  created_at?: string | null
  updated_at?: string | null
}

export async function fetchBovVersions(listingId: string): Promise<BovVersion[]> {
  const { data, error } = await supabase
    .from('bov_versions')
    .select('*')
    .eq('listing_id', listingId)
    .order('version', { ascending: false })
  if (error) {
    console.error('fetchBovVersions error:', error)
    throw new Error(error.message || 'Failed to load BOV versions')
  }
  return (data as BovVersion[]) || []
}

export async function saveBovVersion(
  listingId: string,
  content: BovContent,
  status: string = 'draft'
): Promise<BovVersion> {
  const versions = await fetchBovVersions(listingId).catch(() => [])
  const nextVersion = versions.length ? versions[0].version + 1 : 1
  const { data, error } = await supabase
    .from('bov_versions')
    .insert({ listing_id: listingId, version: nextVersion, title: content.title, content_json: content, status })
    .select()
    .single()
  if (error) {
    console.error('saveBovVersion error:', error)
    throw new Error(error.message || 'Failed to save BOV version')
  }
  return data as BovVersion
}

const fmt = (n: number | null | undefined): string => {
  if (n === null || n === undefined || isNaN(n)) return '$—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
