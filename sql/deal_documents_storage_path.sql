-- =============================================================================
-- CONCORD DEAL PLATFORM — Client Portal document storage path (2026-08-15)
-- =============================================================================
-- Fixes the Client Portal upload feature, which was fully broken: the route
-- (app/api/portal/route.ts) inserted `file_path` AND `category` columns into
-- deal_documents, neither of which exists on the live table (`id, deal_id,
-- file_name, file_url, uploaded_by, created_at` only, per lib/documents.ts's
-- documented live schema), so every upload failed at the DB insert step even
-- after the request-parsing bug was fixed.
--
-- Also moves portal uploads from the PUBLIC `documents` bucket to the
-- private `financial_docs` bucket — client-uploaded deal documents can
-- contain financial/personal information, the same PII-exposure pattern
-- already found and fixed twice this session (seller-forms, buyer NDAs).
-- `storage_path` is what the app resolves a short-lived signed URL from at
-- read time; `file_url` is kept for backward compatibility with any rows
-- inserted before this migration (their public URL still worked at the time).
--
-- Run this ONCE in the Supabase SQL Editor. Idempotent.
-- =============================================================================

alter table public.deal_documents
  add column if not exists storage_path text,
  add column if not exists category text;

-- =============================================================================
-- DONE.
-- =============================================================================
