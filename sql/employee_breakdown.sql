-- =============================================================================
-- CONCORD DEAL PLATFORM — Employee breakdown by type (2026-08-13)
-- =============================================================================
-- Matches BizBuySell's Full-Time / Part-Time / Contractor breakdown with an
-- auto-computed total, instead of a single flat employee count. The existing
-- `num_employees` column stays as the total — the form auto-sums it from
-- these three when they're used, so nothing that already reads
-- `listings.num_employees` needs to change.
--
-- Run this ONCE in the Supabase SQL Editor. Idempotent.
-- =============================================================================

alter table public.listings
  add column if not exists num_employees_ft int,
  add column if not exists num_employees_pt int,
  add column if not exists num_employees_contractor int;

comment on column public.listings.num_employees_ft is 'Full-time non-owner employees. num_employees is auto-summed from ft+pt+contractor when any of the three are set.';

-- =============================================================================
-- DONE.
-- =============================================================================
