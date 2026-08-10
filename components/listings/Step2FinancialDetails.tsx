'use client'

import { useEffect, useState } from 'react'
import { StepShell, stepField, stepLabel, stepBtn } from '@/components/listings/StepShell'
import { saveFinancials, fetchFinancials, completeStep } from '@/lib/workflow'
import { updateListing, fetchListing } from '@/lib/listings'

// ---------------------------------------------------------------------------
// Step 2 — Financial Details (revenue, SDE, EBITDA, balance sheet inputs)
// ---------------------------------------------------------------------------

const empty = {
  annualRevenue: '', sde: '', ebitda: '', inventoryValue: '', ffeValue: '',
  realEstateValue: '', totalAssets: '', totalLiabilities: '', askingPrice: '',
}

export default function Step2FinancialDetails({ listingId, onNext }: { listingId: string; onNext: () => void }) {
  const [f, setF] = useState(empty)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    (async () => {
      const [fin, listing] = await Promise.all([fetchFinancials(listingId), fetchListing(listingId)])
      if (fin) {
        const s = (v: any) => (v === null || v === undefined || v === '' ? '' : String(v))
        setF({
          annualRevenue: s(fin.revenue?.annual ?? fin.revenue?.amount),
          sde: s(fin.sde?.amount),
          ebitda: s(fin.ebitda?.amount),
          inventoryValue: s(fin.inventory_value), ffeValue: s(fin.ffe_value),
          realEstateValue: s(fin.real_estate_value), totalAssets: s(fin.total_assets),
          totalLiabilities: s(fin.total_liabilities), askingPrice: '',
        })
      } else if (listing) {
        const s = (v: number | null | undefined) => (v == null ? '' : String(v))
        setF({ annualRevenue: s(listing.annual_revenue), sde: s(listing.sde), ebitda: s(listing.ebitda), askingPrice: s(listing.asking_price), inventoryValue: '', ffeValue: '', realEstateValue: '', totalAssets: '', totalLiabilities: '' })
      }
    })()
  }, [listingId])

  const num = (s: string) => (s ? Number(s) : undefined)
  const hasSde = num(f.sde) !== undefined && num(f.annualRevenue) !== undefined

  const save = async () => {
    setBusy(true)
    const fin = {
      revenue: { annual: num(f.annualRevenue), amount: num(f.annualRevenue) },
      sde: { amount: num(f.sde) },
      ebitda: { amount: num(f.ebitda) },
      inventory_value: num(f.inventoryValue), ffe_value: num(f.ffeValue), real_estate_value: num(f.realEstateValue),
      total_assets: num(f.totalAssets), total_liabilities: num(f.totalLiabilities),
    }
    await saveFinancials(listingId, fin)
    // Mirror key fields onto the listing row so dashboards/marketplace reflect them.
    await updateListing(listingId, {
      annual_revenue: num(f.annualRevenue), sde: num(f.sde), ebitda: num(f.ebitda),
      asking_price: num(f.askingPrice) as any, inventory_value: num(f.inventoryValue) as any, ffe_value: num(f.ffeValue) as any,
    }).catch(() => {})
    await completeStep(listingId, 2)
    setBusy(false)
    onNext()
  }

  const field = (key: keyof typeof empty, label: string, prefix = '$') => (
    <label style={stepLabel}>
      {label}
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 14 }}>{prefix}</span>
        <input type="number" value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} style={{ ...stepField, paddingLeft: 26 }} placeholder="0" />
      </div>
    </label>
  )

  return (
    <StepShell step={2} title="Financial Details" description="Enter the business's revenue, cash flow, and balance sheet figures. These drive the BOV and recast."
      status="draft" onNext={save} nextDisabled={!hasSde} nextLabel={busy ? 'Saving…' : 'Step 2 complete →'}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }} className="wf-grid-3">
        {field('annualRevenue', 'Annual Revenue', '$')}
        {field('sde', "SDE (Seller's Discretionary Earnings)", '$')}
        {field('ebitda', 'EBITDA', '$')}
        {field('askingPrice', 'Asking Price', '$')}
        {field('inventoryValue', 'Inventory Value', '$')}
        {field('ffeValue', 'FF&E Value', '$')}
      </div>
      <div style={{ margin: '8px 0 18px', fontSize: 12.5, color: 'var(--muted)' }}>Balance sheet (optional):</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }} className="wf-grid-3">
        {field('realEstateValue', 'Real Estate Value', '$')}
        {field('totalAssets', 'Total Assets', '$')}
        {field('totalLiabilities', 'Total Liabilities', '$')}
      </div>
    </StepShell>
  )
}
