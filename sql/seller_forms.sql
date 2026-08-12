-- =============================================================================
-- CONCORD DEAL PLATFORM — Seller legal-document forms (2026-08-12)
-- =============================================================================
-- Five per-listing seller documents (Seller Interview Form, Exclusive
-- Marketing & Listing Agreement, Corporate Authorization Resolution, LLC
-- Authorization Resolution, Documentation Checklist), each as one row of
-- structured field data (jsonb) rather than one column per field — matches
-- the existing recast_projects convention (years_json/addbacks_json) for
-- "structured worksheet keyed by listing_id."
--
-- The broker fills these in-app, then can generate a share_token to send the
-- seller a no-login link to review and sign remotely — same "token IS the
-- auth" pattern as listing_nda_signatures and client_portal_access, both
-- already in production use in this app.
--
-- Run this ONCE in the Supabase SQL Editor. Idempotent.
-- =============================================================================

create table if not exists public.seller_forms (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references public.listings(id) on delete cascade,
  form_type     text not null check (form_type in
                  ('seller_interview','listing_agreement','corp_resolution','llc_resolution','doc_checklist')),
  form_data     jsonb not null default '{}'::jsonb,
  status        text not null default 'draft' check (status in ('draft','sent','signed')),
  share_token   text unique,
  signer_name   text,
  signer_title  text,
  signed_at     timestamptz,
  ip_address    text,
  user_agent    text,
  pdf_url       text,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (listing_id, form_type)
);

alter table public.seller_forms enable row level security;

-- Broker team: full read/write, same "any authenticated broker" convention
-- used throughout this schema (see sql/rls_enable.sql).
drop policy if exists "seller_forms_auth_select" on public.seller_forms;
create policy "seller_forms_auth_select" on public.seller_forms
  for select to authenticated using (true);

drop policy if exists "seller_forms_auth_insert" on public.seller_forms;
create policy "seller_forms_auth_insert" on public.seller_forms
  for insert to authenticated with check (true);

drop policy if exists "seller_forms_auth_update" on public.seller_forms;
create policy "seller_forms_auth_update" on public.seller_forms
  for update to authenticated using (true);

drop policy if exists "seller_forms_auth_delete" on public.seller_forms;
create policy "seller_forms_auth_delete" on public.seller_forms
  for delete to authenticated using (true);

-- No public policy — the seller-facing sign link is served exclusively
-- through service-role API routes (app/api/seller-form/*), which re-validate
-- share_token on every request, identical in spirit to the NDA and client
-- portal routes.

create index if not exists seller_forms_listing_id_idx on public.seller_forms (listing_id);

-- =============================================================================
-- DONE.
-- =============================================================================
