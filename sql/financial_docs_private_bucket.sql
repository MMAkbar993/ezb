-- =============================================================================
-- CONCORD DEAL PLATFORM — Move financial documents to a private bucket (2026-08-12)
-- =============================================================================
-- SECURITY FIX: financial_documents (tax returns, P&L, bank statements, and
-- every generated Recast/BOV/CIM/BLI PDF) were being uploaded to the
-- `documents` bucket, which is public-read at the bucket level. Anyone with
-- the file URL — no NDA, no login — could download the actual financial
-- documents. The NDA gate only ever protected the four summary numbers shown
-- on the public listing page, never the underlying files.
--
-- `financial_docs` already existed as a private bucket (created in
-- phase2_schema.sql) but the app never used it. This migration wires it up
-- with authenticated-only RLS. The app code now uploads/downloads financial
-- documents through this bucket via short-lived signed URLs instead of
-- permanent public links.
--
-- Run this ONCE in the Supabase SQL Editor. Idempotent.
-- =============================================================================

-- Ensure the bucket exists and is private (idempotent; already created by
-- phase2_schema.sql, this just guarantees the setting regardless of history).
insert into storage.buckets (id, name, public)
values ('financial_docs', 'financial_docs', false)
on conflict (id) do update set public = false;

-- Authenticated brokers can read/upload/delete financial documents. No public
-- policy is created — private buckets reject anonymous/public requests by
-- default, and access is only ever granted via a signed URL generated
-- server/client-side for a signed-in user.
drop policy if exists "financial_docs_auth_read" on storage.objects;
create policy "financial_docs_auth_read" on storage.objects
  for select to authenticated using (bucket_id = 'financial_docs');

drop policy if exists "financial_docs_auth_insert" on storage.objects;
create policy "financial_docs_auth_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'financial_docs');

drop policy if exists "financial_docs_auth_delete" on storage.objects;
create policy "financial_docs_auth_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'financial_docs');

-- =============================================================================
-- DONE. Existing financial documents already uploaded to the public
-- `documents` bucket are NOT moved by this migration (no destructive storage
-- operation runs automatically) — see the message accompanying this file for
-- how to handle files already uploaded before this fix.
-- =============================================================================
