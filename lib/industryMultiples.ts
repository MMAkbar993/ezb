// =============================================================================
// lib/industryMultiples.ts — broker-grade SDE/EBITDA valuation multiple
// ranges by industry. Replaces the flat 2.5x–4.0x range previously applied
// to every listing regardless of industry (e.g. Home Care listings, which
// typically trade at a higher multiple than a flat main-street average).
// -----------------------------------------------------------------------------
// These are representative market ranges brokers commonly cite, not an
// appraisal — same caveat the BOV disclaimer already carries. No directive
// (used by both client components and server-only PDF/extraction code).
// =============================================================================

export interface MultipleRange {
  low: number
  high: number
}

const DEFAULT_RANGE: MultipleRange = { low: 2.5, high: 4.0 }

// Keys are matched case-insensitively against listing.industry / business_type
// after stripping non-letters, so "Home Care", "HomeCare", and "home-care"
// all resolve to the same entry.
const INDUSTRY_MULTIPLES: Record<string, MultipleRange> = {
  homecare: { low: 3.0, high: 5.0 },
  homehealth: { low: 3.0, high: 5.0 },
  healthcareservices: { low: 4.0, high: 6.0 },
  medical: { low: 4.0, high: 6.0 },
  dental: { low: 4.5, high: 6.5 },
  itservices: { low: 3.5, high: 5.5 },
  technology: { low: 3.5, high: 5.5 },
  // Blueprint-sourced (client-provided industry heuristics, 2026-08-15):
  // "Technology / SaaS: 4.0x-8.0x+ EBITDA" — kept distinct from the more
  // conservative general itservices/technology entries above, since a
  // recurring-revenue SaaS business commands a real premium over a general
  // IT shop.
  saas: { low: 4.0, high: 8.0 },
  softwareasaservice: { low: 4.0, high: 8.0 },
  softwareit: { low: 4.0, high: 6.5 },
  businessservices: { low: 2.0, high: 3.5 },
  // Blueprint: "B2B Services: 2.0x-3.5x SDE"
  b2bservices: { low: 2.0, high: 3.5 },
  professionalservices: { low: 2.5, high: 4.0 },
  accounting: { low: 2.5, high: 4.0 },
  // Blueprint: "Food & Beverage / Restaurants: 1.5x-2.5x SDE"
  restaurant: { low: 1.5, high: 2.5 },
  foodbeverage: { low: 1.5, high: 2.5 },
  retail: { low: 2.0, high: 3.0 },
  ecommerce: { low: 3.0, high: 4.5 },
  // Blueprint: "Light Manufacturing & Distribution: 3.0x-5.0x EBITDA"
  manufacturing: { low: 3.0, high: 5.0 },
  distributionwholesale: { low: 3.0, high: 5.0 },
  construction: { low: 2.5, high: 4.0 },
  hvac: { low: 3.0, high: 4.5 },
  landscaping: { low: 2.5, high: 4.0 },
  autorepair: { low: 2.0, high: 3.0 },
  automotive: { low: 2.0, high: 3.5 },
  transportationlogistics: { low: 2.5, high: 4.0 },
  cleaningjanitorial: { low: 2.5, high: 4.0 },
  childcare: { low: 2.5, high: 4.0 },
  fitness: { low: 2.0, high: 3.5 },
  salonbeauty: { low: 2.0, high: 3.0 },
  realestateservices: { low: 2.5, high: 4.0 },
  insurance: { low: 3.5, high: 5.5 },
  // Blueprint: "Gas Stations / Convenience: 2.0x-3.0x SDE / up to 3.0x EBITDA"
  gasstation: { low: 2.0, high: 3.0 },
  convenience: { low: 2.0, high: 3.0 },
  gasstationconvenience: { low: 2.0, high: 3.0 },
  // Blueprint: "Liquor Stores: 2.5x-4.0x SDE"
  liquorstore: { low: 2.5, high: 4.0 },
  liquorstores: { low: 2.5, high: 4.0 },
}

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, '')
}

/** Resolves the SDE/EBITDA multiple range for an industry string, falling
 * back to the broker-standard main-street default when there's no match or
 * no industry set. Matching is loose (case/space/punctuation-insensitive,
 * substring match) since `industry`/`business_type` are free-text fields. */
export function getIndustryMultiple(industry: string | null | undefined): MultipleRange {
  if (!industry) return DEFAULT_RANGE
  const key = normalizeKey(industry)
  if (INDUSTRY_MULTIPLES[key]) return INDUSTRY_MULTIPLES[key]
  const match = Object.keys(INDUSTRY_MULTIPLES).find((k) => key.includes(k) || k.includes(key))
  return match ? INDUSTRY_MULTIPLES[match] : DEFAULT_RANGE
}

/** Convenience: the midpoint, used wherever a single point-multiple (not a
 * range) is needed, e.g. a headline valuation number. */
export function getIndustryMidMultiple(industry: string | null | undefined): number {
  const { low, high } = getIndustryMultiple(industry)
  return Math.round(((low + high) / 2) * 10) / 10
}
