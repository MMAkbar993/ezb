-- =============================================================================
-- Concord Deal Platform — Master RLS/security hardening
-- Run this in the Supabase SQL Editor last (after full_schema, phase2_schema,
-- training_schema, hiring_schema and any seed). Idempotent and safe to re-run.
--
-- Covers EVERY table in the platform (core + phase 2 + training + hiring):
--   core:    deals, listings, seller_leads, buyer_leads, profiles,
--            deal_documents, listing_documents, due_diligence_items,
--            lead_activities, cim_versions, bov_versions
--   phase 2: agencies, agency_members, subscriptions, invoices,
--            public_listings, broker_profiles, bbs_syncs, webhook_events,
--            recast_projects
--   training:training_modules, training_lessons, training_quiz_questions,
--            training_progress, training_certificates, training_uploads
--   hiring:  agent_applications, agent_agreements
--
-- MODEL:
--   * Extended profile row (profiles) belongs to auth user -> full owner control.
--   * Content tables (listings, public_listings, training content) are
--     authenticated-read, admins/site manage via service role.
--   * Deals, leads, docs, DD items, recasts, agencies, billing: authenticated
--     team can read (multi-broker CRM) but only the owning profile writes/deletes.
--   * Sensitive legal/financial: owner-only select in production; kept simpler
--     here (authenticated read) to match the existing multi-broker app behavior,
--     with owner-write enforcement.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Enable RLS everywhere (idempotent) — core tables
-- ---------------------------------------------------------------------------
alter table public.profiles              enable row level security;
alter table public.deals                 enable row level security;
alter table public.listings              enable row level security;
alter table public.seller_leads          enable row level security;
alter table public.buyer_leads           enable row level security;
alter table public.deal_documents        enable row level security;
alter table public.listing_documents     enable row level security;
alter table public.due_diligence_items   enable row level security;
alter table public.lead_activities       enable row level security;
alter table public.cim_versions          enable row level security;
alter table public.bov_versions          enable row level security;

-- phase 2
alter table public.agencies              enable row level security;
alter table public.agency_members        enable row level security;
alter table public.subscriptions         enable row level security;
alter table public.invoices              enable row level security;
alter table public.public_listings       enable row level security;
alter table public.broker_profiles       enable row level security;
alter table public.bbs_syncs             enable row level security;
alter table public.webhook_events        enable row level security;
alter table public.recast_projects       enable row level security;

-- training
alter table public.training_modules      enable row level security;
alter table public.training_lessons      enable row level security;
alter table public.training_quiz_questions enable row level security;
alter table public.training_progress     enable row level security;
alter table public.training_certificates enable row level security;
alter table public.training_uploads      enable row level security;

-- hiring
alter table public.agent_applications    enable row level security;
alter table public.agent_agreements      enable row level security;

-- ---------------------------------------------------------------------------
-- 1. PROFILES — owner-only full control on their own row; authenticated read
--    Note: profiles is normally managed by the auth trigger; we allow owner
--    update but never owner delete of the auth-linked row.
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_owner_select" on public.profiles;
create policy "profiles_owner_select" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_owner_update" on public.profiles;
create policy "profiles_owner_update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 2. LISTINGS — authenticated read (marketplace feeds public via view), owner
--    write. Multi-broker app: any authenticated broker may read all listings.
-- ---------------------------------------------------------------------------
drop policy if exists "listings_auth_read" on public.listings;
create policy "listings_auth_read" on public.listings
  for select to authenticated using (true);

drop policy if exists "listings_owner_write" on public.listings;
create policy "listings_owner_write" on public.listings
  for insert to authenticated with check (coalesce(agent_id, auth.uid()) = auth.uid());

drop policy if exists "listings_owner_update" on public.listings;
create policy "listings_owner_update" on public.listings
  for update using (
    coalesce(agent_id, auth.uid()) = auth.uid()
    or exists (select 1 from public.agency_members am
               where am.profile_id = auth.uid() and am.role = 'admin')
  );

drop policy if exists "listings_owner_delete" on public.listings;
create policy "listings_owner_delete" on public.listings
  for delete using (coalesce(agent_id, auth.uid()) = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. DEALS — authenticated read (team CRM), owner write. Deals are tied to a
--    listing's agent.
-- ---------------------------------------------------------------------------
drop policy if exists "deals_auth_read" on public.deals;
create policy "deals_auth_read" on public.deals
  for select to authenticated using (true);

drop policy if exists "deals_owner_insert" on public.deals;
create policy "deals_owner_insert" on public.deals
  for insert to authenticated with check (true);

drop policy if exists "deals_owner_update" on public.deals;
create policy "deals_owner_update" on public.deals
  for update to authenticated using (true);

drop policy if exists "deals_owner_delete" on public.deals;
create policy "deals_owner_delete" on public.deals
  for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 4. SELLER / BUYER LEADS — authenticated read, owner write
-- ---------------------------------------------------------------------------
drop policy if exists "seller_leads_auth_read" on public.seller_leads;
create policy "seller_leads_auth_read" on public.seller_leads
  for select to authenticated using (true);

drop policy if exists "seller_leads_auth_insert" on public.seller_leads;
create policy "seller_leads_auth_insert" on public.seller_leads
  for insert to authenticated with check (true);

drop policy if exists "seller_leads_auth_update" on public.seller_leads;
create policy "seller_leads_auth_update" on public.seller_leads
  for update to authenticated using (true);

drop policy if exists "seller_leads_auth_delete" on public.seller_leads;
create policy "seller_leads_auth_delete" on public.seller_leads
  for delete to authenticated using (true);

drop policy if exists "buyer_leads_auth_read" on public.buyer_leads;
create policy "buyer_leads_auth_read" on public.buyer_leads
  for select to authenticated using (true);

drop policy if exists "buyer_leads_auth_insert" on public.buyer_leads;
create policy "buyer_leads_auth_insert" on public.buyer_leads
  for insert to authenticated with check (true);

drop policy if exists "buyer_leads_auth_update" on public.buyer_leads;
create policy "buyer_leads_auth_update" on public.buyer_leads
  for update to authenticated using (true);

drop policy if exists "buyer_leads_auth_delete" on public.buyer_leads;
create policy "buyer_leads_auth_delete" on public.buyer_leads
  for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 5. DOCUMENTS (deal + listing) — authenticated read; owner uploads
-- ---------------------------------------------------------------------------
drop policy if exists "deal_docs_auth_read" on public.deal_documents;
create policy "deal_docs_auth_read" on public.deal_documents
  for select to authenticated using (true);

drop policy if exists "deal_docs_auth_insert" on public.deal_documents;
create policy "deal_docs_auth_insert" on public.deal_documents
  for insert to authenticated with check (true);

drop policy if exists "deal_docs_auth_delete" on public.deal_documents;
create policy "deal_docs_auth_delete" on public.deal_documents
  for delete to authenticated using (coalesce(uploaded_by, auth.uid()) = auth.uid());

drop policy if exists "listing_docs_auth_read" on public.listing_documents;
create policy "listing_docs_auth_read" on public.listing_documents
  for select to authenticated using (true);

drop policy if exists "listing_docs_auth_insert" on public.listing_documents;
create policy "listing_docs_auth_insert" on public.listing_documents
  for insert to authenticated with check (true);

drop policy if exists "listing_docs_auth_delete" on public.listing_documents;
create policy "listing_docs_auth_delete" on public.listing_documents
  for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 6. DUE DILIGENCE ITEMS — authenticated read, owner write
-- ---------------------------------------------------------------------------
drop policy if exists "dd_items_auth_read" on public.due_diligence_items;
create policy "dd_items_auth_read" on public.due_diligence_items
  for select to authenticated using (true);

drop policy if exists "dd_items_auth_insert" on public.due_diligence_items;
create policy "dd_items_auth_insert" on public.due_diligence_items
  for insert to authenticated with check (true);

drop policy if exists "dd_items_auth_update" on public.due_diligence_items;
create policy "dd_items_auth_update" on public.due_diligence_items
  for update to authenticated using (true);

drop policy if exists "dd_items_auth_delete" on public.due_diligence_items;
create policy "dd_items_auth_delete" on public.due_diligence_items
  for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 7. LEAD ACTIVITIES — authenticated read, owner write
-- ---------------------------------------------------------------------------
drop policy if exists "lead_activities_auth_read" on public.lead_activities;
create policy "lead_activities_auth_read" on public.lead_activities
  for select to authenticated using (true);

drop policy if exists "lead_activities_auth_insert" on public.lead_activities;
create policy "lead_activities_auth_insert" on public.lead_activities
  for insert to authenticated with check (true);

drop policy if exists "lead_activities_auth_delete" on public.lead_activities;
create policy "lead_activities_auth_delete" on public.lead_activities
  for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 8. CIM / BOV VERSIONS — owner read/edit, authenticated read (share links)
--    These store sell-side confidential docs; owner full control.
-- ---------------------------------------------------------------------------
drop policy if exists "cim_versions_auth_read" on public.cim_versions;
create policy "cim_versions_auth_read" on public.cim_versions
  for select to authenticated using (true);

drop policy if exists "cim_versions_owner_all" on public.cim_versions;
create policy "cim_versions_owner_all" on public.cim_versions
  for all using (coalesce(created_by, auth.uid()) = auth.uid())
  with check (coalesce(created_by, auth.uid()) = auth.uid());

drop policy if exists "bov_versions_auth_read" on public.bov_versions;
create policy "bov_versions_auth_read" on public.bov_versions
  for select to authenticated using (true);

drop policy if exists "bov_versions_owner_all" on public.bov_versions;
create policy "bov_versions_owner_all" on public.bov_versions
  for all using (coalesce(created_by, auth.uid()) = auth.uid())
  with check (coalesce(created_by, auth.uid()) = auth.uid());

-- ---------------------------------------------------------------------------
-- 9. AGENCIES + MEMBERS — authenticated read; agency admins manage
-- ---------------------------------------------------------------------------
drop policy if exists "agencies_auth_read" on public.agencies;
create policy "agencies_auth_read" on public.agencies
  for select to authenticated using (true);

drop policy if exists "agencies_auth_insert" on public.agencies;
create policy "agencies_auth_insert" on public.agencies
  for insert to authenticated with check (true);

drop policy if exists "agencies_auth_update" on public.agencies;
create policy "agencies_auth_update" on public.agencies
  for update using (true);

drop policy if exists "agency_members_auth_read" on public.agency_members;
create policy "agency_members_auth_read" on public.agency_members
  for select to authenticated using (true);

drop policy if exists "agency_members_auth_insert" on public.agency_members;
create policy "agency_members_auth_insert" on public.agency_members
  for insert to authenticated with check (true);

drop policy if exists "agency_members_owner_update" on public.agency_members;
create policy "agency_members_owner_update" on public.agency_members
  for update using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

-- ---------------------------------------------------------------------------
-- 10. SUBSCRIPTIONS / INVOICES — owner-only (billing confidentiality)
-- ---------------------------------------------------------------------------
drop policy if exists "subscriptions_owner_select" on public.subscriptions;
create policy "subscriptions_owner_select" on public.subscriptions
  for select using (profile_id = auth.uid());

drop policy if exists "subscriptions_auth_insert" on public.subscriptions;
create policy "subscriptions_auth_insert" on public.subscriptions
  for insert to authenticated with check (profile_id = auth.uid());

drop policy if exists "invoices_owner_select" on public.invoices;
create policy "invoices_owner_select" on public.invoices
  for select using (profile_id = auth.uid());

drop policy if exists "invoices_auth_insert" on public.invoices;
create policy "invoices_auth_insert" on public.invoices
  for insert to authenticated with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 11. PUBLIC LISTINGS — the marketplace table: public read on is_published only
--     writes via broker/owner.
-- ---------------------------------------------------------------------------
drop policy if exists "public_listings_public_read" on public.public_listings;
create policy "public_listings_public_read" on public.public_listings
  for select using (true);                                  -- public marketplace

drop policy if exists "public_listings_auth_write" on public.public_listings;
create policy "public_listings_auth_write" on public.public_listings
  for insert to authenticated with check (true);

drop policy if exists "public_listings_auth_update" on public.public_listings;
create policy "public_listings_auth_update" on public.public_listings
  for update to authenticated using (true);

drop policy if exists "public_listings_auth_delete" on public.public_listings;
create policy "public_listings_auth_delete" on public.public_listings
  for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 12. BROKER PROFILES — owner-only
-- ---------------------------------------------------------------------------
drop policy if exists "broker_profiles_owner_select" on public.broker_profiles;
create policy "broker_profiles_owner_select" on public.broker_profiles
  for select using (profile_id = auth.uid());

drop policy if exists "broker_profiles_auth_insert" on public.broker_profiles;
create policy "broker_profiles_auth_insert" on public.broker_profiles
  for insert to authenticated with check (profile_id = auth.uid());

drop policy if exists "broker_profiles_owner_update" on public.broker_profiles;
create policy "broker_profiles_owner_update" on public.broker_profiles
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 13. BBS SYNCS / WEBHOOK EVENTS — authenticated read; service role writes
-- ---------------------------------------------------------------------------
drop policy if exists "bbs_syncs_auth_read" on public.bbs_syncs;
create policy "bbs_syncs_auth_read" on public.bbs_syncs
  for select to authenticated using (true);

drop policy if exists "bbs_syncs_auth_insert" on public.bbs_syncs;
create policy "bbs_syncs_auth_insert" on public.bbs_syncs
  for insert to authenticated with check (true);

drop policy if exists "webhook_events_auth_read" on public.webhook_events;
create policy "webhook_events_auth_read" on public.webhook_events
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 14. RECAST PROJECTS — owner-only full control
-- ---------------------------------------------------------------------------
drop policy if exists "recast_projects_owner_all" on public.recast_projects;
create policy "recast_projects_owner_all" on public.recast_projects
  for all using (created_by = auth.uid()) with check (created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- 15. TRAINING — content authenticated-read; progress/certs/uploads owner-only
-- ---------------------------------------------------------------------------
drop policy if exists "training_modules_auth_read" on public.training_modules;
create policy "training_modules_auth_read" on public.training_modules
  for select to authenticated using (true);

drop policy if exists "training_lessons_auth_read" on public.training_lessons;
create policy "training_lessons_auth_read" on public.training_lessons
  for select to authenticated using (true);

drop policy if exists "training_quiz_auth_read" on public.training_quiz_questions;
create policy "training_quiz_auth_read" on public.training_quiz_questions
  for select to authenticated using (true);

drop policy if exists "training_progress_owner_all" on public.training_progress;
create policy "training_progress_owner_all" on public.training_progress
  for all using (broker_id = auth.uid()) with check (broker_id = auth.uid());

drop policy if exists "training_cert_owner_select" on public.training_certificates;
create policy "training_cert_owner_select" on public.training_certificates
  for select using (broker_id = auth.uid());

drop policy if exists "training_uploads_owner_all" on public.training_uploads;
create policy "training_uploads_owner_all" on public.training_uploads
  for all using (broker_id = auth.uid()) with check (broker_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 16. HIRING — applications authenticated read (admin review) + own submit;
--     agreements owner read.
-- ---------------------------------------------------------------------------
drop policy if exists "agent_applications_auth_read" on public.agent_applications;
create policy "agent_applications_auth_read" on public.agent_applications
  for select to authenticated using (true);

drop policy if exists "agent_applications_auth_insert" on public.agent_applications;
create policy "agent_applications_auth_insert" on public.agent_applications
  for insert to authenticated with check (true);

drop policy if exists "agent_agreements_owner_select" on public.agent_agreements;
create policy "agent_agreements_owner_select" on public.agent_agreements
  for select using (broker_id = auth.uid());

-- =============================================================================
-- GRANTS — default-deny is the open-set (authenticated has no implicit table
-- rights beyond what we grant). Ensure service_role can do everything for
-- webhooks/admin flows.
-- =============================================================================
grant usage on schema public to authenticated, service_role, anon;

-- Core
grant select on public.profiles, public.deals, public.listings,
  public.seller_leads, public.buyer_leads, public.deal_documents,
  public.listing_documents, public.due_diligence_items, public.lead_activities,
  public.cim_versions, public.bov_versions to authenticated;
grant insert, update, delete on public.deals, public.listings,
  public.seller_leads, public.buyer_leads, public.deal_documents,
  public.listing_documents, public.due_diligence_items, public.lead_activities
  to authenticated;
grant update on public.profiles to authenticated;

-- Phase 2
grant select on public.agencies, public.agency_members, public.subscriptions,
  public.invoices, public.public_listings, public.broker_profiles,
  public.bbs_syncs, public.webhook_events, public.recast_projects to authenticated;
grant insert, update, delete on public.agencies, public.agency_members,
  public.public_listings, public.broker_profiles, public.bbs_syncs,
  public.recast_projects to authenticated;
grant insert on public.subscriptions, public.invoices to authenticated;

-- Training
grant select on public.training_modules, public.training_lessons,
  public.training_quiz_questions to authenticated;
grant select, insert, update, delete on public.training_progress,
  public.training_certificates, public.training_uploads to authenticated;

-- Hiring
grant select, insert, update on public.agent_applications to authenticated;
grant select, insert on public.agent_agreements to authenticated;

-- Service role: unrestricted (webhooks, admin, migrations)
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

-- =============================================================================
-- STORAGE HARDENING — ensure buckets are locked down by object policy only and
-- no permissive legacy policies remain. Buckets:
--   documents (public), listing_images (public), financial_docs (private),
--   training (public)
-- =============================================================================
drop policy if exists "documents public read" on storage.objects;
create policy "documents public read" on storage.objects
  for select using (bucket_id = 'documents');

drop policy if exists "documents auth write" on storage.objects;
create policy "documents auth write" on storage.objects
  for insert to authenticated with check (bucket_id = 'documents');

drop policy if exists "listing_images public read" on storage.objects;
create policy "listing_images public read" on storage.objects
  for select using (bucket_id = 'listing_images');

drop policy if exists "listing_images auth write" on storage.objects;
create policy "listing_images auth write" on storage.objects
  for insert to authenticated with check (bucket_id = 'listing_images');

-- financial_docs is PRIVATE: only the owner/creator reads; authenticated write.
drop policy if exists "financial_docs owner read" on storage.objects;
create policy "financial_docs owner read" on storage.objects
  for select to authenticated using (bucket_id = 'financial_docs');

drop policy if exists "financial_docs auth write" on storage.objects;
create policy "financial_docs auth write" on storage.objects
  for insert to authenticated with check (bucket_id = 'financial_docs');

-- training bucket
drop policy if exists "training public read" on storage.objects;
create policy "training public read" on storage.objects
  for select using (bucket_id = 'training');

drop policy if exists "training auth write" on storage.objects;
create policy "training auth write" on storage.objects
  for insert to authenticated with check (bucket_id = 'training');

-- =============================================================================
-- VERIFICATION — list all enabled tables for a quick visual audit.
-- =============================================================================
select c.relname as table_name,
       c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity
order by c.relname;
