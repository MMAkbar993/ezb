-- =============================================================================
-- CONCORD DEAL PLATFORM — Business website field (2026-08-13)
-- =============================================================================
-- Matches BizBuySell's "Business Website" + "Keep website confidential"
-- pair on the Add Listing form.
--
-- Run this ONCE in the Supabase SQL Editor. Idempotent.
-- =============================================================================

alter table public.listings
  add column if not exists website text,
  add column if not exists website_confidential boolean not null default false;

-- =============================================================================
-- DONE.
-- =============================================================================
