-- ---------------------------------------------------------------------------
-- Manual BizBuySell workflow (client's explicit instruction: BizBuySell is
-- entered MANUALLY — no API integration). Tracks that a broker/admin has
-- copied a listing into BizBuySell by hand, using the same nullable-FK +
-- default-now audit-column convention as financial_documents.uploaded_by /
-- deal_documents.uploaded_by_role. Separate from the existing simulated
-- auto-sync system (bbs_syncs, sql/phase2_schema.sql) — that table and its
-- workflow are untouched.
-- ---------------------------------------------------------------------------
alter table public.listings add column if not exists bizbuysell_uploaded boolean not null default false;
alter table public.listings add column if not exists bizbuysell_uploaded_by uuid references public.profiles(id) on delete set null;
alter table public.listings add column if not exists bizbuysell_uploaded_at timestamptz;
