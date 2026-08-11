-- Diagnostic only — does not change anything. Run in the Supabase SQL
-- Editor and share the output (the "function_source" column especially).
--
-- We know a trigger on financial_documents fails with 'column "name" does
-- not exist' whenever a real deal_id is inserted — almost certainly because
-- it looks up a deal's name via `deals.name`, but the live `deals` table's
-- column is actually `title`, not `name`. This finds the exact trigger and
-- its source so the fix can be precise instead of a guess.

select
  t.tgname as trigger_name,
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_source
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
where t.tgrelid = 'public.financial_documents'::regclass
  and not t.tgisinternal;
