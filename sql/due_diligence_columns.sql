-- =============================================================================
-- CONCORD DEAL PLATFORM — due_diligence_items missing columns (2026-08-15)
-- =============================================================================
-- lib/dueDiligence.ts (the CRUD layer behind both the existing /due-diligence
-- page and the new listing-scoped Closing Checklist) has always assumed
-- due_diligence_items has category/assignee/notes columns — sql/full_schema.sql
-- claims to add them, but live-testing today found they don't actually exist
-- in production, so every create/update through that layer has been failing
-- silently up to now. Same file-drift pattern found repeatedly this session.
--
-- One deliberate correction vs. sql/full_schema.sql's version: that file
-- defines `assignee` as `uuid references profiles(id)`, but the actual
-- application code (lib/dueDiligence.ts's DDItem/DDInput, and every UI that
-- uses it) has always treated it as a plain free-text label (e.g. "Jane
-- Smith" or "Escrow Attorney"), never a profile lookup. Matching the
-- real, working code here rather than the unused stricter FK avoids a
-- guaranteed insert failure (a non-UUID string into a uuid column) the
-- moment this migration ran.
--
-- Run this ONCE in the Supabase SQL Editor. Idempotent.
-- =============================================================================

alter table public.due_diligence_items
  add column if not exists category text default 'General',
  add column if not exists assignee text,
  add column if not exists notes text;

-- =============================================================================
-- DONE.
-- =============================================================================
