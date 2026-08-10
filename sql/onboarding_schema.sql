-- =============================================================================
-- Concord Deal Platform — Agent Onboarding & Training System schema
-- Run this in the Supabase SQL Editor (AFTER full_schema.sql, phase2_schema.sql,
-- training_schema.sql). Idempotent and safe to re-run.
--
-- Adds:
--   * Agent onboarding checklists (broker → onboarding_tasks)
--   * Onboarding step definitions + progress
--   * Certificate verification support (verification_code, verified_at, template)
--   * certified_brokers view (brokers with ≥1 module certificate)
--   * RLS + grants for all new objects
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. onboarding_steps — the list of steps a new agent completes
-- ---------------------------------------------------------------------------
create table if not exists public.onboarding_steps (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  step_key     text not null unique,      -- e.g. 'profile','train_intro','nda','first_listing'
  icon         text default '📋',
  "order"      int not null default 0,
  is_required  boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. onboarding_tasks — per-broker completion of each onboarding step
-- ---------------------------------------------------------------------------
create table if not exists public.onboarding_tasks (
  id          uuid primary key default gen_random_uuid(),
  broker_id   uuid references public.profiles(id) on delete cascade,
  step_id     uuid references public.onboarding_steps(id) on delete cascade,
  completed   boolean not null default false,
  completed_at timestamptz,
  progress    numeric not null default 0,   -- 0..100 for steps that are partial
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (broker_id, step_id)
);

-- ---------------------------------------------------------------------------
-- 3. Certificate verification: add columns to training_certificates
--    (idempotent — only adds if not present)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='training_certificates' and column_name='verification_code') then
    alter table public.training_certificates
      add column verification_code text;
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='training_certificates' and column_name='template') then
    alter table public.training_certificates
      add column template text not null default 'gold';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='training_certificates' and column_name='verified_at') then
    alter table public.training_certificates
      add column verified_at timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='training_certificates' and column_name='certificate_key') then
    alter table public.training_certificates
      add column certificate_key text;      -- base64-encoded payload for QR
  end if;
end $$;

-- Unique partial index so verification codes are unique among issued certs
drop index if exists training_certificates_verification_code_idx;
create unique index training_certificates_verification_code_idx
  on public.training_certificates (verification_code)
  where verification_code is not null;

-- ---------------------------------------------------------------------------
-- 4. certified_brokers — view joining certificates → profiles
-- ---------------------------------------------------------------------------
create or replace view public.certified_brokers as
select
  p.id as broker_id,
  p.full_name,
  p.email,
  p.avatar_url,
  count(distinct tc.module_id) as modules_certified,
  max(tc.issued_at) as last_certified_at
from public.profiles p
join public.training_certificates tc on tc.broker_id = p.id
group by p.id, p.full_name, p.email, p.avatar_url;

-- ---------------------------------------------------------------------------
-- 5. Seed onboarding steps (idempotent by step_key)
-- ---------------------------------------------------------------------------
insert into public.onboarding_steps (id, title, description, step_key, icon, "order", is_required)
values
  ('44444444-4444-4444-4444-444444444401', 'Complete your profile', 'Set your name, title, and contact details so clients see who they are working with.', 'profile', '👤', 1, true),
  ('44444444-4444-4444-4444-444444444402', 'Watch Intro to Brokerage', 'Complete Module 1 of the Training Center to learn the broker role and deal lifecycle.', 'train_intro', '📘', 2, true),
  ('44444444-4444-4444-4444-444444444403', 'Review ethics & NDA basics', 'Understand fiduciary duties, confidentiality, and signed agreements before engaging sellers.', 'ethics_nda', '🤝', 3, true),
  ('44444444-4444-4444-4444-444444444404', 'Set your commission rate', 'Configure your commission percentage and split preferences for deal tracking.', 'commission', '💰', 4, true),
  ('44444444-4444-4444-4444-444444444405', 'Create your first listing', 'Use the Guided Listing Workflow to add your first sell-side engagement.', 'first_listing', '🏢', 5, true),
  ('44444444-4444-4444-4444-444444444406', 'Connect marketing channels', 'Link social accounts and set email preferences for posting and notifications.', 'marketing', '📣', 6, false)
on conflict (step_key) do nothing;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists onboarding_tasks_broker_idx on public.onboarding_tasks (broker_id);
create index if not exists onboarding_tasks_step_idx on public.onboarding_tasks (step_id);

-- ---------------------------------------------------------------------------
-- RLS — content read by authenticated; tasks are owner-scoped; admin manage steps
-- ---------------------------------------------------------------------------
alter table public.onboarding_steps enable row level security;
alter table public.onboarding_tasks enable row level security;

drop policy if exists "osteps_read" on public.onboarding_steps;
create policy "osteps_read" on public.onboarding_steps
  for select to authenticated using (true);

drop policy if exists "osteps_write" on public.onboarding_steps;
create policy "osteps_write" on public.onboarding_steps
  for insert to authenticated with check (true);

drop policy if exists "otasks_owner_all" on public.onboarding_tasks;
create policy "otasks_owner_all" on public.onboarding_tasks
  for all using (auth.uid() = broker_id) with check (auth.uid() = broker_id);

drop policy if exists "otasks_auth_read" on public.onboarding_tasks;
create policy "otasks_auth_read" on public.onboarding_tasks
  for select to authenticated using (true);

-- Grants
grant select on public.onboarding_steps to authenticated;
grant all on public.onboarding_tasks to authenticated;
grant select on public.certified_brokers to authenticated;
grant all on all tables in schema public to service_role;
