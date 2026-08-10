-- =============================================================================
-- Multi-Tenant Free Trial System
-- -----------------------------------------------------------------------------
-- Adds trial lifecycle + usage + billing history to agencies so each broker
-- agency can run a free trial, enforce usage limits, and convert to a paid
-- plan. Idempotent — safe to re-run.
-- =============================================================================

-- ---- agencies: trial lifecycle columns --------------------------------------
alter table public.agencies
  add column if not exists trial_start_date  timestamptz,
  add column if not exists trial_end_date    timestamptz,
  add column if not exists trial_active      boolean not null default false,
  add column if not exists paid_plan_active  boolean not null default false,
  add column if not exists plan_type         text default 'free',       -- free | starter | professional | enterprise
  add column if not exists grace_end_date    timestamptz,               -- read-only window after trial ends
  add column if not exists locked_at         timestamptz,               -- hard-locked (after grace)
  add column if not exists archive_at        timestamptz,               -- data archived after grace+30d
  add column if not exists trial_extensions  int not null default 0;

-- ---- agency_usage: period usage counters -------------------------------------
create table if not exists public.agency_usage (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references public.agencies(id) on delete cascade,
  listings_used int not null default 0,
  leads_used    int not null default 0,
  deals_used    int not null default 0,
  storage_used  bigint not null default 0,        -- bytes
  period_start  timestamptz not null,
  period_end    timestamptz not null,
  created_at    timestamptz not null default now()
);

-- ---- subscription_history: trial/paid billing entries -------------------------
create table if not exists public.subscription_history (
  id         uuid primary key default gen_random_uuid(),
  agency_id  uuid not null references public.agencies(id) on delete cascade,
  plan_type  text not null default 'trial',       -- trial | starter | professional | enterprise
  start_date timestamptz not null default now(),
  end_date   timestamptz,
  amount     numeric(10,2) not null default 0,
  status     text not null default 'active',      -- active | converted | expired | cancelled | grace
  notes      text,
  created_at timestamptz not null default now()
);

-- ---- global / per-agency trial settings ----------------------------------------
create table if not exists public.trial_settings (
  id              uuid primary key default gen_random_uuid(),
  agency_id       uuid references public.agencies(id) on delete cascade,  -- null = global default
  trial_days      int not null default 14,
  max_listings    int not null default 5,
  max_leads       int not null default 20,
  max_deals       int not null default 5,
  max_agents      int not null default 3,
  max_storage_mb  bigint not null default 100,
  send_reminders  boolean not null default true,
  grace_days      int not null default 7,
  archive_days    int not null default 30,
  created_at      timestamptz not null default now()
);

-- ---- indexes ----------------------------------------------------------------
create index if not exists idx_agency_usage_agency  on public.agency_usage (agency_id);
create index if not exists idx_sub_history_agency   on public.subscription_history (agency_id);
create index if not exists idx_trial_settings_agency on public.trial_settings (agency_id);
create index if not exists idx_agencies_trial       on public.agencies (trial_active);
create index if not exists idx_agencies_plan        on public.agencies (plan_type);

-- ---- RLS --------------------------------------------------------------------
alter table public.agency_usage         enable row level security;
alter table public.subscription_history enable row level security;
alter table public.trial_settings       enable row level security;

-- Members of an agency can read its usage (via agency_members join is complex for
-- simple policies; we allow authenticated to select rows of their own agency using
-- a helper we seed via a subselect on agency_members).
drop policy if exists agency_usage_members on public.agency_usage;
create policy agency_usage_members on public.agency_usage
  for select using (
    exists (select 1 from public.agency_members m
            where m.agency_id = agency_usage.agency_id and m.profile_id = auth.uid())
  );

drop policy if exists sub_history_members on public.subscription_history;
create policy sub_history_members on public.subscription_history
  for select using (
    exists (select 1 from public.agency_members m
            where m.agency_id = subscription_history.agency_id and m.profile_id = auth.uid())
  );

-- Trial settings: global default is public-read; per-agency rows only to members.
drop policy if exists trial_settings_read on public.trial_settings;
create policy trial_settings_read on public.trial_settings
  for select using (
    agency_id is null or
    exists (select 1 from public.agency_members m
            where m.agency_id = trial_settings.agency_id and m.profile_id = auth.uid())
  );

-- ---- seed: global default trial settings --------------------------------------
insert into public.trial_settings (agency_id, trial_days, max_listings, max_leads, max_deals, max_agents, max_storage_mb, send_reminders, grace_days, archive_days)
values (null, 14, 5, 20, 5, 3, 100, true, 7, 30)
on conflict do nothing;
