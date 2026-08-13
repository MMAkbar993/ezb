-- =============================================================================
-- CONCORD DEAL PLATFORM — Role-based access control foundation (2026-08-14)
-- =============================================================================
-- Adds a strict "admin-only" helper (profiles.role = 'admin' — this is also
-- what "owner" means in this app: whoever created the agency already has
-- agency_members.is_owner = true AND profiles.role = 'admin', per
-- app/api/billing/create-agency/route.ts. There is no separate 'owner' role
-- value — admin and owner are the same access tier by design.
--
-- Also closes two confirmed RLS gaps found while auditing the schema:
--   1. agency_members INSERT was `using (true)` — any authenticated user
--      could add themselves to ANY agency as admin/owner. Now requires the
--      caller to already be an admin member of that same agency.
--   2. agencies UPDATE/DELETE was `using (true)` — any authenticated user
--      could edit or delete any agency. Now requires the caller to be an
--      admin member of that specific agency. SELECT stays open (needed for
--      the public subdomain/agency directory pages).
--
-- NOTE: live-probed the real database before writing this (2026-08-14) —
-- `commissions` does not exist as a table today (sql/analytics_schema.sql
-- defines it but it was never actually run), so no policy is written for it
-- here. `agency_members`/`agencies` both have 0 rows in production — this
-- migration is pure hardening of currently-unused infrastructure, not a fix
-- to anything actively relied on.
--
-- Also fixes a landmine found while building the "promote agent to broker"
-- feature: sql/phase3_security_hardening.sql's `prevent_role_self_escalation`
-- trigger checks `auth.uid()` to decide whether the CALLER is an admin —
-- but auth.uid() is NULL under a service-role connection (no JWT), so the
-- planned admin-only `/api/team/set-role` route (which does its own admin
-- check server-side, then writes via the service-role client) would have
-- every promotion silently reverted back to the old role by this trigger.
-- Fixed by also allowing service-role writes through — the route is the
-- actual authorization boundary for that path, not this trigger.
--
-- IMPORTANT — found by live-testing this migration after it was first run
-- (2026-08-14): `profiles.role` has a live CHECK constraint
-- (`profiles_role_check`) that rejected 'broker'. This constraint exists
-- only in the live database (not in any file in sql/ — added outside this
-- repo, same as the rest of the `profiles` table). This means
-- `is_broker_or_admin()` (sql/financial_files_schema.sql) has been silently
-- equivalent to "role = 'admin'" in production the whole time, since no row
-- could ever actually hold 'broker'.
--
-- UPDATE (found on a second live-test pass): the allowed set isn't just
-- 'agent'/'admin' — it also includes 'buyer', set by a hidden Supabase
-- trigger (not tracked anywhere in sql/) that auto-provisions a `profiles`
-- row whenever a new auth.users row is created, defaulting role to 'buyer'.
-- Nothing in this app's own code calls auth.signUp() (confirmed by search),
-- so this is almost certainly a vestigial default from whatever starter
-- template this project began from — but since it's unknown whether
-- anything still depends on 'buyer' being valid, the fix here is
-- deliberately ADDITIVE ONLY: widen the constraint to add 'broker' without
-- removing 'buyer' (or anything else already valid), rather than replacing
-- the allowed set outright.
--
-- Run this ONCE in the Supabase SQL Editor. Idempotent.
-- =============================================================================

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('agent', 'broker', 'admin', 'buyer'));

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
    if auth.role() = 'service_role' then
      return new;
    end if;
    select coalesce((select role from public.profiles where id = auth.uid()), 'agent') = 'admin'
      into caller_is_admin;
    if not coalesce(caller_is_admin, false) then
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$;

-- security definer is required here (matches the existing is_broker_or_admin()
-- convention, sql/financial_files_schema.sql:54-62) because this function is
-- used inside a `profiles` RLS policy below — without security definer, its
-- own internal `select ... from profiles` would itself be subject to that
-- same policy, recursing back into is_admin() again.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'agent') = 'admin'
$$;

-- ---------------------------------------------------------------------------
-- profiles — admins can read every team member's row (name/email/role) for
-- the new Team Management page; previously self-only, which meant an admin
-- listing "all team members" via the browser client only ever saw their own
-- row. Writes stay self-only (unchanged) — role changes for OTHER users go
-- through app/api/team/set-role (service-role route), never a direct client
-- update.
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_owner_select" on public.profiles;
create policy "profiles_owner_select_or_admin"
on public.profiles
for select
using (auth.uid() = id or public.is_admin());

-- ---------------------------------------------------------------------------
-- agency_members — close the self-insert privilege-escalation hole.
-- This table has been defined with two different policy-naming conventions
-- across sql/phase2_schema.sql, sql/rls_enable.sql, and sql/RUN_ALL.sql
-- (both were run historically, and Postgres OR's multiple permissive
-- policies together) — drop every known variant so no open INSERT policy
-- survives underneath the new one.
-- ---------------------------------------------------------------------------
drop policy if exists "agency_members write" on public.agency_members;
drop policy if exists "agency_members_auth_insert" on public.agency_members;

create policy "agency_members_insert_admin_only"
on public.agency_members
for insert
to authenticated
with check (
  public.is_admin()
  and exists (
    select 1 from public.agency_members m
    where m.agency_id = agency_members.agency_id
      and m.profile_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- agencies — scope writes to admins of that specific agency. Reads stay open.
-- Same dual-naming situation as above — drop every known variant.
-- ---------------------------------------------------------------------------
drop policy if exists "agencies update" on public.agencies;
drop policy if exists "agencies_auth_update" on public.agencies;
drop policy if exists "agencies delete" on public.agencies;

create policy "agencies_update_admin_only"
on public.agencies
for update
to authenticated
using (
  exists (
    select 1 from public.agency_members m
    where m.agency_id = agencies.id
      and m.profile_id = auth.uid()
      and m.role = 'admin'
  )
);

create policy "agencies_delete_admin_only"
on public.agencies
for delete
to authenticated
using (
  exists (
    select 1 from public.agency_members m
    where m.agency_id = agencies.id
      and m.profile_id = auth.uid()
      and m.role = 'admin'
  )
);

-- =============================================================================
-- DONE.
-- =============================================================================
