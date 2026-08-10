-- =============================================================================
-- Concord Deal Platform — Seed Data
-- Run this AFTER the schema migrations (full_schema.sql, create_activity_tables.sql,
-- phase2_schema.sql) and after creating the storage buckets.
--
-- Populates the platform with realistic sample data so the Dashboard, Deal
-- Pipeline, Leads, Documents, and Due Diligence pages all render real rows:
--   1 listing (reuses the existing 'Ez Business Advisory - Deal 1' row)
--   5 deals across all pipeline stages
--   6 seller leads + 6 buyer leads with varied statuses
--   lead activities/notes
--   due diligence checklist items
--   deal documents + listing documents
--
-- SAFE TO RE-RUN: every insert is wrapped in an idempotency guard keyed on a
-- sentinel value (e.g. a fixed email / unique title), so running it twice will
-- not create duplicate rows.
-- =============================================================================

-- =============================================================================
-- 0. Ensure the listing exists (idempotent — references the catalog listing).
--    Uses the real row already in the listings table.
-- =============================================================================
insert into public.listings (
  agent_id, business_name, headline, industry, location_general, description,
  asking_price, annual_revenue, sde, ebitda, real_estate_included, status,
  primary_image_url, image_urls
)
select
  coalesce(
    (select agent_id from public.listings where business_name = 'Ez Business Advisory - Deal 1' limit 1),
    (select id from public.profiles limit 1)
  ),
  'Ez Business Advisory - Deal 1',
  'Confidential — Premier Business Advisory Firm',
  'Business Services',
  'Remote/Nationwide',
  'Well-established business advisory firm with 50+ active clients and $2.5M+ annual revenue. Specializes in M&A advisory and business valuations.',
  2500000, 1500000, 850000, 750000, false, 'active',
  'https://placehold.co/600x400/22c55e/ffffff?text=Test+Image',
  array[
    'https://placehold.co/600x400/1e293b/ffffff?text=Business+Listing',
    'https://placehold.co/600x400/1e293b/ffffff?text=Operations',
    'https://placehold.co/600x400/1e293b/ffffff?text=Financials'
  ]
where not exists (
  select 1 from public.listings where business_name = 'Ez Business Advisory - Deal 1'
);

-- Second sample listing for pipeline variety (single-broker demo).
insert into public.listings (
  agent_id, business_name, headline, industry, location_general, description,
  asking_price, annual_revenue, sde, ebitda, real_estate_included, status,
  primary_image_url
)
select
  coalesce(
    (select agent_id from public.listings where business_name = 'Ez Business Advisory - Deal 1' limit 1),
    (select id from public.profiles limit 1),
    '00000000-0000-0000-0000-000000000000'
  ),
  'Summit Logistics — Regional Freight & Distribution',
  'Profitable regional 3PL with long-term client contracts',
  'Logistics',
  'Charlotte, NC',
  'Regional third-party logistics provider with $3.1M revenue, 85% recurring contracted revenue, and a 6-year operating history.',
  2900000, 3100000, 720000, 610000, false, 'active',
  'https://placehold.co/600x400/1e293b/ffffff?text=Summit+Logistics'
where not exists (
  select 1 from public.listings where business_name = 'Summit Logistics — Regional Freight & Distribution'
);

-- =============================================================================
-- 1. Deals across all 5 pipeline stages
--    Stage values (deals.status): loi | under_contract | due_diligence | closing | closed
--    A CTE captures each generated id for later reference.
-- =============================================================================
with final_deal as (
  insert into public.deals (listing_id, status, purchase_price)
  select id, 'closed', 2350000
  from public.listings where business_name = 'Ez Business Advisory - Deal 1'
  where not exists (select 1 from public.deals where status = 'closed')
  returning id
)
select 'deal:closed' as marker, id from final_deal;

with closing_deal as (
  insert into public.deals (listing_id, status, purchase_price)
  select id, 'closing', 2450000
  from public.listings where business_name = 'Ez Business Advisory - Deal 1'
  where not exists (select 1 from public.deals where status = 'closing')
  returning id
),
dd_deal as (
  insert into public.deals (listing_id, status, purchase_price)
  select id, 'due_diligence', 2500000
  from public.listings where business_name = 'Ez Business Advisory - Deal 1'
  where not exists (select 1 from public.deals where status = 'due_diligence')
  returning id
),
uc_deal as (
  insert into public.deals (listing_id, status, purchase_price)
  select id, 'under_contract', 2150000
  from public.listings where business_name = 'Summit Logistics — Regional Freight & Distribution'
  where not exists (select 1 from public.deals where status = 'under_contract')
  returning id
),
loi_deal as (
  insert into public.deals (listing_id, status, purchase_price)
  select id, 'loi', 2600000
  from public.listings where business_name = 'Ez Business Advisory - Deal 1'
  where not exists (select 1 from public.deals where status = 'loi')
  returning id
)
select 'deal:multi' as marker, id from loi_deal;

-- =============================================================================
-- 2. Seller leads (with realistic statuses)
-- =============================================================================
insert into public.seller_leads (business_name, email, phone, status)
select 'Carolina Manufacturing Co.', 'owner@carolinamfg.com', '+1 704-555-0142', 'qualified'
where not exists (select 1 from public.seller_leads where email = 'owner@carolinamfg.com');

insert into public.seller_leads (business_name, email, phone, status)
select 'Blue Ridge Dental Studio', 'dr.reed@blueridgedental.com', '+1 828-555-0193', 'handed_off'
where not exists (select 1 from public.seller_leads where email = 'dr.reed@blueridgedental.com');

insert into public.seller_leads (business_name, email, phone, status)
select 'Piedmont Landscaping Group', 'info@piedmontlandscape.com', '+1 704-555-0117', 'qualifying'
where not exists (select 1 from public.seller_leads where email = 'info@piedmontlandscape.com');

insert into public.seller_leads (business_name, email, phone, status)
select 'Harbor Cafe & Bakery', 'gm@harborcafe.com', '+1 843-555-0161', 'new'
where not exists (select 1 from public.seller_leads where email = 'gm@harborcafe.com');

insert into public.seller_leads (business_name, email, phone, status)
select 'Triangle IT Services', 'founder@triangleit.com', '+1 919-555-0128', 'qualified'
where not exists (select 1 from public.seller_leads where email = 'founder@triangleit.com');

insert into public.seller_leads (business_name, email, phone, status)
select 'Greenfield Auto Detailing', 'owner@greenfielddetail.com', '+1 704-555-0176', 'handed_off'
where not exists (select 1 from public.seller_leads where email = 'owner@greenfielddetail.com');

-- =============================================================================
-- 3. Buyer leads (varied statuses)
-- =============================================================================
insert into public.buyer_leads (email, phone, status)
select 'acquisitions@northstar-cap.com', '+1 212-555-0133', 'qualified'
where not exists (select 1 from public.buyer_leads where email = 'acquisitions@northstar-cap.com');

insert into public.buyer_leads (email, phone, status)
select 'mgruber@midtown-private.com', '+1 646-555-0109', 'qualifying'
where not exists (select 1 from public.buyer_leads where email = 'mgruber@midtown-private.com');

insert into public.buyer_leads (email, phone, status)
select 'search@apexfamilyoffice.com', '+1 415-555-0188', 'new'
where not exists (select 1 from public.buyer_leads where email = 'search@apexfamilyoffice.com');

insert into public.buyer_leads (email, phone, status)
select 'j.doe@frederickson-group.com', '+1 312-555-0151', 'handed_off'
where not exists (select 1 from public.buyer_leads where email = 'j.doe@frederickson-group.com');

insert into public.buyer_leads (email, phone, status)
select 'buyer@relaycapital.com', '+1 305-555-0147', 'not_a_fit'
where not exists (select 1 from public.buyer_leads where email = 'buyer@relaycapital.com');

insert into public.buyer_leads (email, phone, status)
select 't.brooks@bluepeak-acquires.com', '+1 917-555-0199', 'qualified'
where not exists (select 1 from public.buyer_leads where email = 't.brooks@bluepeak-acquires.com');

-- =============================================================================
-- 4. Activities & notes linked to leads
--    Requires lead_activities table (create_activity_tables.sql).
-- =============================================================================
insert into public.lead_activities (lead_id, type, description)
select sl.id, 'call', 'Intro call with owner. Business doing $1.4M revenue, owner wants to transition in 12-18 months.'
from public.seller_leads sl where sl.email = 'owner@carolinamfg.com'
and not exists (
  select 1 from public.lead_activities a join public.seller_leads s on a.lead_id = s.id
  where s.email = 'owner@carolinamfg.com' and a.type = 'call'
);

insert into public.lead_activities (lead_id, type, description)
select sl.id, 'email', 'Sent confidentiality agreement and preliminary questionnaire.'
from public.seller_leads sl where sl.email = 'owner@carolinamfg.com'
and not exists (
  select 1 from public.lead_activities a join public.seller_leads s on a.lead_id = s.id
  where s.email = 'owner@carolinamfg.com' and a.type = 'email' and a.description like 'Sent confidentiality%'
);

insert into public.lead_activities (lead_id, type, description)
select sl.id, 'meeting', 'In-person walkthrough at facility in Concord, NC. Equipment well-maintained, staff of 22.'
from public.seller_leads sl where sl.email = 'owner@carolinamfg.com'
and not exists (
  select 1 from public.lead_activities a join public.seller_leads s on a.lead_id = s.id
  where s.email = 'owner@carolinamfg.com' and a.type = 'meeting'
);

insert into public.lead_activities (lead_id, type, description)
select sl.id, 'note', 'Owner asking $2.1M. Facility has 5-year lease renewal option. EBITDA ~$410K.'
from public.seller_leads sl where sl.email = 'dr.reed@blueridgedental.com'
and not exists (
  select 1 from public.lead_activities a join public.seller_leads s on a.lead_id = s.id
  where s.email = 'dr.reed@blueridgedental.com' and a.type = 'note'
);

insert into public.lead_activities (lead_id, type, description)
select sl.id, 'call', 'Initial discovery. Requested financials last 3 years. Following up next week.'
from public.seller_leads sl where sl.email = 'info@piedmontlandscape.com'
and not exists (
  select 1 from public.lead_activities a join public.seller_leads s on a.lead_id = s.id
  where s.email = 'info@piedmontlandscape.com' and a.type = 'call'
);

insert into public.lead_activities (lead_id, type, description)
select bl.id, 'note', 'Signed NDA. Looking for businesses $2-4M in professional services or healthcare.'
from public.buyer_leads bl where bl.email = 'acquisitions@northstar-cap.com'
and not exists (
  select 1 from public.lead_activities a join public.buyer_leads b on a.lead_id = b.id
  where b.email = 'acquisitions@northstar-cap.com' and a.type = 'note'
);

insert into public.lead_activities (lead_id, type, description)
select bl.id, 'email', 'Shared the Ez Business Advisory teaser. Awaiting indication of interest.'
from public.buyer_leads bl where bl.email = 'acquisitions@northstar-cap.com'
and not exists (
  select 1 from public.lead_activities a join public.buyer_leads b on a.lead_id = b.id
  where b.email = 'acquisitions@northstar-cap.com' and a.type = 'email'
);

insert into public.lead_activities (lead_id, type, description)
select bl.id, 'call', 'Buyer interested in logistics. Sent deal summary for Summit Logistics.'
from public.buyer_leads bl where bl.email = 'mgruber@midtown-private.com'
and not exists (
  select 1 from public.lead_activities a join public.buyer_leads b on a.lead_id = b.id
  where b.email = 'mgruber@midtown-private.com' and a.type = 'call'
);

insert into public.lead_activities (lead_id, type, description)
select bl.id, 'note', 'Prefers asset sales only. Reassessed as not a fit for current listings.'
from public.buyer_leads bl where bl.email = 'buyer@relaycapital.com'
and not exists (
  select 1 from public.lead_activities a join public.buyer_leads b on a.lead_id = b.id
  where b.email = 'buyer@relaycapital.com' and a.type = 'note'
);

-- =============================================================================
-- 5. Due diligence items for the deals
-- =============================================================================
insert into public.due_diligence_items (deal_id, title, category, status, due_date, notes)
select d.id, 'Review financial statements (3 years)', 'Financials', 'in_review', (now() + interval '14 days')::date,
       'P&L, balance sheet, cash flow. Owner prepared QB export.'
from public.deals d join public.listings l on d.listing_id = l.id
where l.business_name = 'Ez Business Advisory - Deal 1' and d.status = 'due_diligence'
and not exists (
  select 1 from public.due_diligence_items x where x.title = 'Review financial statements (3 years)'
);

insert into public.due_diligence_items (deal_id, title, category, status, due_date, notes)
select d.id, 'Verify client contracts & retention', 'Operations', 'in_review', (now() + interval '10 days')::date,
       'Top-10 client concentration and renewal history.'
from public.deals d join public.listings l on d.listing_id = l.id
where l.business_name = 'Ez Business Advisory - Deal 1' and d.status = 'due_diligence'
and not exists (
  select 1 from public.due_diligence_items x where x.title = 'Verify client contracts & retention'
);

insert into public.due_diligence_items (deal_id, title, category, status, due_date, notes)
select d.id, 'Verify tax returns & filings', 'Financials', 'pending', (now() + interval '21 days')::date, null
from public.deals d join public.listings l on d.listing_id = l.id
where l.business_name = 'Ez Business Advisory - Deal 1' and d.status = 'due_diligence'
and not exists (
  select 1 from public.due_diligence_items x where x.title = 'Verify tax returns & filings'
);

insert into public.due_diligence_items (deal_id, title, category, status, due_date, notes)
select d.id, 'Confirm lease & real estate terms', 'Real Estate', 'approved', (now() - interval '3 days')::date,
       'Lease runs 4.5 years with one renewal option. Confirmed assignable.'
from public.deals d join public.listings l on d.listing_id = l.id
where l.business_name = 'Ez Business Advisory - Deal 1' and d.status = 'due_diligence'
and not exists (
  select 1 from public.due_diligence_items x where x.title = 'Confirm lease & real estate terms'
);

insert into public.due_diligence_items (deal_id, title, category, status, due_date, notes)
select d.id, 'Employee census & key-person risk', 'Operations', 'waived', null, 'No key-man dependence; acceptable risk.'
from public.deals d join public.listings l on d.listing_id = l.id
where l.business_name = 'Ez Business Advisory - Deal 1' and d.status = 'due_diligence'
and not exists (
  select 1 from public.due_diligence_items x where x.title = 'Employee census & key-person risk'
);

insert into public.due_diligence_items (deal_id, title, category, status, due_date, notes)
select d.id, 'Escrow & wire instructions review', 'Legal', 'in_review', (now() + interval '5 days')::date,
       'Closing attorney drafting funds flow.'
from public.deals d join public.listings l on d.listing_id = l.id
where l.business_name = 'Ez Business Advisory - Deal 1' and d.status = 'closing'
and not exists (
  select 1 from public.due_diligence_items x where x.title = 'Escrow & wire instructions review'
);

insert into public.due_diligence_items (deal_id, title, category, status, due_date, notes)
select d.id, 'Final P&L recast sign-off', 'Financials', 'pending', (now() + interval '3 days')::date,
       'Buyer lender requires updated SDE recast.'
from public.deals d join public.listings l on d.listing_id = l.id
where l.business_name = 'Ez Business Advisory - Deal 1' and d.status = 'closing'
and not exists (
  select 1 from public.due_diligence_items x where x.title = 'Final P&L recast sign-off'
);

insert into public.due_diligence_items (deal_id, title, category, status, due_date, notes)
select d.id, 'Confirm LOI exclusivity window', 'Legal', 'approved', (now() - interval '2 days')::date,
       '60-day exclusivity, expires next week.'
from public.deals d join public.listings l on d.listing_id = l.id
where l.business_name = 'Summit Logistics — Regional Freight & Distribution' and d.status = 'under_contract'
and not exists (
  select 1 from public.due_diligence_items x where x.title = 'Confirm LOI exclusivity window'
);

insert into public.due_diligence_items (deal_id, title, category, status, due_date, notes)
select d.id, 'Truck fleet maintenance records', 'Operations', 'pending', (now() + interval '30 days')::date,
       '16 tractors, 34 trailers. Review DOT compliance log.'
from public.deals d join public.listings l on d.listing_id = l.id
where l.business_name = 'Summit Logistics — Regional Freight & Distribution' and d.status = 'under_contract'
and not exists (
  select 1 from public.due_diligence_items x where x.title = 'Truck fleet maintenance records'
);

-- =============================================================================
-- 6. Documents linked to deals (deal_documents) + listing_documents
--    NOTE: deal_documents has NO category column (only listing_documents does).
--    File URLs point to public sample PDFs so they render as downloadable docs.
-- =============================================================================
insert into public.deal_documents (deal_id, file_name, file_url)
select d.id, 'Ez Deals - Financial Statements FY2023-2025.pdf',
       'https://www.w3.org/WHO/TR/1999/REC-html401-19991224.pdf'
from public.deals d join public.listings l on d.listing_id = l.id
where l.business_name = 'Ez Business Advisory - Deal 1' and d.status in ('due_diligence','closing','closed')
and not exists (select 1 from public.deal_documents x where x.file_name = 'Ez Deals - Financial Statements FY2023-2025.pdf');

insert into public.deal_documents (deal_id, file_name, file_url)
select d.id, 'Client Contracts - Top 10.pdf',
       'https://www.w3.org/WHO/TR/1999/REC-html401-19991224.pdf'
from public.deals d join public.listings l on d.listing_id = l.id
where l.business_name = 'Ez Business Advisory - Deal 1' and d.status = 'due_diligence'
and not exists (select 1 from public.deal_documents x where x.file_name = 'Client Contracts - Top 10.pdf');

insert into public.deal_documents (deal_id, file_name, file_url)
select d.id, 'SDE Recast - 2025.xlsx',
       'https://calibre-ebook.com/downloads/demos/demo.docx'
from public.deals d join public.listings l on d.listing_id = l.id
where l.business_name = 'Ez Business Advisory - Deal 1' and d.status = 'closing'
and not exists (select 1 from public.deal_documents x where x.file_name = 'SDE Recast - 2025.xlsx');

insert into public.deal_documents (deal_id, file_name, file_url)
select d.id, 'Signed LOI - Summit Logistics.pdf',
       'https://www.w3.org/WHO/TR/1999/REC-html401-19991224.pdf'
from public.deals d join public.listings l on d.listing_id = l.id
where l.business_name = 'Summit Logistics — Regional Freight & Distribution' and d.status = 'under_contract'
and not exists (select 1 from public.deal_documents x where x.file_name = 'Signed LOI - Summit Logistics.pdf');

insert into public.deal_documents (deal_id, file_name, file_url)
select d.id, 'Closing Statement - Final.pdf',
       'https://www.w3.org/WHO/TR/1999/REC-html401-19991224.pdf'
from public.deals d join public.listings l on d.listing_id = l.id
where l.business_name = 'Ez Business Advisory - Deal 1' and d.status = 'closed'
and not exists (select 1 from public.deal_documents x where x.file_name = 'Closing Statement - Final.pdf');

-- Listing documents (has category column)
insert into public.listing_documents (listing_id, file_url, category, status)
select id, 'https://www.w3.org/WHO/TR/1999/REC-html401-19991224.pdf', 'Financial', 'active'
from public.listings where business_name = 'Ez Business Advisory - Deal 1'
and not exists (
  select 1 from public.listing_documents x
  join public.listings l on x.listing_id = l.id where l.business_name = 'Ez Business Advisory - Deal 1'
);

-- =============================================================================
-- VERIFICATION (run separately in SQL Editor if you want to confirm counts):
--   select (select count(*) from public.deals) as deals,
--          (select count(*) from public.seller_leads) as seller_leads,
--          (select count(*) from public.buyer_leads) as buyer_leads,
--          (select count(*) from public.lead_activities) as activities,
--          (select count(*) from public.due_diligence_items) as dd_items,
--          (select count(*) from public.deal_documents) as deal_docs;
-- =============================================================================
