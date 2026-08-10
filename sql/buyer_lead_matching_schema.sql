-- =============================================================================
-- Buyer Lead enrichment: financials + desired business type + listing matching
-- (Concord Deal Platform)
--
-- Adds columns to `buyer_leads` so buyer leads can record:
--   * what they want to buy (desired_business_type)  e.g. Retail, Home Health
--   * their financials (budget range, funds available, financing method)
-- And indexes to power the "matching buyer leads" popup when a listing is added.
-- =============================================================================

alter table public.buyer_leads add column if not exists desired_business_type text;
alter table public.buyer_leads add column if not exists budget_range text;           -- e.g. "$500k–$2M"
alter table public.buyer_leads add column if not exists funds_available numeric;     -- verified funds / cash available
alter table public.buyer_leads add column if not exists financing_method text;       -- cash / SBA / private investor
alter table public.buyer_leads add column if not exists preferred_location text;     -- optional geographic preference
alter table public.buyer_leads add column if not exists notes text;

-- Index for matching buyer leads to a listing by business type.
create index if not exists buyer_leads_type_idx on public.buyer_leads (lower(coalesce(desired_business_type, '')));
