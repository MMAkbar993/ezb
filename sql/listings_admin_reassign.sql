-- ---------------------------------------------------------------------------
-- listings_owner_update (sql/rls_enable.sql) only lets a listing's own
-- agent_id (or the never-populated agency_members admin check) update that
-- row. That silently blocks the new admin/broker "reassign agent" picker in
-- ListingsDashboard.tsx whenever the caller isn't already the assigned
-- agent. Add an admin/broker bypass mirroring the profiles admin-read
-- pattern used elsewhere (role in profiles, not the unused agency_members
-- table).
-- ---------------------------------------------------------------------------
drop policy if exists "listings_owner_update" on public.listings;
create policy "listings_owner_update" on public.listings
  for update using (
    coalesce(agent_id, auth.uid()) = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'broker'))
  );
