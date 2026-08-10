-- =============================================================================
-- Concord Deal Platform — Hiring / Agent Onboarding Schema
-- Run this in the Supabase SQL Editor (AFTER phase2_schema.sql).
-- Creates agent_applications + agent_agreements with RLS + grants. Idempotent.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. agent_applications — submitted broker applications
--    status flow: pending | reviewing | interview | approved | rejected | withdrawn
-- ---------------------------------------------------------------------------
create table if not exists public.agent_applications (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  email         text not null,
  phone         text,
  experience    text,                    -- years + background summary
  status        text not null default 'pending',
  submitted_at  timestamptz not null default now(),
  reviewed_by   uuid references public.profiles(id) on delete set null,
  reviewed_at   timestamptz
);

-- ---------------------------------------------------------------------------
-- 2. agent_agreements — signed contracts for an agent/broker
--    type: ic | employee | commission | non_compete | non_solicit | confidentiality | ethics
-- ---------------------------------------------------------------------------
create table if not exists public.agent_agreements (
  id           uuid primary key default gen_random_uuid(),
  broker_id    uuid references public.profiles(id) on delete cascade,
  type         text not null default 'ic',
  signed_at    timestamptz,
  expires_at   timestamptz,
  document_url text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists agent_applications_status_idx on public.agent_applications (status);
create index if not exists agent_agreements_broker_idx on public.agent_agreements (broker_id);

-- ---------------------------------------------------------------------------
-- RLS — default deny; authenticated can read all applications (admin review)
-- and submit their own; agreements owner read.
-- ---------------------------------------------------------------------------
alter table public.agent_applications enable row level security;
alter table public.agent_agreements enable row level security;

drop policy if exists "agent_apps_read" on public.agent_applications;
create policy "agent_apps_read" on public.agent_applications
  for select to authenticated using (true);

drop policy if exists "agent_apps_insert" on public.agent_applications;
create policy "agent_apps_insert" on public.agent_applications
  for insert to authenticated with check (true);

drop policy if exists "agent_apps_update" on public.agent_applications;
create policy "agent_apps_update" on public.agent_applications
  for update to authenticated using (true);

drop policy if exists "agent_agreements_owner" on public.agent_agreements;
create policy "agent_agreements_owner" on public.agent_agreements
  for select using (auth.uid() = broker_id);

drop policy if exists "agent_agreements_write" on public.agent_agreements;
create policy "agent_agreements_write" on public.agent_agreements
  for insert to authenticated with check (true);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated, service_role;
grant select, insert, update on public.agent_applications to authenticated;
grant select, insert on public.agent_agreements to authenticated;
grant all on all tables in schema public to service_role;
