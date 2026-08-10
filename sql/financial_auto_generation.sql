-- =============================================================================
-- AUTO-GENERATION — financial files schema update
-- -----------------------------------------------------------------------------
-- Extends financial_documents status tracking for the One-Click auto-generation
-- pipeline: adds 'bli_done' (BLI = Business Listing Information) and 'failed'
-- to the workflow statuses, plus a helper to mark generated documents.
--
-- RUN: Supabase SQL Editor. Idempotent — safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Optional CHECK constraint on status (replaces the unconstrained text
--    column's accepted values). Uses DO block so it's safe whether or not a
--    constraint already exists.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.financial_documents'::regclass
      and conname = 'financial_documents_status_check'
  ) then
    alter table public.financial_documents
      add constraint financial_documents_status_check
      check (status in (
        'pending', 'processed', 'recast_done', 'bov_done', 'cim_done', 'bli_done', 'failed'
      ));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Index on status (speeds up dashboard status filtering / KPIs)
-- ---------------------------------------------------------------------------
create index if not exists financial_documents_status_idx
  on public.financial_documents (status);

-- ---------------------------------------------------------------------------
-- 3) Helper: mark all source (non-generated) financial docs for a listing/deal
--    as 'processed'. Used by the pipeline after auto-generation completes.
-- ---------------------------------------------------------------------------
create or replace function public.mark_financial_sources_processed(p_listing_id uuid, p_deal_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.financial_documents
    set status = 'processed'
    where category <> 'generated_document'
      and ( (p_listing_id is not null and listing_id = p_listing_id)
            or (p_deal_id is not null and deal_id = p_deal_id) );
end;
$$;

grant execute on function public.mark_financial_sources_processed(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Helper: list generated documents for a listing/deal (convenience for
--    future queries / dashboards).
-- ---------------------------------------------------------------------------
create or replace function public.financial_generated_docs(p_listing_id uuid, p_deal_id uuid default null)
returns table (
  id uuid, file_name text, file_url text, status text, uploaded_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select fd.id, fd.file_name, fd.file_url, fd.status, fd.uploaded_at
  from public.financial_documents fd
  where fd.category = 'generated_document'
    and ( (p_listing_id is not null and fd.listing_id = p_listing_id)
          or (p_deal_id is not null and fd.deal_id = p_deal_id) )
  order by fd.uploaded_at desc;
$$;

grant execute on function public.financial_generated_docs(uuid, uuid) to authenticated;
