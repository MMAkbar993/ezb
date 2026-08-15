-- =============================================================================
-- CONCORD DEAL PLATFORM — Broker profile service area (2026-08-15)
-- =============================================================================
-- Lets a broker describe the counties/state(s) they serve on their public
-- profile (e.g. "Mecklenburg & Union County, NC") — free text, matching how
-- listings.location_general is already handled elsewhere in this app; no
-- structured county/state lookup table exists or is needed for this.
--
-- Run this ONCE in the Supabase SQL Editor. Idempotent.
-- =============================================================================

alter table public.broker_profiles
  add column if not exists service_area text;

-- MyProfile.tsx upserts on profile_id (onConflict: 'profile_id') so a broker
-- saving their profile for the first time creates the row and saving again
-- updates the same one — this requires a real unique constraint, which
-- didn't exist (broker_profiles only had a bare `id` primary key). Added
-- defensively: if duplicate rows for the same profile_id already exist in
-- production, this will fail with a clear constraint-violation error rather
-- than silently doing the wrong thing — check for duplicates first if so.
alter table public.broker_profiles drop constraint if exists broker_profiles_profile_id_key;
alter table public.broker_profiles add constraint broker_profiles_profile_id_key unique (profile_id);

-- =============================================================================
-- DONE.
-- =============================================================================
