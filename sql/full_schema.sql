-- =============================================================================
-- Concord Deal Platform — Full Schema Migrations
-- Run this ONCE in the Supabase SQL Editor. It is idempotent (safe to re-run).
--
-- Creates the tables the platform needs that don't exist yet:
--   cim_versions, bov_versions, due_diligence_items, deal_documents (category)
-- Plus enables RLS policies with a "default deny + owner/authenticated read"
-- model appropriate for a broker CRM.
--
-- NOTE: `deal_documents`, `listing_documents`, `buyer_leads`, `seller_leads`,
-- `deals`, `listings`, `profiles` already exist — we only ALTER/enable RLS on
-- those, we never recreate them.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. CIM versions (Confidential Information Memorandum)
-- ---------------------------------------------------------------------------
create table if not exists public.cim_versions (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid references public.listings(id) on delete cascade,
  version       int not null default 1,
  title         text,
  content_json  jsonb,
  status        text not null default 'draft',   -- draft | finalized
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. BOV versions (Broker Opinion of Value)
-- ---------------------------------------------------------------------------
create table if not exists public.bov_versions (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid references public.listings(id) on delete cascade,
  version       int not null default 1,
  title         text,
  content_json  jsonb,
  status        text not null default 'draft',
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Due diligence checklist items
-- NOTE: table ALREADY EXISTS with columns: id, deal_id, title, status, due_date,
-- created_at. We ALTER it to add the columns the tracker needs.
-- ---------------------------------------------------------------------------
create table if not exists public.due_diligence_items (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid references public.deals(id) on delete cascade,
  title         text not null,
  status        text not null default 'pending',  -- pending | in_review | approved | rejected | waived
  due_date      date,
  created_at    timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='due_diligence_items' and column_name='category') then
    alter table public.due_diligence_items add column category text default 'General';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='due_diligence_items' and column_name='assignee') then
    alter table public.due_diligence_items add column assignee uuid references public.profiles(id);
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='due_diligence_items' and column_name='notes') then
    alter table public.due_diligence_items add column notes text;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. deal_documents: add category column (currently missing)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'deal_documents' and column_name = 'category'
  ) then
    alter table public.deal_documents add column category text default 'Other';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists cim_versions_listing_idx on public.cim_versions (listing_id);
create index if not exists bov_versions_listing_idx on public.bov_versions (listing_id);
create index if not exists dd_items_deal_idx on public.due_diligence_items (deal_id);
create index if not exists dd_items_status_idx on public.due_diligence_items (status);

-- ---------------------------------------------------------------------------
-- RLS: enable on new tables and lock them down to authenticated users.
-- (Existing tables already have their own policies; we audit those separately.)
-- ---------------------------------------------------------------------------
alter table public.cim_versions enable row level security;
alter table public.bov_versions enable row level security;
alter table public.due_diligence_items enable row level security;

-- Anyone authenticated can read CIM/BOV (confidential but shown to broker team)
drop policy if exists "cim_select" on public.cim_versions;
create policy "cim_select" on public.cim_versions for select to authenticated using (true);
drop policy if exists "cim_insert" on public.cim_versions;
create policy "cim_insert" on public.cim_versions for insert to authenticated with check (true);
drop policy if exists "cim_update" on public.cim_versions;
create policy "cim_update" on public.cim_versions for update to authenticated using (true);
drop policy if exists "cim_delete" on public.cim_versions;
create policy "cim_delete" on public.cim_versions for delete to authenticated using (true);

drop policy if exists "bov_select" on public.bov_versions;
create policy "bov_select" on public.bov_versions for select to authenticated using (true);
drop policy if exists "bov_insert" on public.bov_versions;
create policy "bov_insert" on public.bov_versions for insert to authenticated with check (true);
drop policy if exists "bov_update" on public.bov_versions;
create policy "bov_update" on public.bov_versions for update to authenticated using (true);
drop policy if exists "bov_delete" on public.bov_versions;
create policy "bov_delete" on public.bov_versions for delete to authenticated using (true);

drop policy if exists "dd_select" on public.due_diligence_items;
create policy "dd_select" on public.due_diligence_items for select to authenticated using (true);
drop policy if exists "dd_insert" on public.due_diligence_items;
create policy "dd_insert" on public.due_diligence_items for insert to authenticated with check (true);
drop policy if exists "dd_update" on public.due_diligence_items;
create policy "dd_update" on public.due_diligence_items for update to authenticated using (true);
drop policy if exists "dd_delete" on public.due_diligence_items;
create policy "dd_delete" on public.due_diligence_items for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('documents', 'documents', true),
  ('listing_images', 'listing_images', true)
on conflict (id) do nothing;
