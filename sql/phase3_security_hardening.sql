-- =============================================================================
-- CONCORD DEAL PLATFORM — Phase 3 Security Hardening (2026-08-10)
-- =============================================================================
-- Fixes from the Phase 3 security/confidentiality audit. Idempotent, safe to
-- re-run. Every fix here is scoped to close a gap without changing any
-- currently-working, actually-used flow (verified against app/ and lib/
-- before writing each policy).
--
--   1. profiles.role self-escalation — a user could UPDATE their own role to
--      'admin'/'broker' and bypass every is_broker_or_admin() check.
--   2. agent_agreements — any authenticated user could insert an agreement
--      row for an arbitrary broker_id (table is currently unused by the app,
--      so this is a defensive fix with zero behavior change).
--   3. document_templates / documents / document_signatures /
--      document_audit_logs / email_emails — RLS policies missing
--      `to authenticated`, meaning they're readable/writable by the `anon`
--      role if Supabase's default anon grants are intact. None of these
--      tables are wired into any app/ or components/ UI today (dead schema
--      except lib/documentBuilder.ts, which nothing currently calls), so
--      restricting to authenticated cannot break a working flow.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. profiles.role — prevent self-escalation
-- ---------------------------------------------------------------------------
-- The existing "profiles_owner_update" policy (sql/rls_enable.sql) lets a
-- user update their own row with no column restriction, which includes
-- `role`. RLS is row-level, not column-level, so the fix is a trigger that
-- reverts any attempted role change made by a non-admin.
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_admin boolean;
begin
  if new.role is distinct from old.role then
    select coalesce((select role from public.profiles where id = auth.uid()), 'agent') = 'admin'
      into caller_is_admin;
    if not coalesce(caller_is_admin, false) then
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_role_self_escalation on public.profiles;
create trigger trg_prevent_role_self_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_self_escalation();

-- ---------------------------------------------------------------------------
-- 2. agent_agreements — scope inserts to the caller's own broker_id
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='agent_agreements') then
    drop policy if exists "agent_agreements_write" on public.agent_agreements;
    create policy "agent_agreements_write" on public.agent_agreements
      for insert to authenticated with check (broker_id = auth.uid());
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Document builder + email queue — restrict to authenticated
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='document_templates') then
    drop policy if exists "document_templates_read" on public.document_templates;
    create policy "document_templates_read" on public.document_templates
      for select to authenticated using (true);
  end if;

  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='documents') then
    drop policy if exists "documents_auth_read" on public.documents;
    create policy "documents_auth_read" on public.documents
      for select to authenticated using (true);
  end if;

  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='document_signatures') then
    drop policy if exists "signatures_read" on public.document_signatures;
    create policy "signatures_read" on public.document_signatures
      for select to authenticated using (true);
    drop policy if exists "signatures_insert" on public.document_signatures;
    create policy "signatures_insert" on public.document_signatures
      for insert to authenticated with check (true);
    drop policy if exists "signatures_update" on public.document_signatures;
    create policy "signatures_update" on public.document_signatures
      for update to authenticated using (true);
  end if;

  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='document_audit_logs') then
    drop policy if exists "audit_logs_read" on public.document_audit_logs;
    create policy "audit_logs_read" on public.document_audit_logs
      for select to authenticated using (true);
    drop policy if exists "audit_logs_insert" on public.document_audit_logs;
    create policy "audit_logs_insert" on public.document_audit_logs
      for insert to authenticated with check (true);
  end if;

  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='email_emails') then
    drop policy if exists "email_emails_owner_select" on public.email_emails;
    create policy "email_emails_owner_select" on public.email_emails
      for select to authenticated using (true);
  end if;
end $$;

-- =============================================================================
-- DONE.
-- =============================================================================
