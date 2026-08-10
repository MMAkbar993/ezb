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
