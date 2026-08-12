-- =============================================================================
-- CONCORD DEAL PLATFORM — Public deal stats (2026-08-12)
-- =============================================================================
-- The homepage "Businesses Sold" stat was hardcoded to a fake demo number
-- (128) because public_listing_feed only exposes status='active' listings —
-- closed deals are (correctly) excluded from the public feed, so there was no
-- safe public source for a real count.
--
-- This adds a single aggregate-only view exposing nothing but counts — no
-- listing rows, no seller identity, no financials. Safe to grant to anon.
--
-- Run this ONCE in the Supabase SQL Editor. Idempotent.
-- =============================================================================

drop view if exists public.public_deal_stats;
create view public.public_deal_stats
with (security_invoker = false)
as
select
  (select count(*) from public.listings where status = 'closed') as total_businesses_sold;

grant select on public.public_deal_stats to anon, authenticated;

-- =============================================================================
-- DONE.
-- =============================================================================
