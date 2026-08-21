import { jsPDF } from 'jspdf'
import { supabase } from '@/lib/supabase/client'
import type { Listing } from '@/lib/listings'

// ---------------------------------------------------------------------------
// BizBuySell must be entered MANUALLY (client's explicit instruction — no
// API integration). This builds a plain, printable "listing details" export
// a broker can use as a reference while typing the listing into BizBuySell
// by hand, plus the mark-as-uploaded tracking in lib/listings.ts's
// updateListing() against the new bizbuysell_uploaded* columns
// (sql/bizbuysell_manual_upload.sql). Deliberately separate from lib/bbs.ts
// (the existing simulated auto-sync/webhook system) — that system is left
// untouched.
// ---------------------------------------------------------------------------

export interface BizBuySellContactInfo {
  name: string | null
  email: string | null
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function yesNo(v: boolean | null | undefined): string {
  return v === true ? 'Yes' : v === false ? 'No' : '—'
}

export async function fetchListingContact(agentId: string | null): Promise<BizBuySellContactInfo> {
  if (!agentId) return { name: null, email: null }
  const { data } = await supabase.from('profiles').select('full_name, email').eq('id', agentId).maybeSingle()
  return { name: data?.full_name || null, email: data?.email || null }
}

export function buildBizBuySellRows(listing: Listing, contact?: BizBuySellContactInfo): { section: string; rows: [string, string][] }[] {
  return [
    {
      section: 'Business Overview',
      rows: [
        ['Business Name', listing.business_name || '—'],
        ['Headline', listing.headline || '—'],
        ['Industry / Category', listing.business_type || listing.industry || '—'],
        ['Sub-Category', listing.sub_industry || '—'],
        ['Location', listing.location_general || '—'],
        ['Year Established', listing.year_established ? String(listing.year_established) : '—'],
        ['Description', listing.description || '—'],
        ['Reason for Sale', listing.reason_for_sale || '—'],
      ],
    },
    {
      section: 'Financials',
      rows: [
        ['Asking Price', fmt(listing.asking_price)],
        ['Annual Revenue (Gross)', fmt(listing.annual_revenue)],
        ["Cash Flow / SDE", fmt(listing.sde)],
        ['EBITDA', fmt(listing.ebitda)],
        ['Inventory Value (included)', fmt(listing.inventory_value)],
        ['FF&E Value', fmt(listing.ffe_value)],
      ],
    },
    {
      section: 'Operations',
      rows: [
        ['Employees (Full-Time)', listing.num_employees_ft != null ? String(listing.num_employees_ft) : '—'],
        ['Employees (Part-Time)', listing.num_employees_pt != null ? String(listing.num_employees_pt) : '—'],
        ['Contractors', listing.num_employees_contractor != null ? String(listing.num_employees_contractor) : '—'],
        ['Total Employees', listing.num_employees != null ? String(listing.num_employees) : '—'],
        ['Hours of Operation', listing.hours_of_operation || '—'],
        ['Facility Size (sq ft)', listing.business_square_footage != null ? String(listing.business_square_footage) : '—'],
        ['Lease Years Remaining', listing.lease_years_remaining != null ? String(listing.lease_years_remaining) : '—'],
        ['Monthly Rent', listing.monthly_rent != null ? fmt(listing.monthly_rent) : '—'],
      ],
    },
    {
      section: 'Business Is Currently',
      rows: [
        ['Absentee Owned', yesNo(listing.is_absentee_owner)],
        ['Relocatable', yesNo(listing.is_relocatable)],
        ['Home Based', yesNo(listing.is_home_based)],
        ['Franchise', yesNo(listing.is_franchise)],
        ['Real Estate Included', yesNo(listing.real_estate_included)],
        ['Inventory Included in Price', yesNo(listing.inventory_included)],
        ['FF&E Included in Price', yesNo(listing.furniture_and_equipment_included)],
      ],
    },
    {
      section: 'Growth & Market',
      rows: [
        ['Growth Potential', listing.growth_potential || '—'],
        ['Competition', listing.competition || '—'],
        ['Market Position', listing.market_position || '—'],
      ],
    },
    {
      section: 'Listing Contact (for the BizBuySell account, not shown to buyers on the CRM)',
      rows: [
        ['Contact Name', contact?.name || '—'],
        ['Contact Email', contact?.email || '—'],
      ],
    },
  ]
}

export function exportBizBuySellPdf(listing: Listing, contact?: BizBuySellContactInfo, opts?: { returnBytes?: boolean }): Uint8Array | void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 48
  let y = 60

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(20, 41, 79)
  doc.text('BizBuySell Listing Details', M, y)
  y += 18
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(120, 120, 120)
  doc.text(`For manual entry into BizBuySell · Generated ${new Date().toLocaleDateString('en-US')}`, M, y)
  y += 24

  const sections = buildBizBuySellRows(listing, contact)
  for (const { section, rows } of sections) {
    if (y > H - 90) { doc.addPage(); y = 60 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12.5)
    doc.setTextColor(20, 41, 79)
    doc.text(section, M, y)
    y += 8
    doc.setDrawColor(201, 168, 76)
    doc.setLineWidth(1)
    doc.line(M, y, W - M, y)
    y += 16

    for (const [label, value] of rows) {
      if (y > H - 60) { doc.addPage(); y = 60 }
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(60, 60, 60)
      doc.text(label, M, y)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(30, 30, 30)
      const wrapped = doc.splitTextToSize(value, W - M * 2 - 200) as string[]
      doc.text(wrapped, M + 200, y)
      y += Math.max(16, wrapped.length * 13)
    }
    y += 10
  }

  if (opts?.returnBytes) {
    return new Uint8Array(doc.output('arraybuffer'))
  }
  doc.save(`${(listing.business_name || 'listing').replace(/[^a-z0-9]+/gi, '_')}_BizBuySell_Details.pdf`)
}
