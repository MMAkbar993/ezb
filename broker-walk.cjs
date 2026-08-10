// Broker walk — executes each guided-workflow step for all listings, using the
// EXACT live column names discovered via probe-schema.cjs. Simulates the app's
// lib/workflow.ts calls (now schema-correct). Temp test driver (not committed to src).
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const raw = fs.readFileSync('.env.local', 'utf8')
const env = {}
for (const line of raw.split('\n')) { const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, '').replace(/^'|'$/g, '') }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const ADMIN = 'cc325fdd-480b-413d-98e7-2bfc82111c43'
let pass = 0, fail = 0
const ok = (label) => { pass++; console.log('  ✅', label) }
const bad = (label, e) => { fail++; console.log('  ❌', label, '—', (e && (e.message || JSON.stringify(e))) || '') }
const tryx = async (label, fn) => { try { const r = await fn(); if (r && r.error) throw r.error; ok(label); return r?.data } catch (e) { bad(label, e) } }

const R = require('crypto').randomBytes(2).toString('hex')

;(async () => {
  const { data: listings } = await sb.from('listings').select('id,business_name,industry,sde,ebitda,annual_revenue')
    .eq('agent_id', ADMIN).in('status', ['draft', 'active']).order('created_at', { ascending: false })
  const target = listings.filter(l => l.id !== 'bafda3e4-1910-46ef-862c-9470aa01633c')
  console.log(`\nWALKING ${target.length} listings\n`)

  for (const L of target) {
    console.log(`\n===== ${L.business_name} (${L.industry}) =====`)

    // STEP 1: legal docs (category + party_type)
    await tryx('Step1 upload listing_agreement', () => sb.from('listing_documents').insert({
      listing_id: L.id, category: 'listing_agreement', party_type: 'seller',
      file_name: `ListingAgreement-${R}.pdf`, file_url: `https://placehold.co/100x100?text=agr${R}`, status: 'pending',
    }))
    await tryx('Step1 upload nda', () => sb.from('listing_documents').insert({
      listing_id: L.id, category: 'nda', party_type: 'seller',
      file_name: `NDA-${R}.pdf`, file_url: `https://placehold.co/100x100?text=nda${R}`, status: 'pending',
    }))

    // STEP 2: financials (listing_financials)
    await tryx('Step2 save financials', () => sb.from('listing_financials').insert({
      listing_id: L.id,
      revenue: { y2023: L.annual_revenue * 0.9, y2024: L.annual_revenue, y2025: L.annual_revenue * 1.1 },
      sde: { y2024: L.sde }, ebitda: { y2024: L.ebitda },
      inventory_value: 50000, ffe_value: 120000, real_estate_value: null,
      total_assets: L.annual_revenue * 0.6, total_liabilities: L.annual_revenue * 0.2, net_worth: L.annual_revenue * 0.4,
      tax_returns: [`tax-${R}.pdf`], pnl_statements: [`pandl-${R}.xlsx`], balance_sheets: [`bs-${R}.xlsx`],
    }))

    // STEP 3: recast (listing_recasts)
    const recast = { listing_id: L.id, original_sde: L.sde, recasted_sde: Math.round(L.sde * 1.18), original_ebitda: L.ebitda, recasted_ebitda: Math.round(L.ebitda * 1.15), add_backs: [{ label: 'Owner salary', amount: 120000 }], adjustments: [], recasted_by: ADMIN, notes: 'Test recast' }
    await tryx('Step3 save recast', () => sb.from('listing_recasts').insert(recast))

    // STEP 4: BOV (bov_versions)
    const bov = await tryx('Step4 generate BOV', () => sb.from('bov_versions').insert({
      listing_id: L.id, version_number: 1, valuation_multiple: 3.0, valuation_amount: Math.round(L.sde * 3),
      content: { business_name: L.business_name, sde: L.sde, multiple: 3.0 }, status: 'draft', generated_by: ADMIN,
    }).select())

    // STEP 5: CIM (cim_versions)
    await tryx('Step5 generate CIM', () => sb.from('cim_versions').insert({
      listing_id: L.id, version_number: 1,
      content: { business_name: L.business_name, recasted_sde: recast.recasted_sde }, status: 'draft', generated_by: ADMIN,
    }))

    // STEP 6: BLI (bli_versions)
    await tryx('Step6 generate BLI', () => sb.from('bli_versions').insert({
      listing_id: L.id, version_number: 1,
      content: { business_name: L.business_name, asking_price: L.id }, status: 'draft', generated_by: ADMIN,
    }))

    // STEP 7: SBA (sba_qualifications)
    await tryx('Step7 SBA qualification', () => sb.from('sba_qualifications').insert({
      listing_id: L.id, is_sba_eligible: true, sba_notes: 'Qualifies for 7(a) — meets size + financial thresholds', is_optional: true,
    }))

    // STEP 8: list business (publish)
    await tryx('Step8 publish listing (active)', () => sb.from('listings').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', L.id))

    // STEP 9: buyers (buyer_lists + nda_requests)
    const buyer = await tryx('Step9 add buyer + NDA', async () => {
      const d = await sb.from('buyer_lists').insert({
        listing_id: L.id, buyer_name: `Buyer ${R}`, buyer_email: `buyer${R}@test.com`, buyer_phone: '555-888-9999',
        buyer_type: 'individual', nda_signed: false, financial_qualified: true, is_primary_buyer: true,
      }).select().single()
      if (d.error) throw d.error
      await sb.from('nda_requests').insert({ listing_id: L.id, buyer_id: d.data.id, status: 'sent' })
    })

    // STEP 10: closing (deal_agreements + deal_closing_details + deal_commissions)
    await tryx('Step10 record LOI', () => sb.from('deal_agreements').insert({
      listing_id: L.id, buyer_id: buyer && buyer[0] ? buyer[0].id : null, loi_signed_at: new Date().toISOString(), status: 'loi',
    }))
    await tryx('Step10 closing details', () => sb.from('deal_closing_details').insert({
      listing_id: L.id, closing_date: new Date().toISOString().slice(0, 10), final_purchase_price: Math.round(L.sde * 2.8),
      final_terms: 'Seller note 20%', closing_costs: 15000, net_proceeds: Math.round(L.sde * 2.8 - 15000), closed_by: ADMIN,
    }))
    await tryx('Step10 commission', () => sb.from('deal_commissions').insert({
      listing_id: L.id, agent_id: ADMIN, commission_percentage: 8, commission_amount: Math.round(L.sde * 2.8 * 0.08), paid_status: 'pending',
    }))
  }

  console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`)
})().catch(e => { console.error('FATAL', e.message); process.exit(1) })
