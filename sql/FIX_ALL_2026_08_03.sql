-- =============================================================================
-- CONCORD DEAL PLATFORM — Consolidated Fix Migration (2026-08-03)
-- =============================================================================
-- ONE-TIME SCRIPT. Run the ENTIRE file once in:
--   Supabase Dashboard → SQL Editor → paste → Run
--
-- Fixes discovered by end-to-end broker testing on 2026-08-03:
--   1. listing_documents is missing the `file_name` column (steps 1/legal docs).
--   2. listing_documents category/status/party_type allow-lists are too strict
--      for the guided workflow (reject listing_agreement, financial_proof, and
--      the doc-management categories).
--   3. seller_leads status allow-list (new|contacted|closed) rejects the app's
--      funnel (qualifying/qualified/handed_off/not_a_fit).
--   4. lead_activities table is MISSING (blocks lead activities/notes + the
--      lead→deal conversion activity log).
--   5. financial_documents table is MISSING (blocks the entire Financial Files
--      system + Recast/BOV/CIM/BLI generation from uploaded files).
--
-- Idempotent + safe to re-run. Preserves existing data.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. listing_documents — add file_name + uploaded_by + uploaded_at columns
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

-- Widen the category allow-list to include every workflow + financial doc type
alter table public.listing_documents drop constraint if exists listing_documents_category_check;
alter table public.listing_documents add constraint listing_documents_category_check check (
  category in (
    'nda','listing_agreement','purchase_agreement','marketing_agreement',
    'financial_proof','financial_statement','tax_return','bank_statement',
    'generated_document','closing_statement','due_diligence','other'
  )
);

-- Widen the status allow-list (pending | signed | active | draft)
alter table public.listing_documents drop constraint if exists listing_documents_status_check;
alter table public.listing_documents add constraint listing_documents_status_check check (
  status in ('pending','signed','active','draft')
);

-- party_type allow-list is already correct (seller | buyer) — keep as-is.

-- Restore permissive-but-sane RLS for the broker team
drop policy if exists "listing_documents_select" on public.listing_documents;
create policy "listing_documents_select" on public.listing_documents for select to authenticated using (true);
drop policy if exists "listing_documents_insert" on public.listing_documents;
create policy "listing_documents_insert" on public.listing_documents for insert to authenticated with check (true);
drop policy if exists "listing_documents_update" on public.listing_documents;
create policy "listing_documents_update" on public.listing_documents for update to authenticated using (true);
drop policy if exists "listing_documents_delete" on public.listing_documents;
create policy "listing_documents_delete" on public.listing_documents for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 2. seller_leads — widen status allow-list to the app's unified funnel
-- ---------------------------------------------------------------------------
alter table public.seller_leads drop constraint if exists seller_leads_status_check;
alter table public.seller_leads add constraint seller_leads_status_check check (
  status in ('new','qualifying','qualified','handed_off','not_a_fit','contacted','closed')
);

-- ---------------------------------------------------------------------------
-- 3. lead_activities — activity/notes logging for leads (recreate if missing)
-- ---------------------------------------------------------------------------
create table if not exists public.lead_activities (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null,
  type        text not null default 'note',            -- note | call | email | meeting | conversion
  description text not null,
  created_at  timestamptz not null default now()
);
create index if not exists lead_activities_lead_id_idx on public.lead_activities (lead_id);
alter table public.lead_activities enable row level security;
drop policy if exists "lead_activities_insert" on public.lead_activities;
create policy "lead_activities_insert" on public.lead_activities for insert to authenticated with check (true);
drop policy if exists "lead_activities_select" on public.lead_activities;
create policy "lead_activities_select" on public.lead_activities for select to authenticated using (true);
drop policy if exists "lead_activities_delete" on public.lead_activities;
create policy "lead_activities_delete" on public.lead_activities for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 4. profiles.role — ensure the column exists (used by financial_documents RLS)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='profiles' and column_name='role') then
    alter table public.profiles add column role text not null default 'agent';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. financial_documents — per-deal/listing financial file management
-- ---------------------------------------------------------------------------
create table if not exists public.financial_documents (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid references public.deals(id) on delete cascade,
  listing_id    uuid references public.listings(id) on delete cascade,
  file_name     text not null,
  file_url      text not null,
  storage_path  text,
  file_size     bigint,
  mime_type     text,
  file_kind     text not null default 'other',         -- pdf | excel | word | image | other
  category      text not null default 'other',         -- tax_return | financial_statement | bank_statement | generated_document | other
  status        text not null default 'pending',       -- pending | processed | recast_done | bov_done | cim_done
  notes         text,
  uploaded_by   uuid references public.profiles(id) on delete set null,
  uploaded_at   timestamptz not null default now(),
  unique (storage_path)
);
create index if not exists financial_documents_deal_idx on public.financial_documents (deal_id);
create index if not exists financial_documents_listing_idx on public.financial_documents (listing_id);
create index if not exists financial_documents_uploaded_by_idx on public.financial_documents (uploaded_by);
create index if not exists financial_documents_status_idx on public.financial_documents (status);
create index if not exists financial_documents_category_idx on public.financial_documents (category);

alter table public.financial_documents enable row level security;

-- Helper: is the authenticated user a broker or admin?
create or replace function public.is_broker_or_admin()
returns boolean
language sql stable security definer
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    'agent'
  ) in ('broker', 'admin');
$$;

drop policy if exists "fd_select" on public.financial_documents;
create policy "fd_select" on public.financial_documents for select to authenticated using (true);
drop policy if exists "fd_insert" on public.financial_documents;
create policy "fd_insert" on public.financial_documents for insert to authenticated with check (true);
drop policy if exists "fd_update" on public.financial_documents;
create policy "fd_update" on public.financial_documents for update to authenticated
  using (public.is_broker_or_admin() or uploaded_by = auth.uid());
drop policy if exists "fd_delete" on public.financial_documents;
create policy "fd_delete" on public.financial_documents for delete to authenticated
  using (public.is_broker_or_admin() or uploaded_by = auth.uid());

-- Convenience auto-tag helper (mirrors app-layer kindFromName)
create or replace function public.guess_financial_category(file_name text)
returns text
language sql immutable
as $$
  select case
    when file_name ilike '%tax%' or file_name ilike '%return%' or file_name ilike '%1040%'
         or file_name ilike '%1120%' or file_name ilike '%k-1%' or file_name ilike '%k1%'
      then 'tax_return'
    when file_name ilike '%bank%' or (file_name ilike '%account%' and file_name ilike '%statement%')
      then 'bank_statement'
    when file_name ilike '%p&l%' or file_name ilike '%pnl%' or file_name ilike '%profit%loss%'
         or file_name ilike '%income statement%' or file_name ilike '%balance sheet%'
      then 'financial_statement'
    when file_name ilike '%cim%' or file_name ilike '%bov%' or file_name ilike '%recast%' or file_name ilike '%bli%'
      then 'generated_document'
    else 'other'
  end;
$$;

grant execute on function public.is_broker_or_admin() to authenticated;
grant execute on function public.guess_financial_category(text) to authenticated;

-- =============================================================================
-- DONE. After running, refresh the PostgREST schema cache if any table still
-- reports "Could not find the table/column" (Supabase dashboard sometimes caches).
-- =============================================================================
