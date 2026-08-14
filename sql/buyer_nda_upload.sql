-- =============================================================================
-- CONCORD DEAL PLATFORM — Buyer NDA document upload (2026-08-14)
-- =============================================================================
-- Lets a broker attach the actual signed NDA file to a buyer_lists row (for
-- NDAs that happened outside the platform — email, in-person, paper — so
-- there's still a document on file, downloadable/printable later). Separate
-- from listing_nda_signatures, which is the real accountless public-signing
-- flow's own record — this is manual record-keeping for the manual buyer
-- roster (Step 9 Buyer Management).
--
-- The file itself is stored in the private `financial_docs` bucket (never
-- the public `documents` bucket — buyer NDAs contain PII), under
-- buyer-ndas/<buyer_id>/..., resolved via signed URLs at download time
-- (same convention as every other document in this bucket).
--
-- Run this ONCE in the Supabase SQL Editor. Idempotent.
-- =============================================================================

alter table public.buyer_lists
  add column if not exists nda_document_path text,
  add column if not exists nda_document_name text,
  add column if not exists nda_document_uploaded_at timestamptz;

-- =============================================================================
-- DONE.
-- =============================================================================
