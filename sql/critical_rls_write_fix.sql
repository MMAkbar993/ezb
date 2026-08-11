-- =============================================================================
-- CONCORD DEAL PLATFORM — CRITICAL: RLS write-policy fix (2026-08-11)
-- =============================================================================
-- Every write in this session up to now was verified using the service-role
-- key, which bypasses RLS entirely. Testing with a REAL authenticated session
-- (as a real logged-in user would experience) revealed that nearly every
-- write table on this database rejects inserts with 42501 "new row violates
-- row-level security policy" — meaning the actual dashboard has been
-- fundamentally broken for real users this whole time, regardless of the
-- application-code fixes made earlier. This is very likely the true root
-- cause behind most of what's been reported broken.
--
-- Confirmed BROKEN for a real authenticated session (2026-08-11):
--   buyer_leads, seller_leads, lead_activities, deals, deal_documents,
--   deal_agreements, deal_closing_details, due_diligence_items,
--   cim_versions, bov_versions, buyer_lists
-- Confirmed WORKING already (left untouched): listings, listing_documents,
--   financial_documents
--
-- This migration re-asserts the same permissive "any authenticated broker"
-- policy convention already proven to work on listings/listing_documents/
-- financial_documents — for every table found broken above. Idempotent, safe
-- to re-run. Run this ONE file — it supersedes needing to individually chase
-- each table.
-- =============================================================================

do $$
declare
  t text;
  tables text[] := array[
    'buyer_leads', 'seller_leads', 'lead_activities', 'deals', 'deal_documents',
    'deal_agreements', 'deal_closing_details', 'due_diligence_items',
    'cim_versions', 'bov_versions', 'buyer_lists'
  ];
begin
  foreach t in array tables loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      execute format('alter table public.%I enable row level security', t);

      execute format('drop policy if exists %I on public.%I', t || '_auth_select', t);
      execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_auth_select', t);

      execute format('drop policy if exists %I on public.%I', t || '_auth_insert', t);
      execute format('create policy %I on public.%I for insert to authenticated with check (true)', t || '_auth_insert', t);

      execute format('drop policy if exists %I on public.%I', t || '_auth_update', t);
      execute format('create policy %I on public.%I for update to authenticated using (true)', t || '_auth_update', t);

      execute format('drop policy if exists %I on public.%I', t || '_auth_delete', t);
      execute format('create policy %I on public.%I for delete to authenticated using (true)', t || '_auth_delete', t);

      raise notice 'RLS policies reset for table: %', t;
    else
      raise notice 'Table % does not exist — skipped', t;
    end if;
  end loop;
end $$;

-- =============================================================================
-- DONE. This intentionally does NOT touch listings/listing_documents/
-- financial_documents (already confirmed working) or profiles (has its own
-- deliberately stricter, already-correct policy set from earlier work).
-- =============================================================================
