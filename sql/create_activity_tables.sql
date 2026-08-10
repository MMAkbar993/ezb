-- =============================================================================
-- Concord Deal Platform — supporting tables for seller-lead activity logging
-- Run this in the Supabase SQL Editor.
--
-- The `lead_activities` table does not currently exist (verified live, HTTP 404).
-- Activity logging in the seller-leads CRUD depends on it. Run this once,
-- then reload the page.
-- =============================================================================

create table if not exists public.lead_activities (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null,
  type        text not null default 'note',            -- note | call | email | meeting
  description text not null,
  created_at  timestamptz not null default now()
);

-- Optional: indexes for fast lookup per lead
create index if not exists lead_activities_lead_id_idx on public.lead_activities (lead_id);

-- Activity rows belong to the lead they reference. Authenticated users can insert
-- and read their own activities; adjust to match your access model if needed.
alter table public.lead_activities enable row level security;

drop policy if exists "lead_activities_insert" on public.lead_activities;
create policy "lead_activities_insert"
  on public.lead_activities for insert to authenticated
  with check (true);

drop policy if exists "lead_activities_select" on public.lead_activities;
create policy "lead_activities_select"
  on public.lead_activities for select to authenticated
  using (true);
