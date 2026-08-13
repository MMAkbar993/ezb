-- =============================================================================
-- CONCORD DEAL PLATFORM — Buyer Email Response Options (2026-08-13)
-- =============================================================================
-- Matches BizBuySell's per-listing "Buyer Email Response Options": broker
-- controls whether an inquiring buyer must give a phone/zip, and whether
-- they're asked their available funds / timeframe, before the inquiry goes
-- through. Settings live on public_listings (same table as the other
-- public-display controls); the two missing buyer_leads columns needed to
-- store the answers are added too.
--
-- Also fixes a real bug found while wiring this up: capturePublicLead()
-- (lib/marketplace.ts) was silently dropping the buyer's name, message, and
-- which listing they asked about on every public inquiry — only email/phone
-- were ever saved. Fixed in the same commit as this migration; no schema
-- change needed for that part since listing_id/full_name/message already
-- existed as columns and simply weren't being sent.
--
-- Run this ONCE in the Supabase SQL Editor. Idempotent.
-- =============================================================================

alter table public.public_listings
  add column if not exists require_buyer_phone boolean not null default false,
  add column if not exists require_buyer_zip boolean not null default false,
  add column if not exists ask_funds_available boolean not null default false,
  add column if not exists ask_buyer_timeframe boolean not null default false;

alter table public.buyer_leads
  add column if not exists zip text,
  add column if not exists timeframe text;

-- ---------------------------------------------------------------------------
-- public_listing_feed — expose the four response-option settings so the
-- public listing page knows what to require/ask.
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
  pl.is_confidential,
  pl.location_exposure,
  case when pl.location_exposure in ('city_state','full_address') then l.property_city else null end as property_city,
  case when pl.location_exposure in ('city_state','full_address') then l.property_state else null end as property_state,
  case when pl.location_exposure = 'full_address' then l.property_address else null end as property_address,
  case when pl.location_exposure = 'full_address' then l.property_zip else null end as property_zip,
  pl.require_buyer_phone,
  pl.require_buyer_zip,
  pl.ask_funds_available,
  pl.ask_buyer_timeframe
from public.listings l
join public.public_listings pl on pl.listing_id = l.id
where l.status = 'active'
  and l.review_stage = 'approved'
  and pl.published = true;

grant select on public.public_listing_feed to anon, authenticated;

-- =============================================================================
-- DONE.
-- =============================================================================
