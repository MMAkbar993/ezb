-- =============================================================================
-- CONCORD DEAL PLATFORM — Buyer Lead Fields Fix (2026-08-11)
-- =============================================================================
-- Fixes "add buyer lead" failing: lib/leads2.ts::createBuyerLead() has always
-- sent desired_business_type / funds_available / financing_method /
-- preferred_location (the buyer lead form has fields for all of these), but
-- none of those columns exist on the live buyer_leads table — confirmed via
-- live introspection with the service-role key. budget_range and notes
-- already exist and work fine. This adds only the missing four; no app code
-- changes needed once this is run.
--
-- Run this ONCE in the Supabase SQL Editor. Idempotent, safe to re-run.
-- =============================================================================

alter table public.buyer_leads
  add column if not exists desired_business_type text,
  add column if not exists funds_available numeric,
  add column if not exists financing_method text,
  add column if not exists preferred_location text;

-- =============================================================================
-- DONE.
-- =============================================================================
