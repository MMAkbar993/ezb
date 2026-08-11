-- =============================================================================
-- CONCORD DEAL PLATFORM — CRITICAL: Storage RLS fix (2026-08-11)
-- =============================================================================
-- Same class of bug as sql/critical_rls_write_fix.sql, but for Storage this
-- time: real authenticated uploads were rejected with "new row violates row
-- level security policy" on 6 of the 10 buckets, even though every bucket
-- itself exists. This is why Step 1's legal-document upload failed
-- ("Upload failed — ensure the documents bucket exists" — the bucket exists;
-- its object-level RLS policy for INSERT did not) and very likely why an
-- uploaded bank statement in Financial Files appeared to "disappear" (the
-- storage upload failed silently before the DB row could reference a real
-- file).
--
-- Confirmed BROKEN for a real authenticated session (2026-08-11):
--   documents, broker_photos, recast_docs, bov_docs, cim_docs, bli_docs
-- Confirmed WORKING already (left untouched): listing_images, profile_images,
--   training, financial_docs
--
-- Run this ONCE in the Supabase SQL Editor. Idempotent, safe to re-run.
-- =============================================================================

do $$
declare
  b text;
  buckets text[] := array['documents', 'broker_photos', 'recast_docs', 'bov_docs', 'cim_docs', 'bli_docs'];
  is_public boolean;
begin
  foreach b in array buckets loop
    select public into is_public from storage.buckets where id = b;
    if is_public is null then
      raise notice 'Bucket % does not exist — skipped', b;
      continue;
    end if;

    -- Public read (matches the bucket's own public=true setting) — anon can
    -- view/download; only authenticated users can write.
    execute format('drop policy if exists %I on storage.objects', b || '_public_read');
    execute format(
      'create policy %I on storage.objects for select using (bucket_id = %L)',
      b || '_public_read', b
    );

    execute format('drop policy if exists %I on storage.objects', b || '_auth_insert');
    execute format(
      'create policy %I on storage.objects for insert to authenticated with check (bucket_id = %L)',
      b || '_auth_insert', b
    );

    execute format('drop policy if exists %I on storage.objects', b || '_auth_update');
    execute format(
      'create policy %I on storage.objects for update to authenticated using (bucket_id = %L)',
      b || '_auth_update', b
    );

    execute format('drop policy if exists %I on storage.objects', b || '_auth_delete');
    execute format(
      'create policy %I on storage.objects for delete to authenticated using (bucket_id = %L)',
      b || '_auth_delete', b
    );

    raise notice 'Storage RLS policies reset for bucket: %', b;
  end loop;
end $$;

-- =============================================================================
-- DONE.
-- =============================================================================
