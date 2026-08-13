// =============================================================================
// lib/bli.ts — BLI (Business Listing Information) generator.
// -----------------------------------------------------------------------------
// A single-page executive summary of a business offered for sale: key metrics,
// investment highlights, offering snapshot. Modeled on the same content shape
// used across the platform ({ id, title, subsections: [{ heading, body[] }] })
// so the PDF renderer and the on-screen view can process it cleanly.
// =============================================================================

import type { Listing } from '@/lib/listings'
import { computeFinancialMetrics, type FinancialMetrics } from '@/lib/financialExtractor'

export interface BliSection {
  id: string
  title: string
  subsections: { heading?: string; body: string[] }[]
}

export interface BliContent {
  title: string
  businessName: string
  headline: string | null
  location: string | null
  industry: string | null
  askingPrice: number
  metrics: FinancialMetrics
  generatedAt: string
  sections: BliSection[]
}

const fmt = (n: number | null | undefined): string => {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function multi(n: number | null): string {
  return n === null || isNaN(n) ? '—' : n.toFixed(1) + 'x'
}

export function generateBliContent(listing: Listing): BliContent {
  const metrics = computeFinancialMetrics(listing)
  const now = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  // BLI-only anonymization: show the confidential headline instead of the
  // real trade name when the broker has flagged this listing that way (e.g.
  // "Non-skilled home care for sale" rather than the actual business name).
  // Never affects CIM/BOV — those only go to NDA'd, qualified buyers.
  const name = listing.bli_anonymize
    ? (listing.headline || `${listing.industry || 'Business'} for sale`)
    : (listing.business_name || 'This business')

  const sections: BliSection[] = [
    { id: 'snapshot', title: 'Offer Snapshot', subsections: [
      { heading: 'At a glance', body: [
        `${name}${listing.industry ? ` (${listing.industry})` : ''}${listing.location_general ? ` is located in ${listing.location_general}` : ''}.`,
        `Offered at ${fmt(listing.asking_price)}.`,
      ]},
    ]},
    { id: 'key-metrics', title: 'Key Metrics', subsections: [
      { heading: 'Financial snapshot', body: [
        `Annual Revenue: ${fmt(metrics.revenue)}`,
        `Seller's Discretionary Earnings (SDE): ${fmt(metrics.sde)}`,
        `EBITDA: ${fmt(metrics.ebitda)}`,
        `Gross Margin: ${metrics.grossMargin === null ? '—' : (metrics.grossMargin * 100).toFixed(0) + '%'}`,
        `SDE Margin: ${metrics.sdeMargin === null ? '—' : (metrics.sdeMargin * 100).toFixed(0) + '%'}`,
        `Price / Revenue: ${multi(metrics.priceToRevenue)}`,
        `Price / SDE: ${multi(metrics.priceToSde)}`,
        `Price / EBITDA: ${multi(metrics.priceToEbitda)}`,
        `Indicative value range: ${fmt(metrics.valueRangeLow)} – ${fmt(metrics.valueRangeHigh)}`,
      ]},
    ]},
    { id: 'investment-highlights', title: 'Investment Highlights', subsections: [
      { heading: 'Why invest', body: [
        listing.description ? listing.description.split(/(?<=[.!?])\s+/).slice(0, 4).join(' ') : `${name} represents a compelling acquisition opportunity in the ${listing.industry || 'business services'} sector.`,
        `Diversified revenue, established operations, and normalized earnings of ${fmt(metrics.sde)} (SDE) position this as a turnkey acquisition.`,
      ]},
    ]},
  ]

  return {
    title: 'Business Listing Information',
    businessName: name,
    headline: listing.headline,
    location: listing.location_general,
    industry: listing.industry,
    askingPrice: listing.asking_price || 0,
    metrics,
    generatedAt: now,
    sections,
  }
}
