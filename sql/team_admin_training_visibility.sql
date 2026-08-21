-- =============================================================================
-- CONCORD DEAL PLATFORM — Admin-visible training/certification status (2026-08-21)
-- =============================================================================
-- training_certificates and training_progress RLS was owner-only
-- (auth.uid() = broker_id) — an admin/broker had no way to see another
-- agent's training progress or certification status from the Team
-- Management panel. Adds an admin/broker read policy, mirroring the
-- existing profiles admin-read policy in sql/role_access_control.sql.
--
-- Run this ONCE in the Supabase SQL Editor. Idempotent.
-- =============================================================================

drop policy if exists "training_certificates_admin_read" on public.training_certificates;
create policy "training_certificates_admin_read" on public.training_certificates
  for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'broker')));

drop policy if exists "training_progress_admin_read" on public.training_progress;
create policy "training_progress_admin_read" on public.training_progress
  for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'broker')));

-- =============================================================================
-- DONE.
-- =============================================================================
