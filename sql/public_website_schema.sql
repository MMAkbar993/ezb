-- =============================================================================
-- CONCORD DEAL PLATFORM — Public Website Schema (2026-08-10)
-- =============================================================================
-- Adds the safe public-projection layer for the business-for-sale website:
--   1. listings.review_stage — internal draft/internal_review/approved gate,
--      separate from the existing operational `status` lifecycle.
--   2. public_listings — extended with confidentiality/display-control columns
--      (the table already existed from phase2_schema.sql but was unused).
--   3. public_listing_feed — a view that is the ONLY safe public read path.
--      It never selects agent_id, property_address/city/state/zip, or
--      financial figures unless the broker explicitly opted in per listing.
--
-- Run this ONCE in the Supabase SQL Editor. Idempotent (safe to re-run).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. listings.review_stage — internal approval gate (independent of `status`)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='listings' and column_name='review_stage') then
    alter table public.listings add column review_stage text not null default 'draft';
  end if;
end $$;

alter table public.listings drop constraint if exists listings_review_stage_check;
alter table public.listings add constraint listings_review_stage_check check (
  review_stage in ('draft','internal_review','approved')
);

-- ---------------------------------------------------------------------------
-- 2. public_listings — create if missing (originally from phase2_schema.sql,
--    which was never applied to this database), then add the
--    confidentiality/display-control columns this migration needs.
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

alter table public.public_listings enable row level security;

-- Baseline public read policy (published-only). The authenticated read-all +
-- write policies are added further below.
drop policy if exists "public listings read" on public.public_listings;
create policy "public listings read" on public.public_listings
  for select using (published = true);

do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='public_listings' and column_name='is_confidential') then
    alter table public.public_listings add column is_confidential boolean not null default false;
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='public_listings' and column_name='public_title') then
    alter table public.public_listings add column public_title text;
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='public_listings' and column_name='show_financials') then
    alter table public.public_listings add column show_financials boolean not null default false;
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='public_listings' and column_name='show_exact_location') then
    alter table public.public_listings add column show_exact_location boolean not null default false;
  end if;
end $$;

-- One public_listings row per listing — required for upsert-by-listing_id.
create unique index if not exists public_listings_listing_id_uniq on public.public_listings (listing_id);

-- Enforce: a listing can only be published to the website once it has been
-- internally approved. Defense in depth alongside the app-layer check in
-- lib/publicListing.ts.
create or replace function public.enforce_listing_approved_before_publish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.published = true then
    if not exists (
      select 1 from public.listings
      where id = new.listing_id and review_stage = 'approved'
    ) then
      raise exception 'Cannot publish listing to the public website until review_stage = approved (listing %)', new.listing_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_listing_approved on public.public_listings;
create trigger trg_enforce_listing_approved
  before insert or update on public.public_listings
  for each row execute function public.enforce_listing_approved_before_publish();

-- ---------------------------------------------------------------------------
-- RLS on public_listings — the table already has RLS enabled + a public
-- select policy (phase2_schema.sql: "public listings read", published=true).
-- Add authenticated read-all (so brokers can see their own drafts) and
-- authenticated write policies (team-wide model, consistent with every other
-- table in this schema — see sql/rls_enable.sql's "any authenticated broker"
-- convention).
-- ---------------------------------------------------------------------------
drop policy if exists "public_listings_auth_read" on public.public_listings;
create policy "public_listings_auth_read" on public.public_listings
  for select to authenticated using (true);

drop policy if exists "public_listings_auth_insert" on public.public_listings;
create policy "public_listings_auth_insert" on public.public_listings
  for insert to authenticated with check (true);

drop policy if exists "public_listings_auth_update" on public.public_listings;
create policy "public_listings_auth_update" on public.public_listings
  for update to authenticated using (true);

drop policy if exists "public_listings_auth_delete" on public.public_listings;
create policy "public_listings_auth_delete" on public.public_listings
  for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 3. public_listing_feed — the ONLY safe public read path
-- ---------------------------------------------------------------------------
-- security_invoker = false restores pre-PG15 view semantics: the view runs
-- with the privileges of its owner (the migration-running role), not the
-- querying role. Combined with `listings` having NO anon select policy, this
-- means anon/authenticated clients can read *only* through this curated
-- projection — never the base table directly.
--
-- NOTE: if your Postgres role that runs this migration does not have
-- BYPASSRLS (rare on Supabase's default setup), the view will still be
-- blocked by `listings` RLS for anon. Verify by querying
-- `select * from public.public_listing_feed limit 1;` using the anon key.
-- ---------------------------------------------------------------------------
drop view if exists public.public_listing_feed;
create view public.public_listing_feed
with (security_invoker = false)
as
select
  l.id,
  case
    when pl.is_confidential then coalesce(pl.public_title, l.industry || ' Business For Sale')
    else l.business_name
  end as business_name,
  l.headline,
  l.industry,
  l.location_general,
  l.description,
  l.reason_for_sale,
  l.asking_price,
  case when pl.show_financials then l.annual_revenue else null end as annual_revenue,
  case when pl.show_financials then l.sde else null end as sde,
  case when pl.show_financials then l.ebitda else null end as ebitda,
  case when pl.show_financials then l.inventory_value else null end as inventory_value,
  case when pl.show_financials then l.ffe_value else null end as ffe_value,
  l.real_estate_included,
  l.status,
  l.created_at,
  l.updated_at,
  l.image_urls,
  l.primary_image_url,
  l.featured_image_url,
  pl.slug,
  pl.is_featured,
  pl.is_confidential
from public.listings l
join public.public_listings pl on pl.listing_id = l.id
where l.status = 'active'
  and l.review_stage = 'approved'
  and pl.published = true;

grant select on public.public_listing_feed to anon, authenticated;

-- =============================================================================
-- DONE. This migration does not touch `listings` RLS (still authenticated-only,
-- unchanged) or any other table. The public website must query
-- `public_listing_feed` exclusively — never `listings` directly.
-- =============================================================================
