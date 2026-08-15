-- =============================================================================
-- CONCORD DEAL PLATFORM — Expose business_type on the public feed (2026-08-15)
-- =============================================================================
-- `business_type` (a broader BizBuySell-style category, distinct from the
-- more specific free-text `industry` field) was added to `listings` earlier
-- this session (sql/listing_biz_fields_complete.sql) but never carried into
-- public_listing_feed, so buyers couldn't filter by it. Additive only —
-- redefines the view with everything the previous version already had, plus
-- this one column, same pattern as every prior redefinition this session.
--
-- Run this ONCE in the Supabase SQL Editor. Idempotent.
-- =============================================================================

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
  l.business_type,
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
  pl.ask_buyer_timeframe,
  l.agent_id as broker_id,
  case when coalesce(l.website_confidential, false) then null else l.website end as website
from public.listings l
join public.public_listings pl on pl.listing_id = l.id
where l.status = 'active'
  and l.review_stage = 'approved'
  and pl.published = true;

grant select on public.public_listing_feed to anon, authenticated;

-- =============================================================================
-- DONE.
-- =============================================================================
