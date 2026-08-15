-- =============================================================================
-- CONCORD DEAL PLATFORM — Proof of Funds document upload (2026-08-15)
-- =============================================================================
-- buyer_lists already has financial_proof_uploaded/financial_proof_url
-- (original schema, sql/workflow_schema.sql) but no UI ever wrote to them —
-- only a manual "Mark financially qualified" checkbox existed. This adds
-- real document storage (mirroring the buyer-NDA-upload pattern from
-- sql/buyer_nda_upload.sql — private financial_docs bucket, signed URLs) plus
-- the "Verified Amount / Expiry" fields the blueprint calls for, which
-- didn't exist in any form.
--
-- Run this ONCE in the Supabase SQL Editor. Idempotent.
-- =============================================================================

alter table public.buyer_lists
  add column if not exists pof_document_path text,
  add column if not exists pof_document_name text,
  add column if not exists pof_document_uploaded_at timestamptz,
  add column if not exists pof_verified_amount numeric,
  add column if not exists pof_expiry_date date;

-- =============================================================================
-- DONE.
-- =============================================================================
