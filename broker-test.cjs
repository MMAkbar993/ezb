// Broker CRM end-to-end test harness (service role). Mirrors the exact
// Supabase calls the app's lib/ functions make, so we test real schema + data.
// Run: node broker-test.cjs <subcommand>
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const raw = fs.readFileSync('.env.local', 'utf8')
const env = {}
for (const line of raw.split('\n')) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '').replace(/^'|'$/g, '')
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const ADMIN = 'cc325fdd-480b-413d-98e7-2bfc82111c43'

const log = (s) => console.log(s)
const res = (label, r) => log(`${label}: ${r.error ? 'ERR ' + r.error.message : 'OK ' + JSON.stringify((r.data||[]).length !== undefined ? r.data.length + ' rows' : r.data)}`)

const R = require('crypto').randomBytes(3).toString('hex')

async function main() {
  const cmd = process.argv[2]
  const IN = {
    mfg: { name: `Precision Manufacturing ${R}`, industry: 'Manufacturing', loc: 'Reading, PA', price: 3250000, rev: 4200000, sde: 980000, ebitda: 860000 },
    retail: { name: `Main Street Retail ${R}`, industry: 'Retail', loc: 'Lancaster, PA', price: 450000, rev: 720000, sde: 175000, ebitda: 148000 },
    health: { name: `Home Health Services ${R}`, industry: 'Healthcare', loc: 'Philadelphia, PA', price: 1850000, rev: 2600000, sde: 610000, ebitda: 520000 },
    tech: { name: `CloudSoft IT ${R}`, industry: 'Technology', loc: 'Pittsburgh, PA', price: 4900000, rev: 7800000, sde: 1400000, ebitda: 1280000 },
    svc: { name: `Summit Consulting ${R}`, industry: 'Professional Services', loc: 'Harrisburg, PA', price: 890000, rev: 1150000, sde: 320000, ebitda: 275000 },
  }

  if (cmd === 'create-listings') {
    for (const [k, v] of Object.entries(IN)) {
      const { data, error } = await sb.from('listings').insert({
        agent_id: ADMIN, business_name: v.name, headline: `Confidential — ${v.name}`,
        industry: v.industry, location_general: v.loc, description: `${v.industry} business for sale in ${v.loc}.`,
        asking_price: v.price, annual_revenue: v.rev, sde: v.sde, ebitda: v.ebitda,
        status: 'draft',
      }).select()
      res(`listings.${k}`, { error, data })
    }
    // list all created
    const { data } = await sb.from('listings').select('id,business_name,status,industry,asking_price,sde,ebitda').eq('agent_id', ADMIN)
    console.log('\nALL LISTINGS FOR BROKER:'); for (const l of data||[]) console.log(`  ${l.id} | ${l.business_name} | ${l.industry} | $${l.asking_price} | ${l.status}`)
  }

  else if (cmd === 'ls') {
    const { data } = await sb.from('listings').select('id,business_name,status,industry,asking_price,sde,ebitda').order('created_at',{ascending:false}).limit(15)
    console.log('LISTINGS:'); for (const l of data||[]) console.log(`  ${l.id} | ${l.business_name} | ${l.industry} | $${l.asking_price} | ${l.status}`)
  }
  else if (cmd === 'workflows') {
    const lst = await sb.from('listings').select('id').in('status',['draft','active'])
    for (const l of (lst.data||[]).slice(0,10)) {
      const { data, error } = await sb.from('listing_workflows').select('*').eq('listing_id',l.id).maybeSingle()
      console.log(`workflow ${l.id}: ${error?('ERR '+error.message):JSON.stringify({step:data?.current_step, completed:data?.completed_steps})}`)
    }
  }
  else if (cmd === 'deal') {
    // create a deal + walk stages for a listing
    const lst = await sb.from('listings').select('id,business_name').eq('agent_id',ADMIN).order('created_at',{ascending:false}).limit(1)
    const listing = (lst.data||[])[0]
    if (!listing) return log('no listing')
    const { data: deal, error: e1 } = await sb.from('deals').insert({ listing_id: listing.id, status: 'loi', purchase_price: 2500000 }).select().single()
    res('create deal', { error: e1, data: deal })
    if (e1) return
    for (const stage of ['under_contract','due_diligence','closing','closed']) {
      const { error } = await sb.from('deals').update({ status: stage, updated_at: new Date().toISOString() }).eq('id', deal.id)
      res(`move->${stage}`, { error, data: deal.id })
    }
    // commission
    const { error: ec } = await sb.from('deal_commissions').insert({ deal_id: deal.id, listing_id: listing.id, commission_percentage: 8, commission_amount: 200000 }).select()
    res('commission insert', { error: ec, data: null })
  }
  else if (cmd === 'leads') {
    // buyer lead
    const { data: bl, error: eb } = await sb.from('buyer_leads').insert({
      full_name: `Test Buyer ${R}`, email: `buyer${R}@test.com`, phone: '555-000-1111',
      budget_range: '$1M - $5M', industries_interest: 'Manufacturing, Technology',
      status: 'new', contact_name: `Test Buyer ${R}`,
    }).select()
    res('buyer lead insert', { error: eb, data: bl })
    // seller lead
    const { data: sl, error: es } = await sb.from('seller_leads').insert({
      full_name: `Test Seller ${R}`, email: `seller${R}@test.com`, phone: '555-222-3333',
      business_name: `Seller Biz ${R}`, industry: 'Retail',
      revenue_range: '$500K - $1M', timeframe: '3-6 months', message: 'Looking to sell retail business.',
      status: 'new', contact_name: `Test Seller ${R}`,
    }).select()
    res('seller lead insert', { error: es, data: sl })
  }
  else if (cmd === 'leads-act') {
    // test lead_activities (table may be missing)
    const { data: sl } = await sb.from('seller_leads').select('id').order('created_at',{ascending:false}).limit(1)
    const lid = (sl?.data || sl || [])[0]?.id
    console.log('lead id =', lid)
    if (!lid) return log('no lead')
    const { error } = await sb.from('lead_activities').insert({ lead_id: lid, type: 'note', description: `Test note ${R}` })
    res('lead_activity insert', { error, data: null })
  }
  else if (cmd === 'doc') {
    // listing_documents + deal_documents
    const lst = await sb.from('listings').select('id').eq('agent_id',ADMIN).order('created_at',{ascending:false}).limit(1)
    const listing = (lst.data||[])[0]
    const { error: e1 } = await sb.from('listing_documents').insert({
      listing_id: listing.id, file_url: `https://placehold.co/100x100?text=test${R}`, category: 'NDA', status: 'active',
    })
    res('listing_document insert', { error: e1, data: null })
    const { data: deal } = await sb.from('deals').select('id,listing_id').eq('listing_id',listing.id).order('created_at',{ascending:false}).limit(1)
    const d = (deal||[])[0]
    const { error: e2 } = await sb.from('deal_documents').insert({
      deal_id: d?.id, file_name: `deal-doc-${R}.pdf`, file_url: `https://placehold.co/100x100?text=deal${R}`, uploaded_by: ADMIN,
    })
    res('deal_document insert', { error: e2, data: null })
  }
  else if (cmd === 'financial') {
    // broker_financial_files (old) + financial_documents (new, may be missing)
    const lst = await sb.from('listings').select('id').eq('agent_id',ADMIN).order('created_at',{ascending:false}).limit(1)
    const listing = (lst.data||[])[0]
    const { error: e1 } = await sb.from('broker_financial_files').insert({
      listing_id: listing.id, file_name: `tax-return-${R}.pdf`, file_url: `https://placehold.co`, file_type: 'tax_return', uploaded_by: ADMIN,
    })
    res('broker_financial_files insert', { error: e1, data: null })
    const { error: e2 } = await sb.from('financial_documents').insert({
      listing_id: listing.id, file_name: `pandl-${R}.xlsx`, file_url: 'https://placehold.co',
      storage_path: `financial-files/${listing.id}/pandl-${R}.xlsx`, file_size: 1024, mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      file_kind: 'excel', category: 'financial_statement', status: 'pending', uploaded_by: ADMIN,
    })
    res('financial_documents insert', { error: e2, data: null })
  }
  else if (cmd === 'versions') {
    // BOV/CIM/BLI version tables
    const lst = await sb.from('listings').select('id').eq('agent_id',ADMIN).order('created_at',{ascending:false}).limit(1)
    const listing = (lst.data||[])[0]
    for (const t of ['bov_versions','cim_versions','bli_versions']) {
      const extra = t === 'bov_versions' ? { valuation_multiple: 3, valuation_amount: 1000000 } : {}
      const { error } = await sb.from(t).insert({ listing_id: listing.id, version_number: 1, status: 'draft', title: `Test ${t}`, ...extra })
      res(`${t} insert`, { error, data: null })
    }
  }
  else if (cmd === 'sba') {
    const lst = await sb.from('listings').select('id').eq('agent_id',ADMIN).order('created_at',{ascending:false}).limit(1)
    const listing = (lst.data||[])[0]
    const { error } = await sb.from('sba_qualifications').insert({ listing_id: listing.id, is_sba_eligible: true, sba_notes: 'Eligible for 7(a)', is_optional: true })
    res('sba_qualifications insert', { error, data: null })
  }
  else {
    console.log('unknown cmd')
  }
}
main()
