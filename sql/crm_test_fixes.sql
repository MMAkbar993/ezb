-- =============================================================================
-- CRM end-to-end test fixes (run in Supabase SQL Editor)
-- -----------------------------------------------------------------------------
-- Fixes found while broker-testing the whole platform on 2026-08-03:
--
--   1. listing_documents uses a restrictive `category` check that rejects the
--      guided-workflow doc types (listing_agreement, financial_proof, ...).
--      Add a `file_name` column (missing) + widen the category allow-list.
--   2. `lead_activities` table is MISSING (breaks lead activity/notes logging).
--   3. `financial_documents` table is MISSING (breaks the Financial Files system
--      built 2026-08-02; file lives in sql/financial_files_schema.sql).
--
-- Idempotent. Safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. listing_documents — add file_name column + widen category allow-list
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='listing_documents' and column_name='file_name') then
    alter table public.listing_documents add column file_name text;
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='listing_documents' and column_name='uploaded_by') then
    alter table public.listing_documents add column uploaded_by uuid references public.profiles(id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='listing_documents' and column_name='uploaded_at') then
    alter table public.listing_documents add column uploaded_at timestamptz not null default now();
  end if;
end $$;

-- Widen the category check to include all guided-workflow + financial doc types
alter table public.listing_documents drop constraint if exists listing_documents_category_check;
alter table public.listing_documents add constraint listing_documents_category_check check (
  category in (
    'nda','listing_agreement','purchase_agreement','marketing_agreement',
    'financial_proof','financial_statement','tax_return','bank_statement',
    'generated_document','closing_statement','due_diligence','other'
  )
);

-- Ensure RLS on listing_documents allows the broker team to read/write
drop policy if exists "listing_documents_select" on public.listing_documents;
create policy "listing_documents_select" on public.listing_documents for select to authenticated using (true);
drop policy if exists "listing_documents_insert" on public.listing_documents;
create policy "listing_documents_insert" on public.listing_documents for insert to authenticated with check (true);

-- ---------------------------------------------------------------------------
-- 2. lead_activities — activity/notes logging for leads  (recreate if missing)
-- ---------------------------------------------------------------------------
create table if not exists public.lead_activities (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null,
  type        text not null default 'note',            -- note | call | email | meeting
  description text not null,
  created_at  timestamptz not null default now()
);
create index if not exists lead_activities_lead_id_idx on public.lead_activities (lead_id);
alter table public.lead_activities enable row level security;
drop policy if exists "lead_activities_insert" on public.lead_activities;
create policy "lead_activities_insert" on public.lead_activities for insert to authenticated with check (true);
drop policy if exists "lead_activities_select" on public.lead_activities;
create policy "lead_activities_select" on public.lead_activities for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 3. financial_documents — the dedicated financial-files table
--    (self-contained; same as sql/financial_files_schema.sql)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='profiles' and column_name='role') then
    alter table public.profiles add column role text not null default 'agent';
  end if;
end $$;

create table if not exists public.financial_documents (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid references public.deals(id) on delete cascade,
  listing_id    uuid references public.listings(id) on delete cascade,
  file_name     text not null,
  file_url      text not null,
  storage_path  text,
  file_size     bigint,
  mime_type     text,
  file_kind     text not null default 'other',
  category      text not null default 'other',
  status        text not null default 'pending',
  notes         text,
  uploaded_by   uuid references public.profiles(id) on delete set null,
  uploaded_at   timestamptz not null default now(),
  unique (storage_path)
);
create index if not exists financial_documents_deal_idx on public.financial_documents (deal_id);
create index if not exists financial_documents_listing_idx on public.financial_documents (listing_id);
alter table public.financial_documents enable row level security;

create or replace function public.is_broker_or_admin()
returns boolean language sql stable security definer
as $$
  select coalesce((select role from public.profiles where id = auth.uid()),'agent') in ('broker','admin');
$$;

drop policy if exists "fd_select" on public.financial_documents;
create policy "fd_select" on public.financial_documents for select to authenticated using (true);
drop policy if exists "fd_insert" on public.financial_documents;
create policy "fd_insert" on public.financial_documents for insert to authenticated with check (true);
drop policy if exists "fd_update" on public.financial_documents;
create policy "fd_update" on public.financial_documents for update to authenticated using (public.is_broker_or_admin() or uploaded_by = auth.uid());
drop policy if exists "fd_delete" on public.financial_documents;
create policy "fd_delete" on public.financial_documents for delete to authenticated using (public.is_broker_or_admin() or uploaded_by = auth.uid());

grant execute on function public.is_broker_or_admin() to authenticated;
