-- =============================================================================
-- CONCORD DEAL PLATFORM — "Business is currently" status flags (2026-08-13)
-- =============================================================================
-- Matches BizBuySell's "Business is currently: Absentee owner / Relocatable /
-- Home-based / Established Franchise" checkboxes.
--
-- Run this ONCE in the Supabase SQL Editor. Idempotent.
-- =============================================================================

alter table public.listings
  add column if not exists is_absentee_owner boolean not null default false,
  add column if not exists is_relocatable boolean not null default false,
  add column if not exists is_home_based boolean not null default false,
  add column if not exists is_franchise boolean not null default false;

-- =============================================================================
-- DONE.
-- =============================================================================
