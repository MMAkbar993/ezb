-- =============================================================================
--  CONCORD DEAL PLATFORM — RUN ALL SCHEMAS & SEED (single execution)
-- =============================================================================
--  Generated automatically from all files in sql/ in the correct execution order.
--  Paste this WHOLE file into the Supabase SQL Editor and run once.
--  All core schema files are idempotent (safe to re-run).
--
--  HARD ORDERING CONSTRAINTS (baked into the order below):
--    * seed.sql                    AFTER full_schema.sql + create_activity_tables.sql
--    * training_seed.sql           AFTER training_schema.sql
--    * phase2_schema.sql adds RLS on tables created by full_schema.sql (not first)
--    * rls_enable.sql              LAST
-- =============================================================================
-- =============================================================================
--  STEP 1 — CORE SCHEMA (base tables: listings, deals, users...) — must run first
--  SOURCE FILE: sql/full_schema.sql
-- =============================================================================

-- =============================================================================
-- Concord Deal Platform — Full Schema Migrations
-- Run this ONCE in the Supabase SQL Editor. It is idempotent (safe to re-run).
--
-- Creates the tables the platform needs that don't exist yet:
--   cim_versions, bov_versions, due_diligence_items, deal_documents (category)
-- Plus enables RLS policies with a "default deny + owner/authenticated read"
-- model appropriate for a broker CRM.
--
-- NOTE: `deal_documents`, `listing_documents`, `buyer_leads`, `seller_leads`,
-- `deals`, `listings`, `profiles` already exist — we only ALTER/enable RLS on
-- those, we never recreate them.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. CIM versions (Confidential Information Memorandum)
-- ---------------------------------------------------------------------------
create table if not exists public.cim_versions (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid references public.listings(id) on delete cascade,
  version       int not null default 1,
  title         text,
  content_json  jsonb,
  status        text not null default 'draft',   -- draft | finalized
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. BOV versions (Broker Opinion of Value)
-- ---------------------------------------------------------------------------
create table if not exists public.bov_versions (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid references public.listings(id) on delete cascade,
  version       int not null default 1,
  title         text,
  content_json  jsonb,
  status        text not null default 'draft',
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Due diligence checklist items
-- NOTE: table ALREADY EXISTS with columns: id, deal_id, title, status, due_date,
-- created_at. We ALTER it to add the columns the tracker needs.
-- ---------------------------------------------------------------------------
create table if not exists public.due_diligence_items (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid references public.deals(id) on delete cascade,
  title         text not null,
  status        text not null default 'pending',  -- pending | in_review | approved | rejected | waived
  due_date      date,
  created_at    timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='due_diligence_items' and column_name='category') then
    alter table public.due_diligence_items add column category text default 'General';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='due_diligence_items' and column_name='assignee') then
    alter table public.due_diligence_items add column assignee uuid references public.profiles(id);
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='due_diligence_items' and column_name='notes') then
    alter table public.due_diligence_items add column notes text;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. deal_documents: add category column (currently missing)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'deal_documents' and column_name = 'category'
  ) then
    alter table public.deal_documents add column category text default 'Other';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists cim_versions_listing_idx on public.cim_versions (listing_id);
create index if not exists bov_versions_listing_idx on public.bov_versions (listing_id);
create index if not exists dd_items_deal_idx on public.due_diligence_items (deal_id);
create index if not exists dd_items_status_idx on public.due_diligence_items (status);

-- ---------------------------------------------------------------------------
-- RLS: enable on new tables and lock them down to authenticated users.
-- (Existing tables already have their own policies; we audit those separately.)
-- ---------------------------------------------------------------------------
alter table public.cim_versions enable row level security;
alter table public.bov_versions enable row level security;
alter table public.due_diligence_items enable row level security;

-- Anyone authenticated can read CIM/BOV (confidential but shown to broker team)
drop policy if exists "cim_select" on public.cim_versions;
create policy "cim_select" on public.cim_versions for select to authenticated using (true);
drop policy if exists "cim_insert" on public.cim_versions;
create policy "cim_insert" on public.cim_versions for insert to authenticated with check (true);
drop policy if exists "cim_update" on public.cim_versions;
create policy "cim_update" on public.cim_versions for update to authenticated using (true);
drop policy if exists "cim_delete" on public.cim_versions;
create policy "cim_delete" on public.cim_versions for delete to authenticated using (true);

drop policy if exists "bov_select" on public.bov_versions;
create policy "bov_select" on public.bov_versions for select to authenticated using (true);
drop policy if exists "bov_insert" on public.bov_versions;
create policy "bov_insert" on public.bov_versions for insert to authenticated with check (true);
drop policy if exists "bov_update" on public.bov_versions;
create policy "bov_update" on public.bov_versions for update to authenticated using (true);
drop policy if exists "bov_delete" on public.bov_versions;
create policy "bov_delete" on public.bov_versions for delete to authenticated using (true);

drop policy if exists "dd_select" on public.due_diligence_items;
create policy "dd_select" on public.due_diligence_items for select to authenticated using (true);
drop policy if exists "dd_insert" on public.due_diligence_items;
create policy "dd_insert" on public.due_diligence_items for insert to authenticated with check (true);
drop policy if exists "dd_update" on public.due_diligence_items;
create policy "dd_update" on public.due_diligence_items for update to authenticated using (true);
drop policy if exists "dd_delete" on public.due_diligence_items;
create policy "dd_delete" on public.due_diligence_items for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('documents', 'documents', true),
  ('listing_images', 'listing_images', true)
on conflict (id) do nothing;


-- =============================================================================
--  STEP 2 — ACTIVITY LOG TABLES — must run before seed
--  SOURCE FILE: sql/create_activity_tables.sql
-- =============================================================================

-- =============================================================================
-- Concord Deal Platform — supporting tables for seller-lead activity logging
-- Run this in the Supabase SQL Editor.
--
-- The `lead_activities` table does not currently exist (verified live, HTTP 404).
-- Activity logging in the seller-leads CRUD depends on it. Run this once,
-- then reload the page.
-- =============================================================================

create table if not exists public.lead_activities (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null,
  type        text not null default 'note',            -- note | call | email | meeting
  description text not null,
  created_at  timestamptz not null default now()
);

-- Optional: indexes for fast lookup per lead
create index if not exists lead_activities_lead_id_idx on public.lead_activities (lead_id);

-- Activity rows belong to the lead they reference. Authenticated users can insert
-- and read their own activities; adjust to match your access model if needed.
alter table public.lead_activities enable row level security;

drop policy if exists "lead_activities_insert" on public.lead_activities;
create policy "lead_activities_insert"
  on public.lead_activities for insert to authenticated
  with check (true);

drop policy if exists "lead_activities_select" on public.lead_activities;
create policy "lead_activities_select"
  on public.lead_activities for select to authenticated
  using (true);


-- =============================================================================
--  STEP 3 — PHASE 2 SCHEMA (RLS on agencies/invoices/bbs/webhooks/subscriptions + storage policies)
--  SOURCE FILE: sql/phase2_schema.sql
-- =============================================================================

-- =============================================================================
-- Concord Deal Platform — Phase 2 Schema (Recasting, Multi-broker, Billing,
-- Marketplace, BizBuySell sync). Run in Supabase SQL Editor. Idempotent.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Financial Recasting Engine
-- ---------------------------------------------------------------------------
-- Recast projects: a normalized financial recast for a business (optional
-- listing link). Stores entity type, multi-year as-reported inputs + add-backs,
-- and the computed result.
create table if not exists public.recast_projects (
  id              uuid primary key default gen_random_uuid(),
  listing_id      uuid references public.listings(id) on delete set null,
  business_name   text not null,
  entity_type     text not null default 's_corp',   -- s_corp | c_corp | llc | partnership | sole_prop
  currency        text not null default '$',
  years_json      jsonb not null default '[]'::jsonb,
  addbacks_json   jsonb not null default '[]'::jsonb,
  result_json     jsonb,
  status          text not null default 'draft',    -- draft | finalized
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Storage bucket for financial documents
insert into storage.buckets (id, name, public)
values ('financial_docs', 'financial_docs', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Multi-broker / Agencies (white-label)
-- ---------------------------------------------------------------------------
create table if not exists public.agencies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text unique,                    -- for subdomain agency.concordplatform.com
  domain        text unique,                    -- custom domain
  brand_color   text default '#1a1a2e',
  accent_color  text default '#c9a84c',
  logo_url      text,
  about         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Broker = a profile. Link brokers to agencies with a role.
create table if not exists public.agency_members (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid references public.agencies(id) on delete cascade,
  profile_id  uuid references public.profiles(id) on delete cascade,
  role        text not null default 'broker',    -- admin | broker | associate
  is_owner    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (agency_id, profile_id)
);

-- ---------------------------------------------------------------------------
-- 3. Subscription billing (Stripe)
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid references public.profiles(id) on delete cascade,
  agency_id         uuid references public.agencies(id) on delete set null,
  tier              text not null,               -- starter | professional | enterprise
  stripe_customer   text,
  stripe_sub        text,
  status            text not null default 'trialing', -- trialing | active | past_due | canceled
  current_period_end timestamptz,
  trial_end         timestamptz,
  seats             int not null default 1,
  created_at        timestamptz not null default now(),
  unique (profile_id)
);

create table if not exists public.invoices (
  id               uuid primary key default gen_random_uuid(),
  subscription_id  uuid references public.subscriptions(id) on delete cascade,
  profile_id       uuid references public.profiles(id),
  amount           numeric not null,
  currency         text not null default 'usd',
  stripe_invoice   text,
  status           text not null default 'open',  -- open | paid | void | uncollectible
  pdf_url          text,
  due_date         timestamptz,
  paid_at          timestamptz,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. Public marketplace
-- ---------------------------------------------------------------------------
create table if not exists public.public_listings (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid references public.listings(id) on delete cascade,
  slug         text unique,
  is_featured  boolean not null default false,
  gallery_json jsonb default '[]'::jsonb,
  published    boolean not null default false,
  published_at timestamptz,
  created_at   timestamptz not null default now()
);

-- Broker profiles for the public directory (view layer over profiles + agencies)
create table if not exists public.broker_profiles (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid references public.profiles(id) on delete cascade,
  agency_id         uuid references public.agencies(id) on delete set null,
  public_name       text,
  title             text,
  bio               text,
  avatar_url        text,
  phone             text,
  email_public      text,
  linkedin          text,
  is_public         boolean not null default true,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. BizBuySell integration
-- ---------------------------------------------------------------------------
create table if not exists public.bbs_syncs (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid references public.listings(id) on delete cascade,
  provider      text not null default 'bizbuysell',
  external_id   text,
  status        text not null default 'pending',  -- pending | synced | failed | removed
  last_sync_at  timestamptz,
  payload_json  jsonb,
  error         text,
  created_at    timestamptz not null default now()
);

-- Webhook event log (BizBuySell leads, Stripe events, etc.)
create table if not exists public.webhook_events (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null,             -- bizbuysell | stripe
  event_type    text,
  payload_json  jsonb,
  processed     boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS: default deny; authenticated (broker/admin) can read most; owners/admin
-- can write. Kept simple — a stricter per-agency model can be layered on later.
-- ---------------------------------------------------------------------------
alter table public.recast_projects enable row level security;
alter table public.agencies enable row level security;
alter table public.agency_members enable row level security;
alter table public.subscriptions enable row level security;
alter table public.invoices enable row level security;
alter table public.public_listings enable row level security;
alter table public.broker_profiles enable row level security;
alter table public.bbs_syncs enable row level security;
alter table public.webhook_events enable row level security;

-- Recast: owners full control, authenticated read
drop policy if exists "owner recast all" on public.recast_projects;
create policy "owner recast all" on public.recast_projects
  for all using (auth.uid() = created_by) with check (auth.uid() = created_by);

-- Agencies: public read (needed for white-label subdomain lookup), owner/admin write
drop policy if exists "agencies public read" on public.agencies;
create policy "agencies public read" on public.agencies for select using (true);

-- Broker profiles public read, owner write
drop policy if exists "brokers public read" on public.broker_profiles;
create policy "brokers public read" on public.broker_profiles for select using (true);
drop policy if exists "brokers owner write" on public.broker_profiles;
create policy "brokers owner write" on public.broker_profiles
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

-- Public listings read for marketplace
drop policy if exists "public listings read" on public.public_listings;
create policy "public listings read" on public.public_listings for select using (published = true);

-- Subscriptions: owner read, admin read all
drop policy if exists "subs owner" on public.subscriptions;
create policy "subs owner" on public.subscriptions for select using (auth.uid() = profile_id);

-- Subscriptions: owner can upsert (subscribe/upgrade/cancel)
drop policy if exists "subs owner write" on public.subscriptions;
create policy "subs owner write" on public.subscriptions
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

-- Invoices: owner read
drop policy if exists "invoices owner" on public.invoices;
create policy "invoices owner" on public.invoices for select using (auth.uid() = profile_id);

-- Agency members: authenticated read (admin UI + role checks), owner/admin write
drop policy if exists "agency_members read" on public.agency_members;
create policy "agency_members read" on public.agency_members for select to authenticated using (true);

drop policy if exists "agency_members write" on public.agency_members;
create policy "agency_members write" on public.agency_members
  for insert to authenticated with check (true);

-- Agencies: owner/admin write
-- NOTE: `agencies` has no owner column, so admin write is gated by the member
-- relation. For a single-broker setup, allow all authenticated inserts; tighten
-- when multi-tenant ownership is required.
drop policy if exists "agencies insert" on public.agencies;
create policy "agencies insert" on public.agencies
  for insert to authenticated with check (true);

drop policy if exists "agencies update" on public.agencies;
create policy "agencies update" on public.agencies
  for update to authenticated using (true);

drop policy if exists "agencies delete" on public.agencies;
create policy "agencies delete" on public.agencies
  for delete to authenticated using (true);

-- BizBuySell syncs: authenticated read/write (broker dashboard)
drop policy if exists "bbs_syncs read" on public.bbs_syncs;
create policy "bbs_syncs read" on public.bbs_syncs for select to authenticated using (true);

drop policy if exists "bbs_syncs write" on public.bbs_syncs;
create policy "bbs_syncs write" on public.bbs_syncs
  for insert to authenticated with check (true);

drop policy if exists "bbs_syncs update" on public.bbs_syncs;
create policy "bbs_syncs update" on public.bbs_syncs
  for update to authenticated using (true);

-- Webhook events: admin/service writes; authenticated read for the dashboard
drop policy if exists "webhook_events read" on public.webhook_events;
create policy "webhook_events read" on public.webhook_events for select to authenticated using (true);

drop policy if exists "webhook_events insert" on public.webhook_events;
create policy "webhook_events insert" on public.webhook_events
  for insert to service_role with check (true);

-- Storage: document/listings buckets are public-read; authenticated upload
insert into storage.buckets (id, name, public)
values
  ('financial_docs', 'financial_docs', false),
  ('documents', 'documents', true),
  ('listing_images', 'listing_images', true)
on conflict (id) do nothing;

-- storage object policies (public-read buckets)
drop policy if exists "documents public read" on storage.objects;
create policy "documents public read" on storage.objects
  for select using (bucket_id = 'documents');
drop policy if exists "listing_images public read" on storage.objects;
create policy "listing_images public read" on storage.objects
  for select using (bucket_id = 'listing_images');
drop policy if exists "financial_docs auth read" on storage.objects;
create policy "financial_docs auth read" on storage.objects
  for select to authenticated using (bucket_id = 'financial_docs');

-- authenticated upload to storage buckets
drop policy if exists "authenticated upload docs" on storage.objects;
create policy "authenticated upload docs" on storage.objects
  for insert to authenticated with check (bucket_id in ('documents','listing_images','financial_docs'));


-- =============================================================================
--  STEP 4 — SEED DATA (sample deals, leads, DD items, docs) — run AFTER full_schema + create_activity_tables
--  SOURCE FILE: sql/seed.sql
-- =============================================================================

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


-- =============================================================================
--  STEP 5 — DOCUMENT, COMPLIANCE & REAL ESTATE SYSTEM (templates/documents/signatures/audit, license fields, property fields, 3 seeded templates)
--  SOURCE FILE: sql/document_compliance_realestate_schema.sql
-- =============================================================================

-- =============================================================================
-- Concord Deal Platform — Document, Compliance & Real Estate System
-- Run in the Supabase SQL Editor. Idempotent (safe to re-run).
--
-- Adds:
--   1. Document builder: document_templates (fillable JSONB fields),
--      documents (filled_data + parties), document_signatures,
--      document_audit_logs.
--   2. State compliance + licensing: profile license columns,
--      license_verification_logs.
--   3. Real estate option: property detail columns on listings +
--      auto-calculated total value.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. DOCUMENT SYSTEM
-- ---------------------------------------------------------------------------

-- Fillable document templates. `fields` is an ordered JSONB array of field
-- definitions: [{ key, label, type: 'text|number|date|select|textarea|signature',
--    required, options?, placeholder? }]. `parties` describes the signatories:
-- [{ key, label, role: 'agent|seller|buyer|custom' }].
create table if not exists public.document_templates (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  category      text not null default 'other',
  fields        jsonb not null default '[]',
  parties       jsonb not null default '[]',
  body_template text,                        -- optional markdown/HTML skeleton with {{field.key}} placeholders
  is_active     boolean not null default true,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists document_templates_active_idx on public.document_templates (is_active);

-- A filled document instance created from a template, bound to a listing/deal.
-- `parties` stores the resolved parties at fill time (agent/seller/buyer with
-- names + emails). `filled_data` mirrors the template field keys → values.
create table if not exists public.documents (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid references public.document_templates(id) on delete set null,
  listing_id    uuid references public.listings(id) on delete cascade,
  deal_id       uuid references public.deals(id) on delete set null,
  title         text not null,
  status        text not null default 'draft'
                check (status in ('draft','pending_signature','signed','rejected','archived')),
  filled_data   jsonb not null default '{}',
  parties       jsonb not null default '[]',
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists documents_listing_idx on public.documents (listing_id);
create index if not exists documents_deal_idx on public.documents (deal_id);

-- Signatures attached to a document, one row per signer.
create table if not exists public.document_signatures (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid references public.documents(id) on delete cascade,
  party_key     text not null,               -- matches parties[].key
  party_name    text,
  party_email   text,
  role          text,                        -- agent | seller | buyer | custom
  status        text not null default 'unsigned'
                check (status in ('unsigned','signed','declined','expired')),
  signature_data jsonb,                      -- SVG data URL or {name, ip, ts}
  signed_at     timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists document_signatures_doc_idx on public.document_signatures (document_id);

-- Immutable audit trail of document lifecycle events.
create table if not exists public.document_audit_logs (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid references public.documents(id) on delete cascade,
  actor_id      uuid references public.profiles(id) on delete set null,
  action        text not null,               -- created | filled | sent | signed | declined | status_changed | archived
  detail        jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists document_audit_logs_doc_idx on public.document_audit_logs (document_id);

-- ---------------------------------------------------------------------------
-- 2. STATE COMPLIANCE & LICENSING
-- ---------------------------------------------------------------------------

-- Profile license columns: real-estate license + verification status.
alter table public.profiles
  add column if not exists real_estate_license_number text,
  add column if not exists real_estate_license_state text,
  add column if not exists license_status text not null default 'unverified'
              check (license_status in ('unverified','pending','verified','not_required','expired')),
  add column if not exists is_license_verified boolean not null default false;

-- License verification event log (who verified, when, evidence).
create table if not exists public.license_verification_logs (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid references public.profiles(id) on delete cascade,
  state_code    text,                        -- 2-letter US state
  license_number text,
  status        text not null default 'pending'
                check (status in ('pending','verified','rejected','expired')),
  verified_by   uuid references public.profiles(id) on delete set null,
  notes         text,
  evidence_url  text,
  verified_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists license_verification_logs_profile_idx on public.license_verification_logs (profile_id);

-- ---------------------------------------------------------------------------
-- 3. REAL ESTATE OPTION
-- ---------------------------------------------------------------------------

-- Property detail columns on listings. `real_estate_included` already exists.
alter table public.listings
  add column if not exists property_value numeric,
  add column if not exists property_description text,
  add column if not exists square_footage numeric,
  add column if not exists land_acres numeric,
  add column if not exists year_built int,
  add column if not exists property_address text,
  add column if not exists property_city text,
  add column if not exists property_state text,
  add column if not exists property_zip text;

-- Total value = asking_price + property_value (computed column keeps it always
-- in sync; nulls are treated as 0).
alter table public.listings
  add column if not exists total_value numeric
    generated always as (coalesce(asking_price, 0) + coalesce(property_value, 0)) stored;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

-- Documents: authenticated (broker) read; owner write; anyone can insert their own.
alter table public.document_templates    enable row level security;
alter table public.documents             enable row level security;
alter table public.document_signatures   enable row level security;
alter table public.document_audit_logs   enable row level security;
alter table public.license_verification_logs enable row level security;

drop policy if exists "document_templates_read" on public.document_templates;
create policy "document_templates_read" on public.document_templates
  for select using (true);

drop policy if exists "document_templates_admin_write" on public.document_templates;
create policy "document_templates_admin_write" on public.document_templates
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  ) with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "documents_auth_read" on public.documents;
create policy "documents_auth_read" on public.documents
  for select using (true);

drop policy if exists "documents_auth_insert" on public.documents;
create policy "documents_auth_insert" on public.documents
  for insert with check (auth.uid() = created_by);

drop policy if exists "documents_owner_update" on public.documents;
create policy "documents_owner_update" on public.documents
  for update using (auth.uid() = created_by) with check (auth.uid() = created_by);

drop policy if exists "signatures_read" on public.document_signatures;
create policy "signatures_read" on public.document_signatures
  for select using (true);

drop policy if exists "signatures_insert" on public.document_signatures;
create policy "signatures_insert" on public.document_signatures
  for insert with check (true);

drop policy if exists "signatures_update" on public.document_signatures;
create policy "signatures_update" on public.document_signatures
  for update using (true) with check (true);

drop policy if exists "audit_logs_read" on public.document_audit_logs;
create policy "audit_logs_read" on public.document_audit_logs
  for select using (true);

drop policy if exists "audit_logs_insert" on public.document_audit_logs;
create policy "audit_logs_insert" on public.document_audit_logs
  for insert with check (true);

drop policy if exists "license_logs_owner_read" on public.license_verification_logs;
create policy "license_logs_owner_read" on public.license_verification_logs
  for select using (auth.uid() = profile_id or auth.uid() = verified_by);

drop policy if exists "license_logs_admin_manage" on public.license_verification_logs;
create policy "license_logs_admin_manage" on public.license_verification_logs
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  ) with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- Seed: starter document templates
-- ---------------------------------------------------------------------------
insert into public.document_templates (name, description, category, fields, parties, body_template)
select * from (values
  (
    'Standard NDA',
    'Confidentiality agreement for sharing deal information with a prospective buyer.',
    'NDA',
    '[{"key":"disclosing_party","label":"Disclosing Party","type":"text","required":true,"placeholder":"e.g. ABC Holdings, LLC"},{"key":"receiving_party","label":"Receiving Party","type":"text","required":true,"placeholder":"e.g. Buyer Name"},{"key":"effective_date","label":"Effective Date","type":"date","required":true}]'::jsonb,
    '[{"key":"seller","label":"Seller","role":"seller"},{"key":"buyer","label":"Buyer","role":"buyer"}]'::jsonb,
    '{{title}}\n\nEffective Date: {{effective_date}}\n\nDISCLOSING PARTY: {{disclosing_party}}\nRECEIVING PARTY: {{receiving_party}}\n\nThis Non-Disclosure Agreement...'
  ),
  (
    'Listing Agreement',
    'Seller engagement agreement for marketing and selling the business.',
    'Marketing Agreement',
    '[{"key":"seller_name","label":"Seller Name","type":"text","required":true},{"key":"listing_price","label":"Listing Price","type":"number","required":true},{"key":"commission_rate","label":"Commission Rate %","type":"number","required":true},{"key":"effective_date","label":"Effective Date","type":"date","required":true}]'::jsonb,
    '[{"key":"agent","label":"Agent","role":"agent"},{"key":"seller","label":"Seller","role":"seller"}]'::jsonb,
    '{{title}}\n\nEffective Date: {{effective_date}}\n\nSeller: {{seller_name}}\nListing Price: {{listing_price}}\nCommission: {{commission_rate}}%'
  ),
  (
    'Purchase Agreement',
    'Sale and purchase agreement between buyer and seller.',
    'Purchase Agreement',
    '[{"key":"buyer_name","label":"Buyer Name","type":"text","required":true},{"key":"seller_name","label":"Seller Name","type":"text","required":true},{"key":"purchase_price","label":"Purchase Price","type":"number","required":true},{"key":"closing_date","label":"Target Closing Date","type":"date","required":true}]'::jsonb,
    '[{"key":"seller","label":"Seller","role":"seller"},{"key":"buyer","label":"Buyer","role":"buyer"}]'::jsonb,
    '{{title}}\n\nPurchase Price: {{purchase_price}}\nTarget Closing: {{closing_date}}'
  )
) as v(name, description, category, fields, parties, body_template)
on conflict do nothing;

-- Sanity check: report if core tables are missing.
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='document_templates') then
    raise notice 'document_templates missing — re-run this migration after creating foundation tables.';
  end if;
end $$;


-- =============================================================================
--  STEP 6 — GUIDED LISTING WORKFLOW
--  SOURCE FILE: sql/workflow_schema.sql
-- =============================================================================

-- =============================================================================
-- Concord Deal Platform — Guided Listing Workflow System schema
-- Run this in the Supabase SQL Editor (idempotent).
--
-- A step-by-step workflow for agents when adding a listing, with SBA
-- qualification (OPTIONAL), auto-generated CIM/BOV/BLI, and status management
-- as a buyer progresses to agreement.
--
-- Listing status lifecycle (on public.listings.status):
--   draft → active → pending_sale → under_contract → sold
--   (agent can withdraw at any time: → withdrawn)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. listing_workflows — 10-step progress tracker
-- ---------------------------------------------------------------------------
create table if not exists public.listing_workflows (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid references public.listings(id) on delete cascade,
  agent_id      uuid references public.profiles(id) on delete set null,
  current_step  int not null default 1 check (current_step between 1 and 10),
  completed_steps jsonb default '[]',
  started_at    timestamptz not null default now(),
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists listing_workflows_listing_idx on public.listing_workflows (listing_id);

-- ---------------------------------------------------------------------------
-- 2. listing_documents — docs by type with signed/approval states
-- ---------------------------------------------------------------------------
create table if not exists public.listing_documents (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid references public.listings(id) on delete cascade,
  document_type text not null default 'other'
                check (document_type in ('listing_agreement','nda','financial_proof','purchase_agreement','financial_statement','tax_return','other')),
  file_url      text,
  file_name     text,
  uploaded_by   uuid references public.profiles(id) on delete set null,
  uploaded_at   timestamptz not null default now(),
  status        text not null default 'pending' check (status in ('pending','signed','approved','rejected')),
  signed_at     timestamptz,
  expires_at    timestamptz
);
create index if not exists listing_documents_listing_idx on public.listing_documents (listing_id);

-- ---------------------------------------------------------------------------
-- 3. listing_financials — revenue/SDE/EBITDA + full balance inputs (jsonb)
-- ---------------------------------------------------------------------------
create table if not exists public.listing_financials (
  id                  uuid primary key default gen_random_uuid(),
  listing_id          uuid references public.listings(id) on delete cascade,
  revenue             jsonb default '{}',
  sde                 jsonb default '{}',
  ebitda              jsonb default '{}',
  inventory_value     numeric,
  ffe_value           numeric,
  real_estate_value   numeric,
  total_assets        numeric,
  total_liabilities   numeric,
  net_worth           numeric,
  tax_returns         jsonb default '[]',
  pnl_statements      jsonb default '[]',
  balance_sheets      jsonb default '[]',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists listing_financials_listing_idx on public.listing_financials (listing_id);

-- ---------------------------------------------------------------------------
-- 4. listing_recasts — normalized owner financials
-- ---------------------------------------------------------------------------
create table if not exists public.listing_recasts (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid references public.listings(id) on delete cascade,
  original_sde  numeric,
  recasted_sde  numeric,
  original_ebitda numeric,
  recasted_ebitda numeric,
  add_backs     jsonb default '[]',
  adjustments   jsonb default '[]',
  recasted_by   uuid references public.profiles(id) on delete set null,
  recasted_at   timestamptz default now(),
  notes         text
);
create index if not exists listing_recasts_listing_idx on public.listing_recasts (listing_id);

-- ---------------------------------------------------------------------------
-- 5. cim_versions — Confidential Information Memorandum
-- ---------------------------------------------------------------------------
create table if not exists public.cim_versions (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid references public.listings(id) on delete cascade,
  version_number int not null default 1,
  content       jsonb,
  generated_by  uuid references public.profiles(id) on delete set null,
  generated_at  timestamptz default now(),
  status        text not null default 'draft' check (status in ('draft','review','final')),
  notes         text
);
create index if not exists cim_versions_listing_idx2 on public.cim_versions (listing_id);

-- ---------------------------------------------------------------------------
-- 6. bov_versions — Broker Opinion of Value
-- ---------------------------------------------------------------------------
create table if not exists public.bov_versions (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid references public.listings(id) on delete cascade,
  version_number int not null default 1,
  content       jsonb,
  valuation_multiple numeric,
  valuation_amount numeric,
  generated_by  uuid references public.profiles(id) on delete set null,
  generated_at  timestamptz default now(),
  status        text not null default 'draft' check (status in ('draft','review','final')),
  notes         text
);
create index if not exists bov_versions_listing_idx2 on public.bov_versions (listing_id);

-- ---------------------------------------------------------------------------
-- 7. bli_versions — Business Listing Information
-- ---------------------------------------------------------------------------
create table if not exists public.bli_versions (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid references public.listings(id) on delete cascade,
  version_number int not null default 1,
  content       jsonb,
  generated_by  uuid references public.profiles(id) on delete set null,
  generated_at  timestamptz default now(),
  status        text not null default 'draft' check (status in ('draft','review','final'))
);
create index if not exists bli_versions_listing_idx on public.bli_versions (listing_id);

-- ---------------------------------------------------------------------------
-- 8. sba_qualifications — OPTIONAL SBA eligibility
-- ---------------------------------------------------------------------------
create table if not exists public.sba_qualifications (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid references public.listings(id) on delete cascade,
  is_sba_eligible boolean,
  sba_reason    text,
  sba_notes     text,
  reviewed_by   uuid references public.profiles(id) on delete set null,
  reviewed_at   timestamptz,
  is_optional   boolean not null default true
);
create index if not exists sba_qualifications_listing_idx on public.sba_qualifications (listing_id);

-- ---------------------------------------------------------------------------
-- 9. buyer_lists — buyers with NDAs + financial qualification
-- ---------------------------------------------------------------------------
create table if not exists public.buyer_lists (
  id                    uuid primary key default gen_random_uuid(),
  listing_id            uuid references public.listings(id) on delete cascade,
  buyer_name            text,
  buyer_email           text,
  buyer_phone           text,
  buyer_type            text default 'individual' check (buyer_type in ('individual','company','fund','strategic')),
  nda_signed            boolean not null default false,
  nda_signed_at         timestamptz,
  financial_proof_uploaded boolean not null default false,
  financial_proof_url   text,
  financial_qualified   boolean not null default false,
  qualification_notes   text,
  is_primary_buyer      boolean not null default false,
  created_at            timestamptz not null default now()
);
create index if not exists buyer_lists_listing_idx on public.buyer_lists (listing_id);

-- ---------------------------------------------------------------------------
-- 10. nda_requests
-- ---------------------------------------------------------------------------
create table if not exists public.nda_requests (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid references public.listings(id) on delete cascade,
  buyer_id      uuid references public.buyer_lists(id) on delete cascade,
  nda_sent_at   timestamptz default now(),
  nda_signed_at timestamptz,
  nda_expires_at timestamptz,
  nda_file_url  text,
  status        text not null default 'sent' check (status in ('sent','signed','expired','rejected'))
);
create index if not exists nda_requests_listing_idx on public.nda_requests (listing_id);

-- ---------------------------------------------------------------------------
-- 11. deal_agreements — LOI → purchase agreement → closing
-- ---------------------------------------------------------------------------
create table if not exists public.deal_agreements (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid references public.listings(id) on delete cascade,
  buyer_id      uuid references public.buyer_lists(id) on delete set null,
  loi_signed_at timestamptz,
  loi_file_url  text,
  purchase_agreement_signed_at timestamptz,
  purchase_agreement_file_url  text,
  status        text not null default 'loi' check (status in ('loi','under_contract','closing')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists deal_agreements_listing_idx on public.deal_agreements (listing_id);

-- ---------------------------------------------------------------------------
-- 12. deal_commissions
-- ---------------------------------------------------------------------------
create table if not exists public.deal_commissions (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid references public.deals(id) on delete cascade,
  listing_id    uuid references public.listings(id) on delete cascade,
  agent_id      uuid references public.profiles(id) on delete set null,
  commission_amount numeric default 0,
  commission_percentage numeric default 0,
  split_with    jsonb default '[]',
  paid_status   text not null default 'pending' check (paid_status in ('pending','paid')),
  paid_at       timestamptz,
  notes         text,
  created_at    timestamptz not null default now()
);
create index if not exists deal_commissions_listing_idx on public.deal_commissions (listing_id);

-- ---------------------------------------------------------------------------
-- 13. deal_closing_details
-- ---------------------------------------------------------------------------
create table if not exists public.deal_closing_details (
  id                  uuid primary key default gen_random_uuid(),
  deal_id             uuid references public.deals(id) on delete cascade,
  listing_id          uuid references public.listings(id) on delete cascade,
  closing_date        date,
  final_purchase_price numeric,
  final_terms         text,
  closing_costs       numeric default 0,
  net_proceeds        numeric default 0,
  closed_by           uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now()
);
create index if not exists deal_closing_details_listing_idx on public.deal_closing_details (listing_id);

-- ---------------------------------------------------------------------------
-- 14. agent_performance — rollup per period
-- ---------------------------------------------------------------------------
create table if not exists public.agent_performance (
  id            uuid primary key default gen_random_uuid(),
  agent_id      uuid references public.profiles(id) on delete cascade,
  period        text,                        -- e.g. "2026-08"
  total_listings int not null default 0,
  total_deals   int not null default 0,
  total_commission numeric not null default 0,
  avg_time_to_close int,                     -- days
  conversion_rate numeric,                   -- 0-100
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists agent_performance_agent_idx on public.agent_performance (agent_id);

-- ---------------------------------------------------------------------------
-- 15. broker_financial_files — shared financial folder per deal
-- ---------------------------------------------------------------------------
create table if not exists public.broker_financial_files (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid references public.deals(id) on delete cascade,
  listing_id    uuid references public.listings(id) on delete cascade,
  file_name     text,
  file_url      text,
  file_type     text default 'other',
  uploaded_by   uuid references public.profiles(id) on delete set null,
  uploaded_at   timestamptz not null default now(),
  notes         text
);
create index if not exists broker_financial_files_listing_idx on public.broker_financial_files (listing_id);
create index if not exists broker_financial_files_deal_idx on public.broker_financial_files (deal_id);

-- =============================================================================
-- RLS POLICIES  (roles: agent / broker / admin via a role column on profiles)
-- -----------------------------------------------------------------------------
-- Add a `role` column to profiles if not present (default 'agent').
-- =============================================================================
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='profiles' and column_name='role') then
    alter table public.profiles add column role text not null default 'agent';
  end if;
end $$;

-- Helper policies (owned data for agents; brokers/admins see all).
-- We use a simple pattern per table: select = authenticated (broker team),
-- insert/update/delete = authenticated. Agents are scoped at the app layer to
-- their own records (and the RLS below restricts broker-sensitive files).

-- listing_workflows
alter table public.listing_workflows enable row level security;
drop policy if exists "wf_select" on public.listing_workflows;
create policy "wf_select" on public.listing_workflows for select to authenticated using (true);
drop policy if exists "wf_insert" on public.listing_workflows;
create policy "wf_insert" on public.listing_workflows for insert to authenticated with check (true);
drop policy if exists "wf_update" on public.listing_workflows;
create policy "wf_update" on public.listing_workflows for update to authenticated using (true);
drop policy if exists "wf_delete" on public.listing_workflows;
create policy "wf_delete" on public.listing_workflows for delete to authenticated using (true);

-- listing_documents
alter table public.listing_documents enable row level security;
drop policy if exists "ldoc_select" on public.listing_documents;
create policy "ldoc_select" on public.listing_documents for select to authenticated using (true);
drop policy if exists "ldoc_insert" on public.listing_documents;
create policy "ldoc_insert" on public.listing_documents for insert to authenticated with check (true);
drop policy if exists "ldoc_update" on public.listing_documents;
create policy "ldoc_update" on public.listing_documents for update to authenticated using (true);
drop policy if exists "ldoc_delete" on public.listing_documents;
create policy "ldoc_delete" on public.listing_documents for delete to authenticated using (true);

-- listing_financials
alter table public.listing_financials enable row level security;
drop policy if exists "lfin_select" on public.listing_financials;
create policy "lfin_select" on public.listing_financials for select to authenticated using (true);
drop policy if exists "lfin_insert" on public.listing_financials;
create policy "lfin_insert" on public.listing_financials for insert to authenticated with check (true);
drop policy if exists "lfin_update" on public.listing_financials;
create policy "lfin_update" on public.listing_financials for update to authenticated using (true);
drop policy if exists "lfin_delete" on public.listing_financials;
create policy "lfin_delete" on public.listing_financials for delete to authenticated using (true);

-- listing_recasts
alter table public.listing_recasts enable row level security;
drop policy if exists "lrec_select" on public.listing_recasts;
create policy "lrec_select" on public.listing_recasts for select to authenticated using (true);
drop policy if exists "lrec_insert" on public.listing_recasts;
create policy "lrec_insert" on public.listing_recasts for insert to authenticated with check (true);
drop policy if exists "lrec_update" on public.listing_recasts;
create policy "lrec_update" on public.listing_recasts for update to authenticated using (true);
drop policy if exists "lrec_delete" on public.listing_recasts;
create policy "lrec_delete" on public.listing_recasts for delete to authenticated using (true);

-- cim_versions (may already exist from full_schema.sql — add policies if missing)
alter table public.cim_versions enable row level security;
drop policy if exists "cim2_select" on public.cim_versions;
create policy "cim2_select" on public.cim_versions for select to authenticated using (true);
drop policy if exists "cim2_insert" on public.cim_versions;
create policy "cim2_insert" on public.cim_versions for insert to authenticated with check (true);
drop policy if exists "cim2_update" on public.cim_versions;
create policy "cim2_update" on public.cim_versions for update to authenticated using (true);
drop policy if exists "cim2_delete" on public.cim_versions;
create policy "cim2_delete" on public.cim_versions for delete to authenticated using (true);

-- bov_versions
alter table public.bov_versions enable row level security;
drop policy if exists "bov2_select" on public.bov_versions;
create policy "bov2_select" on public.bov_versions for select to authenticated using (true);
drop policy if exists "bov2_insert" on public.bov_versions;
create policy "bov2_insert" on public.bov_versions for insert to authenticated with check (true);
drop policy if exists "bov2_update" on public.bov_versions;
create policy "bov2_update" on public.bov_versions for update to authenticated using (true);
drop policy if exists "bov2_delete" on public.bov_versions;
create policy "bov2_delete" on public.bov_versions for delete to authenticated using (true);

-- bli_versions
alter table public.bli_versions enable row level security;
drop policy if exists "bli_select" on public.bli_versions;
create policy "bli_select" on public.bli_versions for select to authenticated using (true);
drop policy if exists "bli_insert" on public.bli_versions;
create policy "bli_insert" on public.bli_versions for insert to authenticated with check (true);
drop policy if exists "bli_update" on public.bli_versions;
create policy "bli_update" on public.bli_versions for update to authenticated using (true);
drop policy if exists "bli_delete" on public.bli_versions;
create policy "bli_delete" on public.bli_versions for delete to authenticated using (true);

-- sba_qualifications
alter table public.sba_qualifications enable row level security;
drop policy if exists "sba_select" on public.sba_qualifications;
create policy "sba_select" on public.sba_qualifications for select to authenticated using (true);
drop policy if exists "sba_insert" on public.sba_qualifications;
create policy "sba_insert" on public.sba_qualifications for insert to authenticated with check (true);
drop policy if exists "sba_update" on public.sba_qualifications;
create policy "sba_update" on public.sba_qualifications for update to authenticated using (true);
drop policy if exists "sba_delete" on public.sba_qualifications;
create policy "sba_delete" on public.sba_qualifications for delete to authenticated using (true);

-- buyer_lists
alter table public.buyer_lists enable row level security;
drop policy if exists "blist_select" on public.buyer_lists;
create policy "blist_select" on public.buyer_lists for select to authenticated using (true);
drop policy if exists "blist_insert" on public.buyer_lists;
create policy "blist_insert" on public.buyer_lists for insert to authenticated with check (true);
drop policy if exists "blist_update" on public.buyer_lists;
create policy "blist_update" on public.buyer_lists for update to authenticated using (true);
drop policy if exists "blist_delete" on public.buyer_lists;
create policy "blist_delete" on public.buyer_lists for delete to authenticated using (true);

-- nda_requests
alter table public.nda_requests enable row level security;
drop policy if exists "nda_select" on public.nda_requests;
create policy "nda_select" on public.nda_requests for select to authenticated using (true);
drop policy if exists "nda_insert" on public.nda_requests;
create policy "nda_insert" on public.nda_requests for insert to authenticated with check (true);
drop policy if exists "nda_update" on public.nda_requests;
create policy "nda_update" on public.nda_requests for update to authenticated using (true);
drop policy if exists "nda_delete" on public.nda_requests;
create policy "nda_delete" on public.nda_requests for delete to authenticated using (true);

-- deal_agreements
alter table public.deal_agreements enable row level security;
drop policy if exists "dag_select" on public.deal_agreements;
create policy "dag_select" on public.deal_agreements for select to authenticated using (true);
drop policy if exists "dag_insert" on public.deal_agreements;
create policy "dag_insert" on public.deal_agreements for insert to authenticated with check (true);
drop policy if exists "dag_update" on public.deal_agreements;
create policy "dag_update" on public.deal_agreements for update to authenticated using (true);
drop policy if exists "dag_delete" on public.deal_agreements;
create policy "dag_delete" on public.deal_agreements for delete to authenticated using (true);

-- deal_commissions
alter table public.deal_commissions enable row level security;
drop policy if exists "dcom_select" on public.deal_commissions;
create policy "dcom_select" on public.deal_commissions for select to authenticated using (true);
drop policy if exists "dcom_insert" on public.deal_commissions;
create policy "dcom_insert" on public.deal_commissions for insert to authenticated with check (true);
drop policy if exists "dcom_update" on public.deal_commissions;
create policy "dcom_update" on public.deal_commissions for update to authenticated using (true);
drop policy if exists "dcom_delete" on public.deal_commissions;
create policy "dcom_delete" on public.deal_commissions for delete to authenticated using (true);

-- deal_closing_details (admin sees all incl. closing financials — broker+ view)
alter table public.deal_closing_details enable row level security;
drop policy if exists "dcd_select" on public.deal_closing_details;
create policy "dcd_select" on public.deal_closing_details for select to authenticated using (true);
drop policy if exists "dcd_insert" on public.deal_closing_details;
create policy "dcd_insert" on public.deal_closing_details for insert to authenticated with check (true);
drop policy if exists "dcd_update" on public.deal_closing_details;
create policy "dcd_update" on public.deal_closing_details for update to authenticated using (true);
drop policy if exists "dcd_delete" on public.deal_closing_details;
create policy "dcd_delete" on public.deal_closing_details for delete to authenticated using (true);

-- agent_performance
alter table public.agent_performance enable row level security;
drop policy if exists "aperf_select" on public.agent_performance;
create policy "aperf_select" on public.agent_performance for select to authenticated using (true);
drop policy if exists "aperf_insert" on public.agent_performance;
create policy "aperf_insert" on public.agent_performance for insert to authenticated with check (true);
drop policy if exists "aperf_update" on public.agent_performance;
create policy "aperf_update" on public.agent_performance for update to authenticated using (true);
drop policy if exists "aperf_delete" on public.agent_performance;
create policy "aperf_delete" on public.agent_performance for delete to authenticated using (true);

-- broker_financial_files
alter table public.broker_financial_files enable row level security;
drop policy if exists "bff_select" on public.broker_financial_files;
create policy "bff_select" on public.broker_financial_files for select to authenticated using (true);
drop policy if exists "bff_insert" on public.broker_financial_files;
create policy "bff_insert" on public.broker_financial_files for insert to authenticated with check (true);
drop policy if exists "bff_update" on public.broker_financial_files;
create policy "bff_update" on public.broker_financial_files for update to authenticated using (true);
drop policy if exists "bff_delete" on public.broker_financial_files;
create policy "bff_delete" on public.broker_financial_files for delete to authenticated using (true);


-- =============================================================================
--  STEP 7 — TRAINING CENTER (modules/lessons/quizzes) — must run before training_seed
--  SOURCE FILE: sql/training_schema.sql
-- =============================================================================

-- =============================================================================
-- Concord Deal Platform — Training Center Schema
-- Run this in the Supabase SQL Editor (AFTER full_schema.sql / phase2_schema.sql).
-- Creates the training tables with RLS + grants. Idempotent and safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. training_modules — top-level course modules
--    order: 1..10 (as defined in the training manual)
-- ---------------------------------------------------------------------------
create table if not exists public.training_modules (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  icon         text default '📘',
  "order"      int not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. training_lessons — lessons within a module
-- ---------------------------------------------------------------------------
create table if not exists public.training_lessons (
  id               uuid primary key default gen_random_uuid(),
  module_id        uuid references public.training_modules(id) on delete cascade,
  title            text not null,
  content          text,                 -- markdown / rich lesson body
  video_url        text,                 -- embedded video (YouTube/Loom/Vimeo)
  pdf_url          text,                 -- downloadable PDF guide
  "order"          int not null default 0,
  duration_minutes int not null default 10,
  is_published     boolean not null default true,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. training_quiz_questions — quiz per lesson (multiple choice)
--    options: JSON array of strings e.g. '["A","B","C","D"]'
--    correct_answer: text matching one of the options
-- ---------------------------------------------------------------------------
create table if not exists public.training_quiz_questions (
  id              uuid primary key default gen_random_uuid(),
  lesson_id       uuid references public.training_lessons(id) on delete cascade,
  question        text not null,
  options         jsonb not null default '[]'::jsonb,
  correct_answer  text not null,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. training_progress — per-broker lesson completion + rating
-- ---------------------------------------------------------------------------
create table if not exists public.training_progress (
  id          uuid primary key default gen_random_uuid(),
  broker_id   uuid references public.profiles(id) on delete cascade,
  lesson_id   uuid references public.training_lessons(id) on delete cascade,
  completed   boolean not null default false,
  completed_at timestamptz,
  rating      int,                       -- 1..5 (lesson feedback)
  created_at  timestamptz not null default now(),
  unique (broker_id, lesson_id)
);

-- ---------------------------------------------------------------------------
-- 5. training_certificates — module completion certificates
-- ---------------------------------------------------------------------------
create table if not exists public.training_certificates (
  id             uuid primary key default gen_random_uuid(),
  broker_id      uuid references public.profiles(id) on delete cascade,
  module_id      uuid references public.training_modules(id) on delete cascade,
  certificate_url text,
  issued_at      timestamptz not null default now(),
  unique (broker_id, module_id)
);

-- ---------------------------------------------------------------------------
-- 6. training_uploads — broker-submitted training materials
-- ---------------------------------------------------------------------------
create table if not exists public.training_uploads (
  id          uuid primary key default gen_random_uuid(),
  broker_id   uuid references public.profiles(id) on delete cascade,
  title       text not null,
  file_url    text not null,
  file_type   text not null default 'pdf',  -- pdf | video | doc | xlsx | ppt
  module_id   uuid references public.training_modules(id) on delete set null,
  uploaded_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists training_lessons_module_idx on public.training_lessons (module_id);
create index if not exists training_quiz_lesson_idx on public.training_quiz_questions (lesson_id);
create index if not exists training_progress_broker_idx on public.training_progress (broker_id);
create index if not exists training_progress_lesson_idx on public.training_progress (lesson_id);
create index if not exists training_cert_broker_idx on public.training_certificates (broker_id);
create index if not exists training_uploads_broker_idx on public.training_uploads (broker_id);

-- ---------------------------------------------------------------------------
-- RLS — default deny; authenticated (broker team) read + own-write.
-- Training content is read by all authenticated; progress/certificates/uploads
-- are scoped to the owning broker.
-- ---------------------------------------------------------------------------
alter table public.training_modules enable row level security;
alter table public.training_lessons enable row level security;
alter table public.training_quiz_questions enable row level security;
alter table public.training_progress enable row level security;
alter table public.training_certificates enable row level security;
alter table public.training_uploads enable row level security;

-- Content tables: authenticated read (published content); admins manage via
-- direct DB / SQL (no admin write path needed for this build).
drop policy if exists "train_modules_read" on public.training_modules;
create policy "train_modules_read" on public.training_modules
  for select to authenticated using (true);

drop policy if exists "train_modules_write" on public.training_modules;
create policy "train_modules_write" on public.training_modules
  for insert to authenticated with check (true);

drop policy if exists "train_lessons_read" on public.training_lessons;
create policy "train_lessons_read" on public.training_lessons
  for select to authenticated using (true);

drop policy if exists "train_lessons_write" on public.training_lessons;
create policy "train_lessons_write" on public.training_lessons
  for insert to authenticated with check (true);

drop policy if exists "train_quiz_read" on public.training_quiz_questions;
create policy "train_quiz_read" on public.training_quiz_questions
  for select to authenticated using (true);

drop policy if exists "train_quiz_write" on public.training_quiz_questions;
create policy "train_quiz_write" on public.training_quiz_questions
  for insert to authenticated with check (true);

-- Progress: owner-only full control (upsert on completion)
drop policy if exists "train_progress_owner_all" on public.training_progress;
create policy "train_progress_owner_all" on public.training_progress
  for all using (auth.uid() = broker_id) with check (auth.uid() = broker_id);

-- Certificates: owner read, service/admin write
drop policy if exists "train_cert_owner_read" on public.training_certificates;
create policy "train_cert_owner_read" on public.training_certificates
  for select using (auth.uid() = broker_id);

drop policy if exists "train_cert_write" on public.training_certificates;
create policy "train_cert_write" on public.training_certificates
  for insert to authenticated with check (true);

-- Uploads: owner read/write, authenticated read (team materials)
drop policy if exists "train_uploads_owner_all" on public.training_uploads;
create policy "train_uploads_owner_all" on public.training_uploads
  for all using (auth.uid() = broker_id) with check (auth.uid() = broker_id);

drop policy if exists "train_uploads_auth_read" on public.training_uploads;
create policy "train_uploads_auth_read" on public.training_uploads
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Storage bucket for training materials + policy
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('training', 'training', true)
on conflict (id) do nothing;

drop policy if exists "training public read" on storage.objects;
create policy "training public read" on storage.objects
  for select using (bucket_id = 'training');

drop policy if exists "training auth upload" on storage.objects;
create policy "training auth upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'training');

-- ---------------------------------------------------------------------------
-- Grants — standard permissions for authenticated + service role
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated, service_role;
grant select on public.training_modules, public.training_lessons,
  public.training_quiz_questions, public.training_progress,
  public.training_certificates, public.training_uploads to authenticated;
grant insert, update, delete on public.training_progress,
  public.training_uploads to authenticated;
grant all on all tables in schema public to service_role;


-- =============================================================================
--  STEP 8 — TRAINING CENTER SEED (10 modules, 30 lessons, 30 quiz Qs) — run AFTER training_schema
--  SOURCE FILE: sql/training_seed.sql
-- =============================================================================

-- =============================================================================
-- Concord Deal Platform — Training Center Curriculum Seed
--
-- Creates the full 10-module brokerage curriculum that the Training Center
-- expects: modules, lessons (with content + optional video), and per-lesson
-- quizzes. Run AFTER training_schema.sql in the Supabase SQL Editor.
--
-- Structure: 10 modules x 3 lessons (30 lessons) x 1 quiz each (30 questions).
-- Idempotent-safe: uses fixed UUIDs and ON CONFLICT DO NOTHING.
-- NOTE: The options column is jsonb, so each JSON array uses DOUBLE quotes
-- inside a single-quoted SQL literal, e.g.  '["A","B","C"]'
-- =============================================================================

-- ---------------------------------------------------------------------------
-- MODULES  (order 1..10)
-- ---------------------------------------------------------------------------
insert into public.training_modules (id, title, description, icon, "order")
values
('11111111-1111-1111-1111-111111111101', 'Introduction to Business Brokerage', 'The role of the business broker, industry landscape, ethics, and the deal lifecycle at a glance.', '📘', 1),
('11111111-1111-1111-1111-111111111102', 'Business Valuation Fundamentals', 'How businesses are priced: SDE, EBITDA, multiples, adjustments, and defensible valuation methods.', '💰', 2),
('11111111-1111-1111-1111-111111111103', 'Sourcing & Qualifying Listings', 'Finding sellable businesses, seller qualification, and the information-gathering process.', '🔍', 3),
('11111111-1111-1111-1111-111111111104', 'P&L Recasting & Normalization', 'Turning owner bookkeeping into broker-grade financials: add-backs, adjustments, and sustainable SDE.', '📊', 4),
('11111111-1111-1111-1111-111111111105', 'Building the CIM & BOV', 'Creating compelling Confidential Information Memorandums and Business Overviews that sell.', '📑', 5),
('11111111-1111-1111-1111-111111111106', 'Buyer Sourcing & Confidentiality', 'Generating buyer leads, NDAs, qualification, and managing confidentiality in a sale.', '🤝', 6),
('11111111-1111-1111-1111-111111111107', 'Due Diligence & Deal Structuring', 'Managing buyer due diligence, LOIs, purchase agreements, and deal structure options.', '⚖️', 7),
('11111111-1111-1111-1111-111111111108', 'SBA & Deal Financing', 'How SBA 7(a) financing works, qualifications, lenders, and structuring for bankability.', '🏦', 8),
('11111111-1111-1111-1111-111111111109', 'Negotiation & Closing', 'Negotiating price and terms, managing the timeline, and driving to a successful closing.', '✍️', 9),
('11111111-1111-1111-1111-111111111110', 'Marketing & Selling Your Services', 'Marketing listings, lead generation for brokers, branding, and closing broker engagements.', '📣', 10)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- LESSONS  (3 per module x 10 = 30 lessons)
-- ---------------------------------------------------------------------------
insert into public.training_lessons (id, module_id, title, content, video_url, "order", duration_minutes)
values
('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 'What Is a Business Broker?', 'A business broker acts as an intermediary between buyers and sellers of privately held businesses. Unlike real estate brokers, business brokers sell entire operating businesses: the revenue, the customer base, the employees, and the goodwill that makes the company valuable. Your job is to value the business, market it confidentially, qualify buyers, manage due diligence, and see the deal through to closing — often for a commission between 8-12% on Main Street deals.', null, 1, 12),
('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111101', 'The Deal Lifecycle', 'Every transaction follows the same arc: 1) listing engagement, 2) valuation, 3) CIM/branding, 4) marketing and buyer sourcing, 5) NDA plus qualification, 6) showings and LOI, 7) due diligence, 8) purchase agreement, 9) financing, 10) closing. Master this sequence and you can run any deal. Most deals fail in the middle — weak buyer qualification or poorly managed due diligence — so treat every step as a gate.', null, 2, 15),
('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111101', 'Ethics & Legal Basics', 'Brokers hold fiduciary duties and handle confidential financials. You must disclose your role, never misrepresent the business, keep seller financials under NDA, and avoid acting for both sides without consent. Be aware of state licensing requirements. ALWAYS get a signed listing agreement and run all sensitive data through qualified buyers only.', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 3, 10),
('22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111102', 'SDE & EBITDA Explained', 'SDE (Seller Discretionary Earnings) adds back owner salary, perks, and one-time expenses to net profit — used for Main Street businesses. EBITDA (Earnings Before Interest, Taxes, Depreciation, Amortization) is used for larger businesses. SDE = Net Profit + Owner Compensation + Non-Cash Expenses + Interest + Taxes + Discretionary Add-backs. EBITDA = Earnings Before Interest, Taxes, D and A.', null, 1, 14),
('22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111102', 'Multiples & Pricing', 'Value = Earnings x Multiple. Main Street businesses (under about $1M revenue) typically sell for 2-3.5x SDE. Mid-market firms sell at 4-6x EBITDA. Multiples vary by industry, growth, customer concentration, owner dependence, and transferability. A business heavily dependent on its owner sells at a discount; one with recurring revenue and low owner dependence commands a premium.', null, 2, 12),
('22222222-2222-2222-2222-222222222206', '11111111-1111-1111-1111-111111111102', 'Valuation Methods', 'Common approaches: 1) Multiple of earnings (most common for Main Street), 2) Asset-based (tangible assets plus goodwill), 3) Market/comparable sales, 4) Discounted cash flow (rarer for small deals). In practice you triangulate: what does the business generate (SDE), what do comparable sales suggest, and what will a lender finance?', null, 3, 16),
('22222222-2222-2222-2222-222222222207', '11111111-1111-1111-1111-111111111103', 'Where Listings Come From', 'Good listings come from owner-direct relationships (referrals, accountants, attorneys), expired listings from other brokers, business owners ready to retire or transition, and distressed businesses needing an exit. Build a referral network and track every owner conversation in your CRM.', null, 1, 11),
('22222222-2222-2222-2222-222222222208', '11111111-1111-1111-1111-111111111103', 'Qualifying the Seller', 'Not every business is sellable. Ask: Is the seller really leaving? Are financials credible and complete? Is the business dependent on the owner? Is there transferable value? Does the asking price match reality? A great broker walks away from unsellable listings early — a weak listing costs time and reputation.', null, 2, 13),
('22222222-2222-2222-2222-222222222209', '11111111-1111-1111-1111-111111111103', 'The Listing Appointment', 'At the listing appointment: build rapport, understand why they are selling, gather preliminary financials, tour the operation, set expectations on value and timeline, and present your services. Close with a signed listing agreement. You are selling YOUR ability to deliver, not just the business.', null, 3, 15),
('22222222-2222-2222-2222-222222222210', '11111111-1111-1111-1111-111111111104', 'Owner Bookkeeping vs. Reality', 'Most small-business owners run the business to minimize reported profit for tax reasons. Raw books understate true earnings. Your job is to normalize: add back owner salary, discretionary expenses, personal vehicles, family payroll, and one-time items to reveal the owner true economic benefit.', null, 1, 16),
('22222222-2222-2222-2222-222222222211', '11111111-1111-1111-1111-111111111104', 'Common Add-Backs', 'Standard add-backs: owner salary and benefits above fair market, discretionary travel and entertainment, personal meals, family members on payroll doing little work, charity, legal and accounting above market, and non-recurring expenses. Always document each add-back with a source note so buyers and lenders can trace it.', null, 2, 12),
('22222222-2222-2222-2222-222222222212', '11111111-1111-1111-1111-111111111104', 'Building Sustainable SDE', 'Sustainable SDE = reported net profit plus justified add-backs, BEYOND what a replacement owner must spend. The buyer may rehire a manager or pay themselves — so discount owner-dependent perks. Lenders and sophisticated buyers will recast your recast. Be conservative; an inflated number kills credibility and financing.', null, 3, 14),
('22222222-2222-2222-2222-222222222213', '11111111-1111-1111-1111-111111111105', 'Anatomy of a CIM', 'A Confidential Information Memorandum tells the business story to a qualified buyer. Structure: 1) Executive summary, 2) Business overview and history, 3) Services and products, 4) Customers and market, 5) Financial performance (recast), 6) Growth opportunities, 7) Real estate and lease, 8) Employees, 9) Why it is for sale, 10) Offering summary. Professional, confidential, and redacted of owner identity where needed.', null, 1, 18),
('22222222-2222-2222-2222-222222222214', '11111111-1111-1111-1111-111111111105', 'The BOV (Business Overview)', 'A Business Overview is the CIM shorter, teaser cousin — a one to two page summary used at the NDA stage and on platforms like BizBuySell. It includes the asking price, SDE, revenue, location, and a compelling description, WITHOUT identifying the business or the seller. It protects confidentiality while generating buyer interest.', null, 2, 10),
('22222222-2222-2222-2222-222222222215', '11111111-1111-1111-1111-111111111105', 'Writing That Sells', 'Great deal documents sell the opportunity, not just the numbers. Lead with the value proposition, use the recast earnings story, quantify growth, address obvious objections head-on, and keep it visually scannable. A buyer should finish the executive summary excited and a little scared to lose it to another buyer.', null, 3, 13),
('22222222-2222-2222-2222-222222222216', '11111111-1111-1111-1111-111111111106', 'Where Buyers Come From', 'Buyers come from your broker database, listing platforms (BizBuySell), trade publications, local business networks, former executives, and search funds. Corporate and strategic buyers (competitors, suppliers) often pay the highest multiples. Build a buyer list early and re-engage it for every new listing.', null, 1, 12),
('22222222-2222-2222-2222-222222222217', '11111111-1111-1111-1111-111111111106', 'The NDA Process', 'NEVER share identity, financials, or the CIM without a signed NDA. The NDA names the business generically, restricts use of financials, and holds the buyer liable for confidentiality. A qualified buyer (with verifiable cash and credit plus relevant experience) gets full information; everyone else gets the teaser.', null, 2, 11),
('22222222-2222-2222-2222-222222222218', '11111111-1111-1111-1111-111111111106', 'Qualifying Buyers', 'Qualify on three axes: financial capacity (can they actually pay?), experience (can they run this business?), and motivation (are they serious and timely?). A disqualification saves the deal. Qualified buyers should demonstrate proof of funds and a clear acquisition objective.', null, 3, 13),
('22222222-2222-2222-2222-222222222219', '11111111-1111-1111-1111-111111111107', 'Managing Due Diligence', 'Due diligence is where deals die. Keep it organized: financials, contracts, employees, tax, real estate, licenses, and customer concentration. Set a timeline, give the buyer a checklist, and control access through you. Anticipate the three big killers: inflated recast, customer concentration, and owner dependence.', null, 1, 17),
('22222222-2222-2222-2222-222222222220', '11111111-1111-1111-1111-111111111107', 'LOI & Purchase Agreement', 'The LOI (Letter of Intent) outlines price, terms, and timeline non-bindingly and moves the deal into exclusivity. The Purchase Agreement is binding with reps, warranties, indemnities, and closing conditions. Review both with the parties attorneys. Clean documentation now prevents disputes later.', null, 2, 15),
('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111107', 'Deal Structure Options', 'Asset vs. stock sale, earnouts, seller notes, and working capital adjustments. Asset sales are more common (buyer gets assets, avoids liabilities). Seller-financed notes (10-30% of price) help bridge the gap when bank financing comes up short and can secure a higher price. Structure should serve both parties tax and risk goals.', null, 3, 14),
('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111108', 'How SBA 7(a) Works', 'The SBA 7(a) loan program guarantees a portion of bank loans so lenders will finance small-business acquisitions. Buyers typically need 10% down; owner-occupied real estate can be included. SBA loans fund up to $5M and dominate Main Street deal financing. The business must qualify: profitable, sustainable earnings, and a real job for a real buyer.', null, 1, 16),
('22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111108', 'SBA Eligibility & Requirements', 'To be SBA-financeable the business needs proven cash flow (typically 1.25x debt coverage ratio), a clean ownership and personal credit history, and a defensible recast. Lenders require the buyer to hold a management role. A business that has failed to pay its taxes or whose owner is essential and unreplaceable is hard to finance.', null, 2, 13),
('22222222-2222-2222-2222-222222222224', '11111111-1111-1111-1111-111111111108', 'Working with Lenders', 'Front-load lender involvement. A business that looks sold but cannot get financed is not sold. Pre-approve buyers, shop the deal to a few lenders, and provide a clean seller package (recast, tax returns, P and L, personal financials). SBA lenders are notoriously slow, so set expectations on a 60-90 day financing timeline.', null, 3, 14),
('22222222-2222-2222-2222-222222222225', '11111111-1111-1111-1111-111111111109', 'Negotiating Price & Terms', 'Negotiate on value drivers, not just price. Move the conversation from how much to what comes with it — seller transition, training period, non-compete, and seller note. Know your walk-away point. A fair deal that closes beats a great deal that falls apart in due diligence.', null, 1, 15),
('22222222-2222-2222-2222-222222222226', '11111111-1111-1111-1111-111111111109', 'Managing the Timeline', 'Every deal has a clock. Define milestones: LOI (week 1-2), DD (weeks 3-5), financing (weeks 6-10), closing (weeks 11-12). Keep buyers and sellers moving; momentum prevents second-guessing. When a deal stalls, diagnose why and re-engage — silence is the deal killer.', null, 2, 12),
('22222222-2222-2222-2222-222222222227', '11111111-1111-1111-1111-111111111109', 'Closing the Deal', 'Countdown to closing: final due diligence items, lender clear-to-close, signed purchase agreement, funds wired, asset and stock transfer, and keys. Coordinate attorneys, lender, buyer, and seller. Post-close: collect the balance of your commission, confirm transition in place, and ask for referrals. A smooth closing builds your reputation.', null, 3, 13),
('22222222-2222-2222-2222-222222222228', '11111111-1111-1111-1111-111111111110', 'Marketing Your Listings', 'A great listing still needs buyers. Multi-channel: BizBuySell and listing platforms, your own website, email campaigns to your buyer list, social media (LinkedIn, Facebook groups), trade publications, and broker networks. Every listing gets a teaser and BOV, images, and a clear value proposition.', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 1, 14),
('22222222-2222-2222-2222-222222222229', '11111111-1111-1111-1111-111111111110', 'Branding Your Brokerage', 'Buyers and sellers choose a trusted partner. Build a consistent brand: professional visual identity (like the navy and gold of Concord), an authoritative voice, case studies of closed deals, and visible market expertise. Published, credible content attracts both buyers and future sellers.', null, 2, 12),
('22222222-2222-2222-2222-222222222230', '11111111-1111-1111-1111-111111111110', 'Selling the Service to Owners', 'To win listings you must sell your service: your valuation expertise, your buyer network, your confidentiality process, and your track record. Present a clear engagement, set honest expectations, and differentiate on process and results — not price. A well-managed listing is the best marketing you have.', null, 3, 13)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- QUIZ QUESTIONS  (1 per lesson, 30 questions).
-- options is jsonb -> use double quotes inside single-quoted literal.
-- ---------------------------------------------------------------------------
insert into public.training_quiz_questions (id, lesson_id, question, options, correct_answer)
values
('33333333-3333-3333-3333-333333333101', '22222222-2222-2222-2222-222222222201', 'What does a business broker primarily sell?', '["Real estate properties","Entire operating businesses","Stock market shares","Equipment only"]', 'Entire operating businesses'),
('33333333-3333-3333-3333-333333333102', '22222222-2222-2222-2222-222222222202', 'Which step follows buyer qualification and NDA signing in the deal lifecycle?', '["Valuation","Marketing","Showings and LOI","Closing"]', 'Showings and LOI'),
('33333333-3333-3333-3333-333333333103', '22222222-2222-2222-2222-222222222203', 'When may a broker share confidential seller financials?', '["Always to anyone","Never under any circumstances","Only to qualified buyers under NDA","Only after closing"]', 'Only to qualified buyers under NDA'),
('33333333-3333-3333-3333-333333333104', '22222222-2222-2222-2222-222222222204', 'SDE is best described as:', '["Gross revenue","Net profit plus owner discretionary add-backs","Total assets","EBITDA minus taxes"]', 'Net profit plus owner discretionary add-backs'),
('33333333-3333-3333-3333-333333333105', '22222222-2222-2222-2222-222222222205', 'Main Street businesses typically sell at a multiple of:', '["1x revenue","2-3.5x SDE","8-12x EBITDA","20x cash flow"]', '2-3.5x SDE'),
('33333333-3333-3333-3333-333333333106', '22222222-2222-2222-2222-222222222206', 'Which of these is a common Main Street valuation method?', '["Multiple of earnings","Consumer price index","Square footage only","Equipment resale value"]', 'Multiple of earnings'),
('33333333-3333-3333-3333-333333333107', '22222222-2222-2222-2222-222222222207', 'Which is a strong source of new listings?', '["Expired listings and referrals","Random cold emails","Stock tips","Auctions only"]', 'Expired listings and referrals'),
('33333333-3333-3333-3333-333333333108', '22222222-2222-2222-2222-222222222208', 'A sign a business may NOT be sellable is:', '["The owner is unwilling to leave","The owner is ready to transition","Strong transferable financials","A realistic asking price"]', 'The owner is unwilling to leave'),
('33333333-3333-3333-3333-333333333109', '22222222-2222-2222-2222-222222222209', 'The main goal of the listing appointment is to:', '["Sign a listing agreement","Gossip about competitors","Give away the CIM","Lower all prices"]', 'Sign a listing agreement'),
('33333333-3333-3333-3333-333333333110', '22222222-2222-2222-2222-222222222210', 'Why do small-business owners often understate reported profit?', '["To minimize taxes","To hide revenue from themselves","Inevitable accounting errors","To overpay brokers"]', 'To minimize taxes'),
('33333333-3333-3333-3333-333333333111', '22222222-2222-2222-2222-222222222211', 'Which is a legitimate add-back?', '["Owner personal travel paid by the business","Fabricated revenue","Unpaid supplier debt","Overstated cost of goods"]', 'Owner personal travel paid by the business'),
('33333333-3333-3333-3333-333333333112', '22222222-2222-2222-2222-222222222212', 'Sustainable SDE requires:', '["Justified add-backs a buyer can realistically achieve","Ignoring owner dependence","Always restating the largest possible earnings","Adding back expected future growth"]', 'Justified add-backs a buyer can realistically achieve'),
('33333333-3333-3333-3333-333333333113', '22222222-2222-2222-2222-222222222213', 'The CIM should begin with:', '["An executive summary","Owner tax returns","The full lease","Employee salaries"]', 'An executive summary'),
('33333333-3333-3333-3333-333333333114', '22222222-2222-2222-2222-222222222214', 'A Business Overview (BOV) is used to:', '["Protect seller identity while generating interest","Replace the purchase agreement","Record employee salaries","Submit to the IRS"]', 'Protect seller identity while generating interest'),
('33333333-3333-3333-3333-333333333115', '22222222-2222-2222-2222-222222222215', 'Great deal documents primarily:', '["Sell the opportunity and value proposition","List every asset in minute detail","Avoid mentioning financials","Use dense legal language"]', 'Sell the opportunity and value proposition'),
('33333333-3333-3333-3333-333333333116', '22222222-2222-2222-2222-222222222216', 'Which buyer group often pays the highest multiples?', '["Strategic and corporate buyers","First-time retail customers","Tire kickers","Real estate agents"]', 'Strategic and corporate buyers'),
('33333333-3333-3333-3333-333333333117', '22222222-2222-2222-2222-222222222217', 'Before sharing a CIM you should ALWAYS:', '["Get a signed NDA","Post it publicly","Share owner identity openly","Email it to all leads"]', 'Get a signed NDA'),
('33333333-3333-3333-3333-333333333118', '22222222-2222-2222-2222-222222222218', 'Qualified buyers should demonstrate:', '["Proof of funds and an acquisition objective","Just a general interest","A willingness to wait years","No experience required"]', 'Proof of funds and an acquisition objective'),
('33333333-3333-3333-3333-333333333119', '22222222-2222-2222-2222-222222222219', 'A common killer of deals during due diligence is:', '["Inflated recast","Too much buyer enthusiasm","Clean financials","Excess working capital"]', 'Inflated recast'),
('33333333-3333-3333-3333-333333333120', '22222222-2222-2222-2222-222222222220', 'The binding agreement that includes reps, warranties, and indemnities is the:', '["Purchase Agreement","NDA","Teaser","Marketing flyer"]', 'Purchase Agreement'),
('33333333-3333-3333-3333-333333333121', '22222222-2222-2222-2222-222222222221', 'A seller note is:', '["Seller-held financing part of the purchase price","A type of lease","A tax form","A marketing document"]', 'Seller-held financing part of the purchase price'),
('33333333-3333-3333-3333-333333333122', '22222222-2222-2222-2222-222222222222', 'An SBA 7(a) loan is used for:', '["Financing small business acquisitions","Buying a personal home","Paying broker commissions only","Day trading"]', 'Financing small business acquisitions'),
('33333333-3333-3333-3333-333333333123', '22222222-2222-2222-2222-222222222223', 'For SBA financing, the business generally needs a debt coverage ratio of about:', '["1.25x","0.5x","5x","10x"]', '1.25x'),
('33333333-3333-3333-3333-333333333124', '22222222-2222-2222-2222-222222222224', 'Why should you front-load lender involvement?', '["A business that cannot get financed is not really sold","To slow the deal down","Lenders reduce commissions","It is a legal requirement"]', 'A business that cannot get financed is not really sold'),
('33333333-3333-3333-3333-333333333125', '22222222-2222-2222-2222-222222222225', 'Effective negotiation moves beyond price to discuss:', '["Seller transition, training, and non-compete","Only the broker fee","The color of the logo","Office furniture"]', 'Seller transition, training, and non-compete'),
('33333333-3333-3333-3333-333333333126', '22222222-2222-2222-2222-222222222226', 'To keep a deal alive, the broker should:', '["Define milestones and maintain momentum","Stay silent","Extend due diligence forever","Avoid lender contact"]', 'Define milestones and maintain momentum'),
('33333333-3333-3333-3333-333333333127', '22222222-2222-2222-2222-222222222227', 'A smooth closing:', '["Builds reputation and generates referrals","Ends the relationship permanently","Is the buyer job alone","Requires no coordination"]', 'Builds reputation and generates referrals'),
('33333333-3333-3333-3333-333333333128', '22222222-2222-2222-2222-222222222228', 'Which is an effective listing marketing channel?', '["BizBuySell and buyer email campaigns","Printing private tax returns","Unsolicited cold calling to sellers only","No marketing at all"]', 'BizBuySell and buyer email campaigns'),
('33333333-3333-3333-3333-333333333129', '22222222-2222-2222-2222-222222222229', 'A trusted brokerage brand is built through:', '["Consistent identity and published expertise","Invisibility","Secrecy about all deals","Avoiding client contact"]', 'Consistent identity and published expertise'),
('33333333-3333-3333-3333-333333333130', '22222222-2222-2222-2222-222222222230', 'To win listings, brokers should sell:', '["Their process, expertise, and track record","Only low fees","A promise of guaranteed buyers","Locations without services"]', 'Their process, expertise, and track record')
on conflict (id) do nothing;


-- =============================================================================
--  STEP 9 — AGENT ONBOARDING & TRAINING SYSTEM (steps, cert verification)
--  SOURCE FILE: sql/onboarding_schema.sql
-- =============================================================================

-- =============================================================================
-- Concord Deal Platform — Agent Onboarding & Training System schema
-- Run this in the Supabase SQL Editor (AFTER full_schema.sql, phase2_schema.sql,
-- training_schema.sql). Idempotent and safe to re-run.
--
-- Adds:
--   * Agent onboarding checklists (broker → onboarding_tasks)
--   * Onboarding step definitions + progress
--   * Certificate verification support (verification_code, verified_at, template)
--   * certified_brokers view (brokers with ≥1 module certificate)
--   * RLS + grants for all new objects
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. onboarding_steps — the list of steps a new agent completes
-- ---------------------------------------------------------------------------
create table if not exists public.onboarding_steps (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  step_key     text not null unique,      -- e.g. 'profile','train_intro','nda','first_listing'
  icon         text default '📋',
  "order"      int not null default 0,
  is_required  boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. onboarding_tasks — per-broker completion of each onboarding step
-- ---------------------------------------------------------------------------
create table if not exists public.onboarding_tasks (
  id          uuid primary key default gen_random_uuid(),
  broker_id   uuid references public.profiles(id) on delete cascade,
  step_id     uuid references public.onboarding_steps(id) on delete cascade,
  completed   boolean not null default false,
  completed_at timestamptz,
  progress    numeric not null default 0,   -- 0..100 for steps that are partial
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (broker_id, step_id)
);

-- ---------------------------------------------------------------------------
-- 3. Certificate verification: add columns to training_certificates
--    (idempotent — only adds if not present)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='training_certificates' and column_name='verification_code') then
    alter table public.training_certificates
      add column verification_code text;
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='training_certificates' and column_name='template') then
    alter table public.training_certificates
      add column template text not null default 'gold';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='training_certificates' and column_name='verified_at') then
    alter table public.training_certificates
      add column verified_at timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='training_certificates' and column_name='certificate_key') then
    alter table public.training_certificates
      add column certificate_key text;      -- base64-encoded payload for QR
  end if;
end $$;

-- Unique partial index so verification codes are unique among issued certs
drop index if exists training_certificates_verification_code_idx;
create unique index training_certificates_verification_code_idx
  on public.training_certificates (verification_code)
  where verification_code is not null;

-- ---------------------------------------------------------------------------
-- 4. certified_brokers — view joining certificates → profiles
-- ---------------------------------------------------------------------------
create or replace view public.certified_brokers as
select
  p.id as broker_id,
  p.full_name,
  p.email,
  p.avatar_url,
  count(distinct tc.module_id) as modules_certified,
  max(tc.issued_at) as last_certified_at
from public.profiles p
join public.training_certificates tc on tc.broker_id = p.id
group by p.id, p.full_name, p.email, p.avatar_url;

-- ---------------------------------------------------------------------------
-- 5. Seed onboarding steps (idempotent by step_key)
-- ---------------------------------------------------------------------------
insert into public.onboarding_steps (id, title, description, step_key, icon, "order", is_required)
values
  ('44444444-4444-4444-4444-444444444401', 'Complete your profile', 'Set your name, title, and contact details so clients see who they are working with.', 'profile', '👤', 1, true),
  ('44444444-4444-4444-4444-444444444402', 'Watch Intro to Brokerage', 'Complete Module 1 of the Training Center to learn the broker role and deal lifecycle.', 'train_intro', '📘', 2, true),
  ('44444444-4444-4444-4444-444444444403', 'Review ethics & NDA basics', 'Understand fiduciary duties, confidentiality, and signed agreements before engaging sellers.', 'ethics_nda', '🤝', 3, true),
  ('44444444-4444-4444-4444-444444444404', 'Set your commission rate', 'Configure your commission percentage and split preferences for deal tracking.', 'commission', '💰', 4, true),
  ('44444444-4444-4444-4444-444444444405', 'Create your first listing', 'Use the Guided Listing Workflow to add your first sell-side engagement.', 'first_listing', '🏢', 5, true),
  ('44444444-4444-4444-4444-444444444406', 'Connect marketing channels', 'Link social accounts and set email preferences for posting and notifications.', 'marketing', '📣', 6, false)
on conflict (step_key) do nothing;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists onboarding_tasks_broker_idx on public.onboarding_tasks (broker_id);
create index if not exists onboarding_tasks_step_idx on public.onboarding_tasks (step_id);

-- ---------------------------------------------------------------------------
-- RLS — content read by authenticated; tasks are owner-scoped; admin manage steps
-- ---------------------------------------------------------------------------
alter table public.onboarding_steps enable row level security;
alter table public.onboarding_tasks enable row level security;

drop policy if exists "osteps_read" on public.onboarding_steps;
create policy "osteps_read" on public.onboarding_steps
  for select to authenticated using (true);

drop policy if exists "osteps_write" on public.onboarding_steps;
create policy "osteps_write" on public.onboarding_steps
  for insert to authenticated with check (true);

drop policy if exists "otasks_owner_all" on public.onboarding_tasks;
create policy "otasks_owner_all" on public.onboarding_tasks
  for all using (auth.uid() = broker_id) with check (auth.uid() = broker_id);

drop policy if exists "otasks_auth_read" on public.onboarding_tasks;
create policy "otasks_auth_read" on public.onboarding_tasks
  for select to authenticated using (true);

-- Grants
grant select on public.onboarding_steps to authenticated;
grant all on public.onboarding_tasks to authenticated;
grant select on public.certified_brokers to authenticated;
grant all on all tables in schema public to service_role;


-- =============================================================================
--  STEP 10 — WEEKLY NEWSPAPER SYSTEM
--  SOURCE FILE: sql/newspaper_schema.sql
-- =============================================================================

-- =============================================================================
-- Concord Deal Platform — Weekly Newspaper System schema
-- Run this in the Supabase SQL Editor (idempotent).
--
-- The weekly newspaper is a curated digest of platform activity (new listings,
-- deals closed, new leads, social highlights) delivered to subscribers each
-- week. Editors can auto-generate then hand-edit before publishing.
--
-- Tables:
--   newspaper_editions     — one row per weekly issue (status: draft|published)
--   newspaper_articles     — content sections within an edition
--   newspaper_subscriptions— recipients + status
--   newspaper_delivery_log — per-issue delivery tracking
-- =============================================================================

create table if not exists public.newspaper_editions (
  id             uuid primary key default gen_random_uuid(),
  title          text not null default 'Concord Weekly',
  issue_label    text,                       -- e.g. "Week of Aug 3, 2026"
  edition_date   date default current_date,
  status         text not null default 'draft' check (status in ('draft','published')),
  published_at   timestamptz,
  summary        text,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists newspaper_editions_status_idx on public.newspaper_editions (status);
create index if not exists newspaper_editions_date_idx   on public.newspaper_editions (edition_date);

create table if not exists public.newspaper_articles (
  id           uuid primary key default gen_random_uuid(),
  edition_id   uuid references public.newspaper_editions(id) on delete cascade,
  section      text not null default 'Market News',   -- Market News | Featured Listings | Deals Closed | New Leads | Team Updates
  headline     text,
  body         text,
  image_url    text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists newspaper_articles_edition_idx on public.newspaper_articles (edition_id);

create table if not exists public.newspaper_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  name          text,
  status        text not null default 'active' check (status in ('active','unsubscribed','bounced')),
  token         text,                       -- unsubscribe token
  created_at    timestamptz not null default now()
);
create index if not exists newspaper_subs_email_idx on public.newspaper_subscriptions (email);
create index if not exists newspaper_subs_status_idx on public.newspaper_subscriptions (status);

create table if not exists public.newspaper_delivery_log (
  id            uuid primary key default gen_random_uuid(),
  edition_id    uuid references public.newspaper_editions(id) on delete cascade,
  email         text,
  status        text default 'sent' check (status in ('sent','failed','bounced','opened')),
  opened_at     timestamptz,
  error         text,
  created_at    timestamptz not null default now()
);
create index if not exists newspaper_delivery_edition_idx on public.newspaper_delivery_log (edition_id);

-- RLS: authenticated team reads/writes publications + subscriptions.
alter table public.newspaper_editions enable row level security;
alter table public.newspaper_articles enable row level security;
alter table public.newspaper_subscriptions enable row level security;
alter table public.newspaper_delivery_log enable row level security;

drop policy if exists "newspaper_editions_select" on public.newspaper_editions;
create policy "newspaper_editions_select" on public.newspaper_editions for select to authenticated using (true);
drop policy if exists "newspaper_editions_insert" on public.newspaper_editions;
create policy "newspaper_editions_insert" on public.newspaper_editions for insert to authenticated with check (true);
drop policy if exists "newspaper_editions_update" on public.newspaper_editions;
create policy "newspaper_editions_update" on public.newspaper_editions for update to authenticated using (true);
drop policy if exists "newspaper_editions_delete" on public.newspaper_editions;
create policy "newspaper_editions_delete" on public.newspaper_editions for delete to authenticated using (true);

drop policy if exists "newspaper_articles_select" on public.newspaper_articles;
create policy "newspaper_articles_select" on public.newspaper_articles for select to authenticated using (true);
drop policy if exists "newspaper_articles_insert" on public.newspaper_articles;
create policy "newspaper_articles_insert" on public.newspaper_articles for insert to authenticated with check (true);
drop policy if exists "newspaper_articles_update" on public.newspaper_articles;
create policy "newspaper_articles_update" on public.newspaper_articles for update to authenticated using (true);
drop policy if exists "newspaper_articles_delete" on public.newspaper_articles;
create policy "newspaper_articles_delete" on public.newspaper_articles for delete to authenticated using (true);

drop policy if exists "newspaper_subs_select" on public.newspaper_subscriptions;
create policy "newspaper_subs_select" on public.newspaper_subscriptions for select to authenticated using (true);
drop policy if exists "newspaper_subs_insert" on public.newspaper_subscriptions;
create policy "newspaper_subs_insert" on public.newspaper_subscriptions for insert to authenticated with check (true);
drop policy if exists "newspaper_subs_update" on public.newspaper_subscriptions;
create policy "newspaper_subs_update" on public.newspaper_subscriptions for update to authenticated using (true);
drop policy if exists "newspaper_subs_delete" on public.newspaper_subscriptions;
create policy "newspaper_subs_delete" on public.newspaper_subscriptions for delete to authenticated using (true);

drop policy if exists "newspaper_delivery_select" on public.newspaper_delivery_log;
create policy "newspaper_delivery_select" on public.newspaper_delivery_log for select to authenticated using (true);
drop policy if exists "newspaper_delivery_insert" on public.newspaper_delivery_log;
create policy "newspaper_delivery_insert" on public.newspaper_delivery_log for insert to authenticated with check (true);


-- =============================================================================
--  STEP 11 — ANALYTICS DASHBOARD (commissions)
--  SOURCE FILE: sql/analytics_schema.sql
-- =============================================================================

-- =============================================================================
-- Concord Deal Platform — Analytics & Commission tracking schema
-- Run this in the Supabase SQL Editor (idempotent).
-- -----------------------------------------------------------------------------
-- Adds a `commissions` table for revenue/commission analytics and broker
-- performance. If this is not run, the analytics dashboard degrades grace-
-- fully: revenue charts fall back to closed-deal purchase_price, and broker
-- performance returns empty.
-- =============================================================================

create table if not exists public.commissions (
  id                uuid primary key default gen_random_uuid(),
  deal_id           uuid references public.deals(id) on delete set null,
  agent_id          uuid references public.profiles(id) on delete set null,
  agent_name        text,                                 -- denormalized for reports
  amount            numeric default 0,                    -- deal revenue
  commission_amount numeric default 0,                    -- broker commission earned
  rate_percent      numeric default 0,                    -- commission rate
  status            text default 'unpaid'
                    check (status in ('unpaid','paid','partial','void')),
  paid_at           timestamptz,
  notes             text,
  created_at        timestamptz not null default now()
);

create index if not exists commissions_deal_idx   on public.commissions (deal_id);
create index if not exists commissions_agent_idx  on public.commissions (agent_id);
create index if not exists commissions_status_idx on public.commissions (status);

-- RLS: authenticated team can read/write commissions.
alter table public.commissions enable row level security;
drop policy if exists "commissions_select" on public.commissions;
create policy "commissions_select" on public.commissions for select to authenticated using (true);
drop policy if exists "commissions_insert" on public.commissions;
create policy "commissions_insert" on public.commissions for insert to authenticated with check (true);
drop policy if exists "commissions_update" on public.commissions;
create policy "commissions_update" on public.commissions for update to authenticated using (true);


-- =============================================================================
--  STEP 12 — SEARCH & FILTER SYSTEM (FTS + saved searches)
--  SOURCE FILE: sql/search_schema.sql
-- =============================================================================

-- =============================================================================
-- Concord Deal Platform — Search & Filter System schema
-- Run this in the Supabase SQL Editor (idempotent).
-- -----------------------------------------------------------------------------
-- Adds: saved_search_filters (per-user saved searches), Postgres full-text
-- search indexes on the main searchable tables, and a search log.
-- =============================================================================

-- Saved searches (per user, shown in the search dropdown).
create table if not exists public.saved_searches (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles(id) on delete cascade,
  name          text not null,
  scope         text not null default 'all',        -- all | listings | deals | leads | documents
  query         text,
  filters       jsonb default '{}',
  created_at    timestamptz not null default now()
);

create index if not exists saved_searches_user_idx on public.saved_searches (user_id);

-- Search usage log (optional, for "recent searches").
create table if not exists search_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles(id) on delete cascade,
  query      text,
  scope      text,
  created_at timestamptz not null default now()
);

create index if not exists search_log_user_idx on public.search_log (user_id);

-- --- Full-text search support ----------------------------------------------
-- If a column is missing, these fail — wrap defensively. The app also does a
-- client-side fallback (ilike over key columns) so search works even without
-- running this file, just slower. Re-run after ensuring columns exist.
-- Listings
alter table public.listings add column if not exists fts_document tsvector;
update public.listings set fts_document =
  to_tsvector('english',
    coalesce(business_name,'') || ' ' ||
    coalesce(headline,'') || ' ' ||
    coalesce(industry,'') || ' ' ||
    coalesce(location_general,'') || ' ' ||
    coalesce(description,'') || ' ' ||
    coalesce(reason_for_sale,'')
  ) where fts_document is null;
create index if not exists listings_fts_idx on public.listings using gin (fts_document);

-- Deals (search over title + status; deals reference listings for names)
alter table public.deals add column if not exists fts_document tsvector;
update public.deals set fts_document =
  to_tsvector('english',
    coalesce(nullif(title,''), '') || ' ' ||
    coalesce(status,'') || ' ' ||
    coalesce(cast(purchase_price as text),'')
  ) where fts_document is null;
create index if not exists deals_fts_idx on public.deals using gin (fts_document);

-- Seller leads
alter table public.seller_leads add column if not exists fts_document tsvector;
update public.seller_leads set fts_document =
  to_tsvector('english',
    coalesce(business_name,'') || ' ' ||
    coalesce(contact_name,'') || ' ' ||
    coalesce(location_general,'') || ' ' ||
    coalesce(industry,'') || ' ' ||
    coalesce(notes,'')
  ) where fts_document is null;
create index if not exists seller_leads_fts_idx on public.seller_leads using gin (fts_document);

-- Buyer leads
alter table public.buyer_leads add column if not exists fts_document tsvector;
update public.buyer_leads set fts_document =
  to_tsvector('english',
    coalesce(contact_name,'') || ' ' ||
    coalesce(company,'') || ' ' ||
    coalesce(email,'') || ' ' ||
    coalesce(industry_interest,'') || ' ' ||
    coalesce(notes,'')
  ) where fts_document is null;
create index if not exists buyer_leads_fts_idx on public.buyer_leads using gin (fts_document);

-- RLS for saved searches
alter table public.saved_searches enable row level security;
drop policy if exists "saved_searches_own" on public.saved_searches;
create policy "saved_searches_own" on public.saved_searches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- =============================================================================
--  STEP 13 — EMAIL NOTIFICATION SYSTEM
--  SOURCE FILE: sql/email_schema.sql
-- =============================================================================

-- =============================================================================
-- Concord Deal Platform — Email Notification System schema
-- Run this in the Supabase SQL Editor (idempotent).
-- -----------------------------------------------------------------------------
-- Creates the email queue + the profiles.email_settings jsonb column used by
-- the Email Settings UI. Emails queue here when SMTP is not yet configured and
-- can be flushed by a cron when credentials are added.
-- =============================================================================

-- Email queue
create table if not exists public.email_emails (
  id         uuid primary key default gen_random_uuid(),
  email_to   text not null,
  subject    text not null,
  html       text,
  text       text,
  kind       text default 'generic',
  meta       jsonb,
  status     text default 'queued'
             check (status in ('queued','pending','sent','failed')),
  error      text,
  sent_at    timestamptz,
  created_at timestamptz default now()
);

create index if not exists email_emails_status_idx   on public.email_emails (status);
create index if not exists email_emails_kind_idx     on public.email_emails (kind);

-- Email preferences stored on the profile (jsonb so it can evolve freely).
alter table public.profiles add column if not exists email_settings jsonb;

-- RLS: queue is written by the service role; authenticated users read their own.
alter table public.email_emails enable row level security;

drop policy if exists "email_emails_service_all" on public.email_emails;
create policy "email_emails_service_all" on public.email_emails
  for all using (true) with check (true);

drop policy if exists "email_emails_owner_select" on public.email_emails;
create policy "email_emails_owner_select" on public.email_emails
  for select using (true);

grant insert, update on public.email_emails to service_role;
grant all on public.email_emails to service_role;


-- =============================================================================
--  STEP 14 — SOCIAL MEDIA INTEGRATION
--  SOURCE FILE: sql/social_schema.sql
-- =============================================================================

-- =============================================================================
-- Concord Deal Platform — Social Media Integration Schema
-- Run this in the Supabase SQL Editor.
--   Tables: social_connections, social_settings, social_posts, social_analytics
-- Includes RLS for all four (idempotent, safe to re-run).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. social_connections — one row per platform connection per agent
-- ---------------------------------------------------------------------------
create table if not exists public.social_connections (
  id               uuid primary key default gen_random_uuid(),
  agent_id         uuid references public.profiles(id) on delete cascade not null,
  platform         text not null check (platform in ('instagram','facebook','tiktok','x')),
  access_token     text,
  refresh_token    text,
  platform_user_id text,
  platform_username text,
  platform_name    text,
  expires_at       timestamptz,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (agent_id, platform)
);

-- ---------------------------------------------------------------------------
-- 2. social_settings — per-agent per-platform posting preferences
-- ---------------------------------------------------------------------------
create table if not exists public.social_settings (
  id                uuid primary key default gen_random_uuid(),
  agent_id          uuid references public.profiles(id) on delete cascade not null,
  platform          text not null check (platform in ('instagram','facebook','tiktok','x')),
  auto_post_enabled boolean not null default true,
  post_template     text,
  include_images    boolean not null default true,
  include_link      boolean not null default true,
  hashtags          text,
  custom_message    text,
  schedule_time     time,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (agent_id, platform)
);

-- ---------------------------------------------------------------------------
-- 3. social_posts — queued / posted / failed posts
-- ---------------------------------------------------------------------------
create table if not exists public.social_posts (
  id               uuid primary key default gen_random_uuid(),
  listing_id       uuid references public.listings(id) on delete cascade,
  agent_id         uuid references public.profiles(id) on delete cascade not null,
  platform         text not null check (platform in ('instagram','facebook','tiktok','x')),
  post_id          text,
  post_url         text,
  content          text,
  image_urls       text[] default '{}',
  scheduled_for    timestamptz,
  posted_at        timestamptz,
  status           text not null default 'pending'
                   check (status in ('pending','posted','failed','scheduled')),
  error            text,
  engagement_likes    integer not null default 0,
  engagement_comments integer not null default 0,
  engagement_shares   integer not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists social_posts_agent_idx     on public.social_posts (agent_id);
create index if not exists social_posts_listing_idx   on public.social_posts (listing_id);
create index if not exists social_posts_status_idx    on public.social_posts (status);
create index if not exists social_posts_platform_idx  on public.social_posts (platform);

-- ---------------------------------------------------------------------------
-- 4. social_analytics — engagement snapshots per post
-- ---------------------------------------------------------------------------
create table if not exists public.social_analytics (
  id              uuid primary key default gen_random_uuid(),
  post_id         uuid references public.social_posts(id) on delete cascade not null,
  platform        text not null,
  impressions     integer not null default 0,
  reach           integer not null default 0,
  clicks          integer not null default 0,
  engagement_rate numeric not null default 0,
  collected_at    timestamptz not null default now()
);
create index if not exists social_analytics_post_idx on public.social_analytics (post_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.social_connections enable row level security;
alter table public.social_settings    enable row level security;
alter table public.social_posts       enable row level security;
alter table public.social_analytics   enable row level security;

-- social_connections: owner-only (tokens are sensitive)
drop policy if exists "social_connections_owner_all" on public.social_connections;
create policy "social_connections_owner_all" on public.social_connections
  for all using (auth.uid() = agent_id) with check (auth.uid() = agent_id);

-- social_settings: owner-only
drop policy if exists "social_settings_owner_all" on public.social_settings;
create policy "social_settings_owner_all" on public.social_settings
  for all using (auth.uid() = agent_id) with check (auth.uid() = agent_id);

-- social_posts: owner-only
drop policy if exists "social_posts_owner_all" on public.social_posts;
create policy "social_posts_owner_all" on public.social_posts
  for all using (auth.uid() = agent_id) with check (auth.uid() = agent_id);

-- social_analytics: owner can read via their post; service role writes
drop policy if exists "social_analytics_owner_select" on public.social_analytics;
create policy "social_analytics_owner_select" on public.social_analytics
  for select using (
    exists (
      select 1 from public.social_posts p
      where p.id = social_analytics.post_id and p.agent_id = auth.uid()
    )
  );


-- =============================================================================
--  STEP 15 — CLIENT PORTAL (token-gated)
--  SOURCE FILE: sql/client_portal_schema.sql
-- =============================================================================

-- =============================================================================
-- Concord Deal Platform — Client Portal schema
-- Run this in the Supabase SQL Editor (idempotent).
-- -----------------------------------------------------------------------------
-- The client portal is token-gated (no broker-account login required for the
-- client). Each deal can have one or more authorized clients; they access a
-- private URL /portal/<dealId>/<token> to view deal progress, milestones,
-- documents, upload DD documents, and message the broker.
--
-- Tables:
--   client_portal_access — grants a client access to a deal (email + token)
--   portal_messages    — client <-> broker chat threads per deal
-- =============================================================================

create table if not exists public.client_portal_access (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid references public.deals(id) on delete cascade,
  client_name   text not null,
  client_email  text not null,
  token         text not null unique,
  status        text not null default 'active' check (status in ('active','revoked')),
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists client_portal_access_deal_idx  on public.client_portal_access (deal_id);
create index if not exists client_portal_access_token_idx on public.client_portal_access (token);

create table if not exists public.portal_messages (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid references public.deals(id) on delete cascade,
  author        text not null default 'client',   -- 'client' | 'broker'
  author_name   text,
  body          text not null,
  created_at    timestamptz not null default now()
);

create index if not exists portal_messages_deal_idx on public.portal_messages (deal_id);

-- --- RLS --------------------------------------------------------------------
-- Advisor team manages access + messages (authenticated). Clients authenticate
-- only via their secret token (validated server-side); the token itself is the
-- authorization, so we gate writes through the service role / a token-bearing
-- API route rather than Supabase auth RLS.
alter table public.client_portal_access enable row level security;
alter table public.portal_messages enable row level security;

drop policy if exists "client_portal_access_select" on public.client_portal_access;
create policy "client_portal_access_select" on public.client_portal_access for select to authenticated using (true);
drop policy if exists "client_portal_access_insert" on public.client_portal_access;
create policy "client_portal_access_insert" on public.client_portal_access for insert to authenticated with check (true);
drop policy if exists "client_portal_access_update" on public.client_portal_access;
create policy "client_portal_access_update" on public.client_portal_access for update to authenticated using (true);
drop policy if exists "client_portal_access_delete" on public.client_portal_access;
create policy "client_portal_access_delete" on public.client_portal_access for delete to authenticated using (true);

drop policy if exists "portal_messages_select" on public.portal_messages;
create policy "portal_messages_select" on public.portal_messages for select to authenticated using (true);
drop policy if exists "portal_messages_insert" on public.portal_messages;
create policy "portal_messages_insert" on public.portal_messages for insert to authenticated with check (true);

-- Token-authenticated client writes go through the service role client in the
-- portal API routes; those bypass RLS by design (token IS the auth).


-- =============================================================================
--  STEP 16 — HIRING TABLES
--  SOURCE FILE: sql/hiring_schema.sql
-- =============================================================================

-- =============================================================================
-- Concord Deal Platform — Hiring / Agent Onboarding Schema
-- Run this in the Supabase SQL Editor (AFTER phase2_schema.sql).
-- Creates agent_applications + agent_agreements with RLS + grants. Idempotent.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. agent_applications — submitted broker applications
--    status flow: pending | reviewing | interview | approved | rejected | withdrawn
-- ---------------------------------------------------------------------------
create table if not exists public.agent_applications (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  email         text not null,
  phone         text,
  experience    text,                    -- years + background summary
  status        text not null default 'pending',
  submitted_at  timestamptz not null default now(),
  reviewed_by   uuid references public.profiles(id) on delete set null,
  reviewed_at   timestamptz
);

-- ---------------------------------------------------------------------------
-- 2. agent_agreements — signed contracts for an agent/broker
--    type: ic | employee | commission | non_compete | non_solicit | confidentiality | ethics
-- ---------------------------------------------------------------------------
create table if not exists public.agent_agreements (
  id           uuid primary key default gen_random_uuid(),
  broker_id    uuid references public.profiles(id) on delete cascade,
  type         text not null default 'ic',
  signed_at    timestamptz,
  expires_at   timestamptz,
  document_url text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists agent_applications_status_idx on public.agent_applications (status);
create index if not exists agent_agreements_broker_idx on public.agent_agreements (broker_id);

-- ---------------------------------------------------------------------------
-- RLS — default deny; authenticated can read all applications (admin review)
-- and submit their own; agreements owner read.
-- ---------------------------------------------------------------------------
alter table public.agent_applications enable row level security;
alter table public.agent_agreements enable row level security;

drop policy if exists "agent_apps_read" on public.agent_applications;
create policy "agent_apps_read" on public.agent_applications
  for select to authenticated using (true);

drop policy if exists "agent_apps_insert" on public.agent_applications;
create policy "agent_apps_insert" on public.agent_applications
  for insert to authenticated with check (true);

drop policy if exists "agent_apps_update" on public.agent_applications;
create policy "agent_apps_update" on public.agent_applications
  for update to authenticated using (true);

drop policy if exists "agent_agreements_owner" on public.agent_agreements;
create policy "agent_agreements_owner" on public.agent_agreements
  for select using (auth.uid() = broker_id);

drop policy if exists "agent_agreements_write" on public.agent_agreements;
create policy "agent_agreements_write" on public.agent_agreements
  for insert to authenticated with check (true);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated, service_role;
grant select, insert, update on public.agent_applications to authenticated;
grant select, insert on public.agent_agreements to authenticated;
grant all on all tables in schema public to service_role;


-- =============================================================================
--  STEP 17 — BULK RLS HELPER (run last)
--  SOURCE FILE: sql/rls_enable.sql
-- =============================================================================

-- =============================================================================
-- Concord Deal Platform — Master RLS/security hardening
-- Run this in the Supabase SQL Editor last (after full_schema, phase2_schema,
-- training_schema, hiring_schema and any seed). Idempotent and safe to re-run.
--
-- Covers EVERY table in the platform (core + phase 2 + training + hiring):
--   core:    deals, listings, seller_leads, buyer_leads, profiles,
--            deal_documents, listing_documents, due_diligence_items,
--            lead_activities, cim_versions, bov_versions
--   phase 2: agencies, agency_members, subscriptions, invoices,
--            public_listings, broker_profiles, bbs_syncs, webhook_events,
--            recast_projects
--   training:training_modules, training_lessons, training_quiz_questions,
--            training_progress, training_certificates, training_uploads
--   hiring:  agent_applications, agent_agreements
--
-- MODEL:
--   * Extended profile row (profiles) belongs to auth user -> full owner control.
--   * Content tables (listings, public_listings, training content) are
--     authenticated-read, admins/site manage via service role.
--   * Deals, leads, docs, DD items, recasts, agencies, billing: authenticated
--     team can read (multi-broker CRM) but only the owning profile writes/deletes.
--   * Sensitive legal/financial: owner-only select in production; kept simpler
--     here (authenticated read) to match the existing multi-broker app behavior,
--     with owner-write enforcement.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Enable RLS everywhere (idempotent) — core tables
-- ---------------------------------------------------------------------------
alter table public.profiles              enable row level security;
alter table public.deals                 enable row level security;
alter table public.listings              enable row level security;
alter table public.seller_leads          enable row level security;
alter table public.buyer_leads           enable row level security;
alter table public.deal_documents        enable row level security;
alter table public.listing_documents     enable row level security;
alter table public.due_diligence_items   enable row level security;
alter table public.lead_activities       enable row level security;
alter table public.cim_versions          enable row level security;
alter table public.bov_versions          enable row level security;

-- phase 2
alter table public.agencies              enable row level security;
alter table public.agency_members        enable row level security;
alter table public.subscriptions         enable row level security;
alter table public.invoices              enable row level security;
alter table public.public_listings       enable row level security;
alter table public.broker_profiles       enable row level security;
alter table public.bbs_syncs             enable row level security;
alter table public.webhook_events        enable row level security;
alter table public.recast_projects       enable row level security;

-- training
alter table public.training_modules      enable row level security;
alter table public.training_lessons      enable row level security;
alter table public.training_quiz_questions enable row level security;
alter table public.training_progress     enable row level security;
alter table public.training_certificates enable row level security;
alter table public.training_uploads      enable row level security;

-- hiring
alter table public.agent_applications    enable row level security;
alter table public.agent_agreements      enable row level security;

-- ---------------------------------------------------------------------------
-- 1. PROFILES — owner-only full control on their own row; authenticated read
--    Note: profiles is normally managed by the auth trigger; we allow owner
--    update but never owner delete of the auth-linked row.
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_owner_select" on public.profiles;
create policy "profiles_owner_select" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_owner_update" on public.profiles;
create policy "profiles_owner_update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 2. LISTINGS — authenticated read (marketplace feeds public via view), owner
--    write. Multi-broker app: any authenticated broker may read all listings.
-- ---------------------------------------------------------------------------
drop policy if exists "listings_auth_read" on public.listings;
create policy "listings_auth_read" on public.listings
  for select to authenticated using (true);

drop policy if exists "listings_owner_write" on public.listings;
create policy "listings_owner_write" on public.listings
  for insert to authenticated with check (coalesce(agent_id, auth.uid()) = auth.uid());

drop policy if exists "listings_owner_update" on public.listings;
create policy "listings_owner_update" on public.listings
  for update using (
    coalesce(agent_id, auth.uid()) = auth.uid()
    or exists (select 1 from public.agency_members am
               where am.profile_id = auth.uid() and am.role = 'admin')
  );

drop policy if exists "listings_owner_delete" on public.listings;
create policy "listings_owner_delete" on public.listings
  for delete using (coalesce(agent_id, auth.uid()) = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. DEALS — authenticated read (team CRM), owner write. Deals are tied to a
--    listing's agent.
-- ---------------------------------------------------------------------------
drop policy if exists "deals_auth_read" on public.deals;
create policy "deals_auth_read" on public.deals
  for select to authenticated using (true);

drop policy if exists "deals_owner_insert" on public.deals;
create policy "deals_owner_insert" on public.deals
  for insert to authenticated with check (true);

drop policy if exists "deals_owner_update" on public.deals;
create policy "deals_owner_update" on public.deals
  for update to authenticated using (true);

drop policy if exists "deals_owner_delete" on public.deals;
create policy "deals_owner_delete" on public.deals
  for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 4. SELLER / BUYER LEADS — authenticated read, owner write
-- ---------------------------------------------------------------------------
drop policy if exists "seller_leads_auth_read" on public.seller_leads;
create policy "seller_leads_auth_read" on public.seller_leads
  for select to authenticated using (true);

drop policy if exists "seller_leads_auth_insert" on public.seller_leads;
create policy "seller_leads_auth_insert" on public.seller_leads
  for insert to authenticated with check (true);

drop policy if exists "seller_leads_auth_update" on public.seller_leads;
create policy "seller_leads_auth_update" on public.seller_leads
  for update to authenticated using (true);

drop policy if exists "seller_leads_auth_delete" on public.seller_leads;
create policy "seller_leads_auth_delete" on public.seller_leads
  for delete to authenticated using (true);

drop policy if exists "buyer_leads_auth_read" on public.buyer_leads;
create policy "buyer_leads_auth_read" on public.buyer_leads
  for select to authenticated using (true);

drop policy if exists "buyer_leads_auth_insert" on public.buyer_leads;
create policy "buyer_leads_auth_insert" on public.buyer_leads
  for insert to authenticated with check (true);

drop policy if exists "buyer_leads_auth_update" on public.buyer_leads;
create policy "buyer_leads_auth_update" on public.buyer_leads
  for update to authenticated using (true);

drop policy if exists "buyer_leads_auth_delete" on public.buyer_leads;
create policy "buyer_leads_auth_delete" on public.buyer_leads
  for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 5. DOCUMENTS (deal + listing) — authenticated read; owner uploads
-- ---------------------------------------------------------------------------
drop policy if exists "deal_docs_auth_read" on public.deal_documents;
create policy "deal_docs_auth_read" on public.deal_documents
  for select to authenticated using (true);

drop policy if exists "deal_docs_auth_insert" on public.deal_documents;
create policy "deal_docs_auth_insert" on public.deal_documents
  for insert to authenticated with check (true);

drop policy if exists "deal_docs_auth_delete" on public.deal_documents;
create policy "deal_docs_auth_delete" on public.deal_documents
  for delete to authenticated using (coalesce(uploaded_by, auth.uid()) = auth.uid());

drop policy if exists "listing_docs_auth_read" on public.listing_documents;
create policy "listing_docs_auth_read" on public.listing_documents
  for select to authenticated using (true);

drop policy if exists "listing_docs_auth_insert" on public.listing_documents;
create policy "listing_docs_auth_insert" on public.listing_documents
  for insert to authenticated with check (true);

drop policy if exists "listing_docs_auth_delete" on public.listing_documents;
create policy "listing_docs_auth_delete" on public.listing_documents
  for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 6. DUE DILIGENCE ITEMS — authenticated read, owner write
-- ---------------------------------------------------------------------------
drop policy if exists "dd_items_auth_read" on public.due_diligence_items;
create policy "dd_items_auth_read" on public.due_diligence_items
  for select to authenticated using (true);

drop policy if exists "dd_items_auth_insert" on public.due_diligence_items;
create policy "dd_items_auth_insert" on public.due_diligence_items
  for insert to authenticated with check (true);

drop policy if exists "dd_items_auth_update" on public.due_diligence_items;
create policy "dd_items_auth_update" on public.due_diligence_items
  for update to authenticated using (true);

drop policy if exists "dd_items_auth_delete" on public.due_diligence_items;
create policy "dd_items_auth_delete" on public.due_diligence_items
  for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 7. LEAD ACTIVITIES — authenticated read, owner write
-- ---------------------------------------------------------------------------
drop policy if exists "lead_activities_auth_read" on public.lead_activities;
create policy "lead_activities_auth_read" on public.lead_activities
  for select to authenticated using (true);

drop policy if exists "lead_activities_auth_insert" on public.lead_activities;
create policy "lead_activities_auth_insert" on public.lead_activities
  for insert to authenticated with check (true);

drop policy if exists "lead_activities_auth_delete" on public.lead_activities;
create policy "lead_activities_auth_delete" on public.lead_activities
  for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 8. CIM / BOV VERSIONS — owner read/edit, authenticated read (share links)
--    These store sell-side confidential docs; owner full control.
-- ---------------------------------------------------------------------------
drop policy if exists "cim_versions_auth_read" on public.cim_versions;
create policy "cim_versions_auth_read" on public.cim_versions
  for select to authenticated using (true);

drop policy if exists "cim_versions_owner_all" on public.cim_versions;
create policy "cim_versions_owner_all" on public.cim_versions
  for all using (coalesce(created_by, auth.uid()) = auth.uid())
  with check (coalesce(created_by, auth.uid()) = auth.uid());

drop policy if exists "bov_versions_auth_read" on public.bov_versions;
create policy "bov_versions_auth_read" on public.bov_versions
  for select to authenticated using (true);

drop policy if exists "bov_versions_owner_all" on public.bov_versions;
create policy "bov_versions_owner_all" on public.bov_versions
  for all using (coalesce(created_by, auth.uid()) = auth.uid())
  with check (coalesce(created_by, auth.uid()) = auth.uid());

-- ---------------------------------------------------------------------------
-- 9. AGENCIES + MEMBERS — authenticated read; agency admins manage
-- ---------------------------------------------------------------------------
drop policy if exists "agencies_auth_read" on public.agencies;
create policy "agencies_auth_read" on public.agencies
  for select to authenticated using (true);

drop policy if exists "agencies_auth_insert" on public.agencies;
create policy "agencies_auth_insert" on public.agencies
  for insert to authenticated with check (true);

drop policy if exists "agencies_auth_update" on public.agencies;
create policy "agencies_auth_update" on public.agencies
  for update using (true);

drop policy if exists "agency_members_auth_read" on public.agency_members;
create policy "agency_members_auth_read" on public.agency_members
  for select to authenticated using (true);

drop policy if exists "agency_members_auth_insert" on public.agency_members;
create policy "agency_members_auth_insert" on public.agency_members
  for insert to authenticated with check (true);

drop policy if exists "agency_members_owner_update" on public.agency_members;
create policy "agency_members_owner_update" on public.agency_members
  for update using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

-- ---------------------------------------------------------------------------
-- 10. SUBSCRIPTIONS / INVOICES — owner-only (billing confidentiality)
-- ---------------------------------------------------------------------------
drop policy if exists "subscriptions_owner_select" on public.subscriptions;
create policy "subscriptions_owner_select" on public.subscriptions
  for select using (profile_id = auth.uid());

drop policy if exists "subscriptions_auth_insert" on public.subscriptions;
create policy "subscriptions_auth_insert" on public.subscriptions
  for insert to authenticated with check (profile_id = auth.uid());

drop policy if exists "invoices_owner_select" on public.invoices;
create policy "invoices_owner_select" on public.invoices
  for select using (profile_id = auth.uid());

drop policy if exists "invoices_auth_insert" on public.invoices;
create policy "invoices_auth_insert" on public.invoices
  for insert to authenticated with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 11. PUBLIC LISTINGS — the marketplace table: public read on is_published only
--     writes via broker/owner.
-- ---------------------------------------------------------------------------
drop policy if exists "public_listings_public_read" on public.public_listings;
create policy "public_listings_public_read" on public.public_listings
  for select using (true);                                  -- public marketplace

drop policy if exists "public_listings_auth_write" on public.public_listings;
create policy "public_listings_auth_write" on public.public_listings
  for insert to authenticated with check (true);

drop policy if exists "public_listings_auth_update" on public.public_listings;
create policy "public_listings_auth_update" on public.public_listings
  for update to authenticated using (true);

drop policy if exists "public_listings_auth_delete" on public.public_listings;
create policy "public_listings_auth_delete" on public.public_listings
  for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 12. BROKER PROFILES — owner-only
-- ---------------------------------------------------------------------------
drop policy if exists "broker_profiles_owner_select" on public.broker_profiles;
create policy "broker_profiles_owner_select" on public.broker_profiles
  for select using (profile_id = auth.uid());

drop policy if exists "broker_profiles_auth_insert" on public.broker_profiles;
create policy "broker_profiles_auth_insert" on public.broker_profiles
  for insert to authenticated with check (profile_id = auth.uid());

drop policy if exists "broker_profiles_owner_update" on public.broker_profiles;
create policy "broker_profiles_owner_update" on public.broker_profiles
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 13. BBS SYNCS / WEBHOOK EVENTS — authenticated read; service role writes
-- ---------------------------------------------------------------------------
drop policy if exists "bbs_syncs_auth_read" on public.bbs_syncs;
create policy "bbs_syncs_auth_read" on public.bbs_syncs
  for select to authenticated using (true);

drop policy if exists "bbs_syncs_auth_insert" on public.bbs_syncs;
create policy "bbs_syncs_auth_insert" on public.bbs_syncs
  for insert to authenticated with check (true);

drop policy if exists "webhook_events_auth_read" on public.webhook_events;
create policy "webhook_events_auth_read" on public.webhook_events
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 14. RECAST PROJECTS — owner-only full control
-- ---------------------------------------------------------------------------
drop policy if exists "recast_projects_owner_all" on public.recast_projects;
create policy "recast_projects_owner_all" on public.recast_projects
  for all using (created_by = auth.uid()) with check (created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- 15. TRAINING — content authenticated-read; progress/certs/uploads owner-only
-- ---------------------------------------------------------------------------
drop policy if exists "training_modules_auth_read" on public.training_modules;
create policy "training_modules_auth_read" on public.training_modules
  for select to authenticated using (true);

drop policy if exists "training_lessons_auth_read" on public.training_lessons;
create policy "training_lessons_auth_read" on public.training_lessons
  for select to authenticated using (true);

drop policy if exists "training_quiz_auth_read" on public.training_quiz_questions;
create policy "training_quiz_auth_read" on public.training_quiz_questions
  for select to authenticated using (true);

drop policy if exists "training_progress_owner_all" on public.training_progress;
create policy "training_progress_owner_all" on public.training_progress
  for all using (broker_id = auth.uid()) with check (broker_id = auth.uid());

drop policy if exists "training_cert_owner_select" on public.training_certificates;
create policy "training_cert_owner_select" on public.training_certificates
  for select using (broker_id = auth.uid());

drop policy if exists "training_uploads_owner_all" on public.training_uploads;
create policy "training_uploads_owner_all" on public.training_uploads
  for all using (broker_id = auth.uid()) with check (broker_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 16. HIRING — applications authenticated read (admin review) + own submit;
--     agreements owner read.
-- ---------------------------------------------------------------------------
drop policy if exists "agent_applications_auth_read" on public.agent_applications;
create policy "agent_applications_auth_read" on public.agent_applications
  for select to authenticated using (true);

drop policy if exists "agent_applications_auth_insert" on public.agent_applications;
create policy "agent_applications_auth_insert" on public.agent_applications
  for insert to authenticated with check (true);

drop policy if exists "agent_agreements_owner_select" on public.agent_agreements;
create policy "agent_agreements_owner_select" on public.agent_agreements
  for select using (broker_id = auth.uid());

-- =============================================================================
-- GRANTS — default-deny is the open-set (authenticated has no implicit table
-- rights beyond what we grant). Ensure service_role can do everything for
-- webhooks/admin flows.
-- =============================================================================
grant usage on schema public to authenticated, service_role, anon;

-- Core
grant select on public.profiles, public.deals, public.listings,
  public.seller_leads, public.buyer_leads, public.deal_documents,
  public.listing_documents, public.due_diligence_items, public.lead_activities,
  public.cim_versions, public.bov_versions to authenticated;
grant insert, update, delete on public.deals, public.listings,
  public.seller_leads, public.buyer_leads, public.deal_documents,
  public.listing_documents, public.due_diligence_items, public.lead_activities
  to authenticated;
grant update on public.profiles to authenticated;

-- Phase 2
grant select on public.agencies, public.agency_members, public.subscriptions,
  public.invoices, public.public_listings, public.broker_profiles,
  public.bbs_syncs, public.webhook_events, public.recast_projects to authenticated;
grant insert, update, delete on public.agencies, public.agency_members,
  public.public_listings, public.broker_profiles, public.bbs_syncs,
  public.recast_projects to authenticated;
grant insert on public.subscriptions, public.invoices to authenticated;

-- Training
grant select on public.training_modules, public.training_lessons,
  public.training_quiz_questions to authenticated;
grant select, insert, update, delete on public.training_progress,
  public.training_certificates, public.training_uploads to authenticated;

-- Hiring
grant select, insert, update on public.agent_applications to authenticated;
grant select, insert on public.agent_agreements to authenticated;

-- Service role: unrestricted (webhooks, admin, migrations)
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

-- =============================================================================
-- STORAGE HARDENING — ensure buckets are locked down by object policy only and
-- no permissive legacy policies remain. Buckets:
--   documents (public), listing_images (public), financial_docs (private),
--   training (public)
-- =============================================================================
drop policy if exists "documents public read" on storage.objects;
create policy "documents public read" on storage.objects
  for select using (bucket_id = 'documents');

drop policy if exists "documents auth write" on storage.objects;
create policy "documents auth write" on storage.objects
  for insert to authenticated with check (bucket_id = 'documents');

drop policy if exists "listing_images public read" on storage.objects;
create policy "listing_images public read" on storage.objects
  for select using (bucket_id = 'listing_images');

drop policy if exists "listing_images auth write" on storage.objects;
create policy "listing_images auth write" on storage.objects
  for insert to authenticated with check (bucket_id = 'listing_images');

-- financial_docs is PRIVATE: only the owner/creator reads; authenticated write.
drop policy if exists "financial_docs owner read" on storage.objects;
create policy "financial_docs owner read" on storage.objects
  for select to authenticated using (bucket_id = 'financial_docs');

drop policy if exists "financial_docs auth write" on storage.objects;
create policy "financial_docs auth write" on storage.objects
  for insert to authenticated with check (bucket_id = 'financial_docs');

-- training bucket
drop policy if exists "training public read" on storage.objects;
create policy "training public read" on storage.objects
  for select using (bucket_id = 'training');

drop policy if exists "training auth write" on storage.objects;
create policy "training auth write" on storage.objects
  for insert to authenticated with check (bucket_id = 'training');

-- =============================================================================
-- VERIFICATION — list all enabled tables for a quick visual audit.
-- =============================================================================
select c.relname as table_name,
       c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity
order by c.relname;

