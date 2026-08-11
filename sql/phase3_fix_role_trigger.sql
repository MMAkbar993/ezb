-- =============================================================================
-- Fix: prevent_role_self_escalation trigger over-blocked service-role updates
-- =============================================================================
-- The trigger added in sql/phase3_security_hardening.sql correctly blocks a
-- user from promoting their OWN role via the client-side RLS-governed path,
-- but it also silently reverted role changes made via the service-role API
-- (auth.uid() is NULL in that context, so the old logic treated every
-- service-role caller as "not admin" and reverted the change). Confirmed via
-- live test 2026-08-11: admin.from('profiles').update({role:'broker'}) via
-- the service-role key silently had no effect.
--
-- Fix: only apply the restriction when there IS an authenticated caller
-- (auth.uid() is not null) — service-role calls bypass RLS by design and are
-- already trusted; this trigger's job is only to stop a logged-in user from
-- escalating their own row via the client.
--
-- Run this ONCE in the Supabase SQL Editor. Idempotent.
-- =============================================================================

create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_admin boolean;
begin
  if new.role is distinct from old.role and auth.uid() is not null then
    select coalesce((select role from public.profiles where id = auth.uid()), 'agent') = 'admin'
      into caller_is_admin;
    if not coalesce(caller_is_admin, false) then
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$;

-- =============================================================================
-- DONE.
-- =============================================================================
