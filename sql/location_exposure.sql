-- =============================================================================
-- CONCORD DEAL PLATFORM — Location Confidentiality & Search Exposure (2026-08-13)
-- =============================================================================
-- Replaces the all-or-nothing `show_exact_location` boolean with a 3-tier
-- control matching BizBuySell's "Location Confidentiality & Search Exposure"
-- pattern: general area only (default), city + state, or the full street
-- address. NOTE: `show_exact_location` was actually a no-op before this —
-- public_listing_feed never selected property_address/city/state/zip under
-- any condition, so the toggle existed in the UI but never changed what was
-- exposed. This migration is the first time exact-location exposure is
-- functionally wired up, not just a rename.
--
-- Run this ONCE in the Supabase SQL Editor. Idempotent.
-- =============================================================================

do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='public_listings' and column_name='location_exposure') then
    alter table public.public_listings add column location_exposure text not null default 'general';
  end if;
end $$;

alter table public.public_listings drop constraint if exists public_listings_location_exposure_check;
alter table public.public_listings add constraint public_listings_location_exposure_check check (
  location_exposure in ('general', 'city_state', 'full_address')
);

-- Migrate the old boolean's intent forward, then retire it. Guarded because
-- some environments never had this column in the first place (only created
-- by sql/public_website_schema.sql, which may not have run here).
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='public_listings' and column_name='show_exact_location') then
    update public.public_listings
      set location_exposure = 'full_address'
      where show_exact_location = true and location_exposure = 'general';
  end if;
end $$;

alter table public.public_listings drop column if exists show_exact_location;

-- ---------------------------------------------------------------------------
-- public_listing_feed — add conditional property_city/state/address/zip
-- exposure. agent_id and total_value are still never selected, under any
-- condition — unchanged from the original design.
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
  case when pl.location_exposure = 'full_address' then l.property_zip else null end as property_zip
from public.listings l
join public.public_listings pl on pl.listing_id = l.id
where l.status = 'active'
  and l.review_stage = 'approved'
  and pl.published = true;

grant select on public.public_listing_feed to anon, authenticated;

-- =============================================================================
-- DONE.
-- =============================================================================
