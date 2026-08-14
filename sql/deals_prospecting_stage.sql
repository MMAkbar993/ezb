-- =============================================================================
-- CONCORD DEAL PLATFORM — Pipeline auto-linkage: new "prospecting" stage (2026-08-15)
-- =============================================================================
-- Today a listing never automatically appears on the Deal Pipeline board —
-- a broker has to manually click "+ New Deal" and pick the listing from a
-- dropdown, completely separate from the guided listing workflow. The client
-- wants every active listing to show up on the pipeline automatically, from
-- day one, then auto-advance as LOI / purchase agreement / closing get
-- recorded.
--
-- The live `deals_status_check` constraint (named per lib/pipeline.ts's own
-- comment — not tracked in any SQL file, added outside this repo like
-- several other constraints found this session) only allows:
--   letter_of_intent, under_contract, due_diligence, closing, closed
-- There is no pre-LOI stage, so an actively-marketed listing with no buyer
-- interest yet has nowhere valid to sit. Widened below, additive only —
-- nothing already valid is removed (same pattern as this session's
-- profiles_role_check widening).
--
-- Run this ONCE in the Supabase SQL Editor. Idempotent.
-- =============================================================================

alter table public.deals drop constraint if exists deals_status_check;
alter table public.deals add constraint deals_status_check
  check (status in ('prospecting', 'letter_of_intent', 'under_contract', 'due_diligence', 'closing', 'closed'));

alter table public.deals alter column status set default 'prospecting';

-- =============================================================================
-- DONE.
-- =============================================================================
