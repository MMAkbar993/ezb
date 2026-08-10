-- =============================================================================
-- financial_documents — per-deal/listing financial file management
-- -----------------------------------------------------------------------------
-- Multi-file uploads, delete (owner + broker/admin), auto-tagging, workflow
-- status tracking (Pending / Processed / Recast Done / BOV Done / CIM Done),
-- and RLS: only the agent who uploaded may delete, broker/admin see all.
--
-- Roles: profiles.role in ('agent'|'broker'|'admin'). run after workflow_schema.
-- Idempotent — safe to re-run.
-- =============================================================================

-- Ensure a `role` column exists on profiles (agent / broker / admin)
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='profiles' and column_name='role') then
    alter table public.profiles add column role text not null default 'agent';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.financial_documents (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid references public.deals(id) on delete cascade,
  listing_id    uuid references public.listings(id) on delete cascade,
  file_name     text not null,
  file_url      text not null,
  storage_path  text,                                  -- path inside the 'documents' bucket
  file_size     bigint,                                -- bytes
  mime_type     text,
  file_kind     text not null default 'other',         -- pdf | excel | word | image | other
  category      text not null default 'other',         -- auto-tagged: tax_return | financial_statement | bank_statement | generated_document | other
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

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
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

-- SELECT: broker/admin see all; agents see files they uploaded OR files for
--         deals/listings they own. (Kept simple & permissive for the broker
--         team: every authenticated user may read the shared financial folder.
--         Role-scoped delete below is the security gate.)
drop policy if exists "fd_select" on public.financial_documents;
create policy "fd_select" on public.financial_documents
  for select to authenticated using (true);

-- INSERT: any authenticated user may add a financial file to a deal/listing
drop policy if exists "fd_insert" on public.financial_documents;
create policy "fd_insert" on public.financial_documents
  for insert to authenticated with check (true);

-- UPDATE: brokers/admins may update status/notes/category; agents may update
--         their own records (e.g. correct a category).
drop policy if exists "fd_update" on public.financial_documents;
create policy "fd_update" on public.financial_documents
  for update to authenticated
  using (public.is_broker_or_admin() or uploaded_by = auth.uid());

-- DELETE: broker/admin may delete any; an agent may delete ONLY files they
--         uploaded. (Requirement #8.)
drop policy if exists "fd_delete" on public.financial_documents;
create policy "fd_delete" on public.financial_documents
  for delete to authenticated
  using (public.is_broker_or_admin() or uploaded_by = auth.uid());

-- ---------------------------------------------------------------------------
-- Convenience: auto-tag helper used by the app layer (mirrors kindFromName)
-- ---------------------------------------------------------------------------
create or replace function public.guess_financial_category(file_name text)
returns text
language sql immutable
as $$
  select case
    when file_name ilike '%tax%' or file_name ilike '%return%' or file_name ilike '%1040%'
         or file_name ilike '%1120%' or file_name ilike '%k-1%' or file_name ilike '%k1%'
      then 'tax_return'
    when file_name ilike '%bank%' or file_name ilike '%statement%' and file_name ilike '%account%'
      then 'bank_statement'
    when file_name ilike '%p&l%' or file_name ilike '%pnl%' or file_name ilike '%profit%loss%'
         or file_name ilike '%income statement%' or file_name ilike '%balance sheet%' or file_name ilike '%balance%'
      then 'financial_statement'
    when file_name ilike '%cim%' or file_name ilike '%bov%' or file_name ilike '%recast%' or file_name ilike '%bli%'
      then 'generated_document'
    else 'other'
  end;
$$;

grant execute on function public.is_broker_or_admin() to authenticated;
grant execute on function public.guess_financial_category(text) to authenticated;
