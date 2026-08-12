-- =============================================================================
-- CONCORD DEAL PLATFORM — Remaining BizBuySell-style listing fields (2026-08-12)
-- =============================================================================
-- Completes the field list from the brief §3 that wasn't covered by
-- sql/listing_operational_details.sql. `featured` is intentionally NOT added
-- here — public_listings.is_featured already serves that purpose (wired
-- into Step 8's "Feature on homepage" toggle).
--
-- Run this ONCE in the Supabase SQL Editor. Idempotent.
-- =============================================================================

alter table public.listings
  add column if not exists business_type text,
  add column if not exists sub_industry text,
  add column if not exists property_type text,
  add column if not exists real_estate_asking_price numeric,
  add column if not exists year_established int,
  add column if not exists hours_of_operation text,
  add column if not exists growth_potential text,
  add column if not exists competition text,
  add column if not exists market_position text,
  add column if not exists furniture_and_equipment_included boolean not null default false,
  add column if not exists inventory_included boolean not null default false;

comment on column public.listings.business_type is 'Broad category (e.g. Retail, Restaurants & Food, Automotive) — distinct from the more specific `industry` field, matching a BizBuySell-style category/sub-category split.';
comment on column public.listings.sub_industry is 'Finer-grained classification within `industry`.';
comment on column public.listings.real_estate_asking_price is 'What the real estate is being asked for, if priced separately from the business (distinct from property_value, an estimate/appraisal).';

-- =============================================================================
-- DONE.
-- =============================================================================
