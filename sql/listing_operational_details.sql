-- =============================================================================
-- CONCORD DEAL PLATFORM — Listing Operational Details (2026-08-11)
-- =============================================================================
-- Fixes the live "could not find the land_acres column" error (the listing
-- form has always sent these fields — sql/document_compliance_realestate_
-- schema.sql, which defines them, was never actually run against this
-- database — confirmed via live introspection with the service-role key).
--
-- Also adds the operational fields requested for the listing intake form,
-- matching a BizBuySell-style questionnaire:
--   - number of employees / number of working owners
--   - business square footage (distinct from any real-estate square footage)
--   - lease term remaining + monthly rent (for businesses that lease, not own)
--
-- `real_estate_included` already exists and already defaults to false — real
-- estate has always been optional here; the property_* fields below are only
-- ever populated when a seller opts in.
--
-- Run this ONCE in the Supabase SQL Editor. Idempotent, safe to re-run.
-- =============================================================================

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

alter table public.listings
  add column if not exists num_employees int,
  add column if not exists num_owners int,
  add column if not exists business_square_footage numeric,
  add column if not exists lease_years_remaining numeric,
  add column if not exists monthly_rent numeric;

-- Total value = asking_price + property_value (nulls treated as 0). Matches
-- the `Listing.total_value` field already referenced in lib/listings.ts.
alter table public.listings
  add column if not exists total_value numeric
    generated always as (coalesce(asking_price, 0) + coalesce(property_value, 0)) stored;

-- deal_closing_details is missing final_purchase_price — Step 10's closing
-- form collects it but every save was silently failing without this column.
alter table public.deal_closing_details
  add column if not exists final_purchase_price numeric;

comment on column public.listings.num_employees is 'Total employees currently working in the business (excluding owners).';
comment on column public.listings.num_owners is 'Number of owners actively working in the business day-to-day.';
comment on column public.listings.business_square_footage is 'Square footage of the business''s operating space (leased or owned) — independent of real_estate_included.';
comment on column public.listings.lease_years_remaining is 'Years remaining on the current lease, when the business leases its space (real_estate_included = false).';
comment on column public.listings.monthly_rent is 'Current monthly rent/lease payment, when the business leases its space.';

-- =============================================================================
-- DONE.
-- =============================================================================
