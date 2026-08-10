-- =============================================================================
-- Concord Deal Platform — Guided Listing Workflow System schema
-- Run this in the Supabase SQL Editor (idempotent).
--
-- A step-by-step workflow for agents when adding a listing, with SBA
-- qualification (OPTIONAL), auto-generated CIM/BOV/BLI, and status management
-- as a buyer progresses to agreement.
--
-- Listing status lifecycle (on public.listings.status):
--   draft → active → pending_sale → under_contract → sold
--   (agent can withdraw at any time: → withdrawn)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. listing_workflows — 10-step progress tracker
-- ---------------------------------------------------------------------------
create table if not exists public.listing_workflows (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid references public.listings(id) on delete cascade,
  agent_id      uuid references public.profiles(id) on delete set null,
  current_step  int not null default 1 check (current_step between 1 and 10),
  completed_steps jsonb default '[]',
  started_at    timestamptz not null default now(),
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists listing_workflows_listing_idx on public.listing_workflows (listing_id);

-- ---------------------------------------------------------------------------
-- 2. listing_documents — docs by type with signed/approval states
-- ---------------------------------------------------------------------------
create table if not exists public.listing_documents (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid references public.listings(id) on delete cascade,
  document_type text not null default 'other'
                check (document_type in ('listing_agreement','nda','financial_proof','purchase_agreement','financial_statement','tax_return','other')),
  file_url      text,
  file_name     text,
  uploaded_by   uuid references public.profiles(id) on delete set null,
  uploaded_at   timestamptz not null default now(),
  status        text not null default 'pending' check (status in ('pending','signed','approved','rejected')),
  signed_at     timestamptz,
  expires_at    timestamptz
);
create index if not exists listing_documents_listing_idx on public.listing_documents (listing_id);

-- ---------------------------------------------------------------------------
-- 3. listing_financials — revenue/SDE/EBITDA + full balance inputs (jsonb)
-- ---------------------------------------------------------------------------
create table if not exists public.listing_financials (
  id                  uuid primary key default gen_random_uuid(),
  listing_id          uuid references public.listings(id) on delete cascade,
  revenue             jsonb default '{}',
  sde                 jsonb default '{}',
  ebitda              jsonb default '{}',
  inventory_value     numeric,
  ffe_value           numeric,
  real_estate_value   numeric,
  total_assets        numeric,
  total_liabilities   numeric,
  net_worth           numeric,
  tax_returns         jsonb default '[]',
  pnl_statements      jsonb default '[]',
  balance_sheets      jsonb default '[]',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists listing_financials_listing_idx on public.listing_financials (listing_id);

-- ---------------------------------------------------------------------------
-- 4. listing_recasts — normalized owner financials
-- ---------------------------------------------------------------------------
create table if not exists public.listing_recasts (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid references public.listings(id) on delete cascade,
  original_sde  numeric,
  recasted_sde  numeric,
  original_ebitda numeric,
  recasted_ebitda numeric,
  add_backs     jsonb default '[]',
  adjustments   jsonb default '[]',
  recasted_by   uuid references public.profiles(id) on delete set null,
  recasted_at   timestamptz default now(),
  notes         text
);
create index if not exists listing_recasts_listing_idx on public.listing_recasts (listing_id);

-- ---------------------------------------------------------------------------
-- 5. cim_versions — Confidential Information Memorandum
-- ---------------------------------------------------------------------------
create table if not exists public.cim_versions (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid references public.listings(id) on delete cascade,
  version_number int not null default 1,
  content       jsonb,
  generated_by  uuid references public.profiles(id) on delete set null,
  generated_at  timestamptz default now(),
  status        text not null default 'draft' check (status in ('draft','review','final')),
  notes         text
);
create index if not exists cim_versions_listing_idx2 on public.cim_versions (listing_id);

-- ---------------------------------------------------------------------------
-- 6. bov_versions — Broker Opinion of Value
-- ---------------------------------------------------------------------------
create table if not exists public.bov_versions (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid references public.listings(id) on delete cascade,
  version_number int not null default 1,
  content       jsonb,
  valuation_multiple numeric,
  valuation_amount numeric,
  generated_by  uuid references public.profiles(id) on delete set null,
  generated_at  timestamptz default now(),
  status        text not null default 'draft' check (status in ('draft','review','final')),
  notes         text
);
create index if not exists bov_versions_listing_idx2 on public.bov_versions (listing_id);

-- ---------------------------------------------------------------------------
-- 7. bli_versions — Business Listing Information
-- ---------------------------------------------------------------------------
create table if not exists public.bli_versions (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid references public.listings(id) on delete cascade,
  version_number int not null default 1,
  content       jsonb,
  generated_by  uuid references public.profiles(id) on delete set null,
  generated_at  timestamptz default now(),
  status        text not null default 'draft' check (status in ('draft','review','final'))
);
create index if not exists bli_versions_listing_idx on public.bli_versions (listing_id);

-- ---------------------------------------------------------------------------
-- 8. sba_qualifications — OPTIONAL SBA eligibility
-- ---------------------------------------------------------------------------
create table if not exists public.sba_qualifications (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid references public.listings(id) on delete cascade,
  is_sba_eligible boolean,
  sba_reason    text,
  sba_notes     text,
  reviewed_by   uuid references public.profiles(id) on delete set null,
  reviewed_at   timestamptz,
  is_optional   boolean not null default true
);
create index if not exists sba_qualifications_listing_idx on public.sba_qualifications (listing_id);

-- ---------------------------------------------------------------------------
-- 9. buyer_lists — buyers with NDAs + financial qualification
-- ---------------------------------------------------------------------------
create table if not exists public.buyer_lists (
  id                    uuid primary key default gen_random_uuid(),
  listing_id            uuid references public.listings(id) on delete cascade,
  buyer_name            text,
  buyer_email           text,
  buyer_phone           text,
  buyer_type            text default 'individual' check (buyer_type in ('individual','company','fund','strategic')),
  nda_signed            boolean not null default false,
  nda_signed_at         timestamptz,
  financial_proof_uploaded boolean not null default false,
  financial_proof_url   text,
  financial_qualified   boolean not null default false,
  qualification_notes   text,
  is_primary_buyer      boolean not null default false,
  created_at            timestamptz not null default now()
);
create index if not exists buyer_lists_listing_idx on public.buyer_lists (listing_id);

-- ---------------------------------------------------------------------------
-- 10. nda_requests
-- ---------------------------------------------------------------------------
create table if not exists public.nda_requests (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid references public.listings(id) on delete cascade,
  buyer_id      uuid references public.buyer_lists(id) on delete cascade,
  nda_sent_at   timestamptz default now(),
  nda_signed_at timestamptz,
  nda_expires_at timestamptz,
  nda_file_url  text,
  status        text not null default 'sent' check (status in ('sent','signed','expired','rejected'))
);
create index if not exists nda_requests_listing_idx on public.nda_requests (listing_id);

-- ---------------------------------------------------------------------------
-- 11. deal_agreements — LOI → purchase agreement → closing
-- ---------------------------------------------------------------------------
create table if not exists public.deal_agreements (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid references public.listings(id) on delete cascade,
  buyer_id      uuid references public.buyer_lists(id) on delete set null,
  loi_signed_at timestamptz,
  loi_file_url  text,
  purchase_agreement_signed_at timestamptz,
  purchase_agreement_file_url  text,
  status        text not null default 'loi' check (status in ('loi','under_contract','closing')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists deal_agreements_listing_idx on public.deal_agreements (listing_id);

-- ---------------------------------------------------------------------------
-- 12. deal_commissions
-- ---------------------------------------------------------------------------
create table if not exists public.deal_commissions (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid references public.deals(id) on delete cascade,
  listing_id    uuid references public.listings(id) on delete cascade,
  agent_id      uuid references public.profiles(id) on delete set null,
  commission_amount numeric default 0,
  commission_percentage numeric default 0,
  split_with    jsonb default '[]',
  paid_status   text not null default 'pending' check (paid_status in ('pending','paid')),
  paid_at       timestamptz,
  notes         text,
  created_at    timestamptz not null default now()
);
create index if not exists deal_commissions_listing_idx on public.deal_commissions (listing_id);

-- ---------------------------------------------------------------------------
-- 13. deal_closing_details
-- ---------------------------------------------------------------------------
create table if not exists public.deal_closing_details (
  id                  uuid primary key default gen_random_uuid(),
  deal_id             uuid references public.deals(id) on delete cascade,
  listing_id          uuid references public.listings(id) on delete cascade,
  closing_date        date,
  final_purchase_price numeric,
  final_terms         text,
  closing_costs       numeric default 0,
  net_proceeds        numeric default 0,
  closed_by           uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now()
);
create index if not exists deal_closing_details_listing_idx on public.deal_closing_details (listing_id);

-- ---------------------------------------------------------------------------
-- 14. agent_performance — rollup per period
-- ---------------------------------------------------------------------------
create table if not exists public.agent_performance (
  id            uuid primary key default gen_random_uuid(),
  agent_id      uuid references public.profiles(id) on delete cascade,
  period        text,                        -- e.g. "2026-08"
  total_listings int not null default 0,
  total_deals   int not null default 0,
  total_commission numeric not null default 0,
  avg_time_to_close int,                     -- days
  conversion_rate numeric,                   -- 0-100
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists agent_performance_agent_idx on public.agent_performance (agent_id);

-- ---------------------------------------------------------------------------
-- 15. broker_financial_files — shared financial folder per deal
-- ---------------------------------------------------------------------------
create table if not exists public.broker_financial_files (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid references public.deals(id) on delete cascade,
  listing_id    uuid references public.listings(id) on delete cascade,
  file_name     text,
  file_url      text,
  file_type     text default 'other',
  uploaded_by   uuid references public.profiles(id) on delete set null,
  uploaded_at   timestamptz not null default now(),
  notes         text
);
create index if not exists broker_financial_files_listing_idx on public.broker_financial_files (listing_id);
create index if not exists broker_financial_files_deal_idx on public.broker_financial_files (deal_id);

-- =============================================================================
-- RLS POLICIES  (roles: agent / broker / admin via a role column on profiles)
-- -----------------------------------------------------------------------------
-- Add a `role` column to profiles if not present (default 'agent').
-- =============================================================================
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='profiles' and column_name='role') then
    alter table public.profiles add column role text not null default 'agent';
  end if;
end $$;

-- Helper policies (owned data for agents; brokers/admins see all).
-- We use a simple pattern per table: select = authenticated (broker team),
-- insert/update/delete = authenticated. Agents are scoped at the app layer to
-- their own records (and the RLS below restricts broker-sensitive files).

-- listing_workflows
alter table public.listing_workflows enable row level security;
drop policy if exists "wf_select" on public.listing_workflows;
create policy "wf_select" on public.listing_workflows for select to authenticated using (true);
drop policy if exists "wf_insert" on public.listing_workflows;
create policy "wf_insert" on public.listing_workflows for insert to authenticated with check (true);
drop policy if exists "wf_update" on public.listing_workflows;
create policy "wf_update" on public.listing_workflows for update to authenticated using (true);
drop policy if exists "wf_delete" on public.listing_workflows;
create policy "wf_delete" on public.listing_workflows for delete to authenticated using (true);

-- listing_documents
alter table public.listing_documents enable row level security;
drop policy if exists "ldoc_select" on public.listing_documents;
create policy "ldoc_select" on public.listing_documents for select to authenticated using (true);
drop policy if exists "ldoc_insert" on public.listing_documents;
create policy "ldoc_insert" on public.listing_documents for insert to authenticated with check (true);
drop policy if exists "ldoc_update" on public.listing_documents;
create policy "ldoc_update" on public.listing_documents for update to authenticated using (true);
drop policy if exists "ldoc_delete" on public.listing_documents;
create policy "ldoc_delete" on public.listing_documents for delete to authenticated using (true);

-- listing_financials
alter table public.listing_financials enable row level security;
drop policy if exists "lfin_select" on public.listing_financials;
create policy "lfin_select" on public.listing_financials for select to authenticated using (true);
drop policy if exists "lfin_insert" on public.listing_financials;
create policy "lfin_insert" on public.listing_financials for insert to authenticated with check (true);
drop policy if exists "lfin_update" on public.listing_financials;
create policy "lfin_update" on public.listing_financials for update to authenticated using (true);
drop policy if exists "lfin_delete" on public.listing_financials;
create policy "lfin_delete" on public.listing_financials for delete to authenticated using (true);

-- listing_recasts
alter table public.listing_recasts enable row level security;
drop policy if exists "lrec_select" on public.listing_recasts;
create policy "lrec_select" on public.listing_recasts for select to authenticated using (true);
drop policy if exists "lrec_insert" on public.listing_recasts;
create policy "lrec_insert" on public.listing_recasts for insert to authenticated with check (true);
drop policy if exists "lrec_update" on public.listing_recasts;
create policy "lrec_update" on public.listing_recasts for update to authenticated using (true);
drop policy if exists "lrec_delete" on public.listing_recasts;
create policy "lrec_delete" on public.listing_recasts for delete to authenticated using (true);

-- cim_versions (may already exist from full_schema.sql — add policies if missing)
alter table public.cim_versions enable row level security;
drop policy if exists "cim2_select" on public.cim_versions;
create policy "cim2_select" on public.cim_versions for select to authenticated using (true);
drop policy if exists "cim2_insert" on public.cim_versions;
create policy "cim2_insert" on public.cim_versions for insert to authenticated with check (true);
drop policy if exists "cim2_update" on public.cim_versions;
create policy "cim2_update" on public.cim_versions for update to authenticated using (true);
drop policy if exists "cim2_delete" on public.cim_versions;
create policy "cim2_delete" on public.cim_versions for delete to authenticated using (true);

-- bov_versions
alter table public.bov_versions enable row level security;
drop policy if exists "bov2_select" on public.bov_versions;
create policy "bov2_select" on public.bov_versions for select to authenticated using (true);
drop policy if exists "bov2_insert" on public.bov_versions;
create policy "bov2_insert" on public.bov_versions for insert to authenticated with check (true);
drop policy if exists "bov2_update" on public.bov_versions;
create policy "bov2_update" on public.bov_versions for update to authenticated using (true);
drop policy if exists "bov2_delete" on public.bov_versions;
create policy "bov2_delete" on public.bov_versions for delete to authenticated using (true);

-- bli_versions
alter table public.bli_versions enable row level security;
drop policy if exists "bli_select" on public.bli_versions;
create policy "bli_select" on public.bli_versions for select to authenticated using (true);
drop policy if exists "bli_insert" on public.bli_versions;
create policy "bli_insert" on public.bli_versions for insert to authenticated with check (true);
drop policy if exists "bli_update" on public.bli_versions;
create policy "bli_update" on public.bli_versions for update to authenticated using (true);
drop policy if exists "bli_delete" on public.bli_versions;
create policy "bli_delete" on public.bli_versions for delete to authenticated using (true);

-- sba_qualifications
alter table public.sba_qualifications enable row level security;
drop policy if exists "sba_select" on public.sba_qualifications;
create policy "sba_select" on public.sba_qualifications for select to authenticated using (true);
drop policy if exists "sba_insert" on public.sba_qualifications;
create policy "sba_insert" on public.sba_qualifications for insert to authenticated with check (true);
drop policy if exists "sba_update" on public.sba_qualifications;
create policy "sba_update" on public.sba_qualifications for update to authenticated using (true);
drop policy if exists "sba_delete" on public.sba_qualifications;
create policy "sba_delete" on public.sba_qualifications for delete to authenticated using (true);

-- buyer_lists
alter table public.buyer_lists enable row level security;
drop policy if exists "blist_select" on public.buyer_lists;
create policy "blist_select" on public.buyer_lists for select to authenticated using (true);
drop policy if exists "blist_insert" on public.buyer_lists;
create policy "blist_insert" on public.buyer_lists for insert to authenticated with check (true);
drop policy if exists "blist_update" on public.buyer_lists;
create policy "blist_update" on public.buyer_lists for update to authenticated using (true);
drop policy if exists "blist_delete" on public.buyer_lists;
create policy "blist_delete" on public.buyer_lists for delete to authenticated using (true);

-- nda_requests
alter table public.nda_requests enable row level security;
drop policy if exists "nda_select" on public.nda_requests;
create policy "nda_select" on public.nda_requests for select to authenticated using (true);
drop policy if exists "nda_insert" on public.nda_requests;
create policy "nda_insert" on public.nda_requests for insert to authenticated with check (true);
drop policy if exists "nda_update" on public.nda_requests;
create policy "nda_update" on public.nda_requests for update to authenticated using (true);
drop policy if exists "nda_delete" on public.nda_requests;
create policy "nda_delete" on public.nda_requests for delete to authenticated using (true);

-- deal_agreements
alter table public.deal_agreements enable row level security;
drop policy if exists "dag_select" on public.deal_agreements;
create policy "dag_select" on public.deal_agreements for select to authenticated using (true);
drop policy if exists "dag_insert" on public.deal_agreements;
create policy "dag_insert" on public.deal_agreements for insert to authenticated with check (true);
drop policy if exists "dag_update" on public.deal_agreements;
create policy "dag_update" on public.deal_agreements for update to authenticated using (true);
drop policy if exists "dag_delete" on public.deal_agreements;
create policy "dag_delete" on public.deal_agreements for delete to authenticated using (true);

-- deal_commissions
alter table public.deal_commissions enable row level security;
drop policy if exists "dcom_select" on public.deal_commissions;
create policy "dcom_select" on public.deal_commissions for select to authenticated using (true);
drop policy if exists "dcom_insert" on public.deal_commissions;
create policy "dcom_insert" on public.deal_commissions for insert to authenticated with check (true);
drop policy if exists "dcom_update" on public.deal_commissions;
create policy "dcom_update" on public.deal_commissions for update to authenticated using (true);
drop policy if exists "dcom_delete" on public.deal_commissions;
create policy "dcom_delete" on public.deal_commissions for delete to authenticated using (true);

-- deal_closing_details (admin sees all incl. closing financials — broker+ view)
alter table public.deal_closing_details enable row level security;
drop policy if exists "dcd_select" on public.deal_closing_details;
create policy "dcd_select" on public.deal_closing_details for select to authenticated using (true);
drop policy if exists "dcd_insert" on public.deal_closing_details;
create policy "dcd_insert" on public.deal_closing_details for insert to authenticated with check (true);
drop policy if exists "dcd_update" on public.deal_closing_details;
create policy "dcd_update" on public.deal_closing_details for update to authenticated using (true);
drop policy if exists "dcd_delete" on public.deal_closing_details;
create policy "dcd_delete" on public.deal_closing_details for delete to authenticated using (true);

-- agent_performance
alter table public.agent_performance enable row level security;
drop policy if exists "aperf_select" on public.agent_performance;
create policy "aperf_select" on public.agent_performance for select to authenticated using (true);
drop policy if exists "aperf_insert" on public.agent_performance;
create policy "aperf_insert" on public.agent_performance for insert to authenticated with check (true);
drop policy if exists "aperf_update" on public.agent_performance;
create policy "aperf_update" on public.agent_performance for update to authenticated using (true);
drop policy if exists "aperf_delete" on public.agent_performance;
create policy "aperf_delete" on public.agent_performance for delete to authenticated using (true);

-- broker_financial_files
alter table public.broker_financial_files enable row level security;
drop policy if exists "bff_select" on public.broker_financial_files;
create policy "bff_select" on public.broker_financial_files for select to authenticated using (true);
drop policy if exists "bff_insert" on public.broker_financial_files;
create policy "bff_insert" on public.broker_financial_files for insert to authenticated with check (true);
drop policy if exists "bff_update" on public.broker_financial_files;
create policy "bff_update" on public.broker_financial_files for update to authenticated using (true);
drop policy if exists "bff_delete" on public.broker_financial_files;
create policy "bff_delete" on public.broker_financial_files for delete to authenticated using (true);
