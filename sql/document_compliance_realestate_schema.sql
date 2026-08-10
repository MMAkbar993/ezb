-- =============================================================================
-- Concord Deal Platform — Document, Compliance & Real Estate System
-- Run in the Supabase SQL Editor. Idempotent (safe to re-run).
--
-- Adds:
--   1. Document builder: document_templates (fillable JSONB fields),
--      documents (filled_data + parties), document_signatures,
--      document_audit_logs.
--   2. State compliance + licensing: profile license columns,
--      license_verification_logs.
--   3. Real estate option: property detail columns on listings +
--      auto-calculated total value.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. DOCUMENT SYSTEM
-- ---------------------------------------------------------------------------

-- Fillable document templates. `fields` is an ordered JSONB array of field
-- definitions: [{ key, label, type: 'text|number|date|select|textarea|signature',
--    required, options?, placeholder? }]. `parties` describes the signatories:
-- [{ key, label, role: 'agent|seller|buyer|custom' }].
create table if not exists public.document_templates (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  category      text not null default 'other',
  fields        jsonb not null default '[]',
  parties       jsonb not null default '[]',
  body_template text,                        -- optional markdown/HTML skeleton with {{field.key}} placeholders
  is_active     boolean not null default true,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists document_templates_active_idx on public.document_templates (is_active);

-- A filled document instance created from a template, bound to a listing/deal.
-- `parties` stores the resolved parties at fill time (agent/seller/buyer with
-- names + emails). `filled_data` mirrors the template field keys → values.
create table if not exists public.documents (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid references public.document_templates(id) on delete set null,
  listing_id    uuid references public.listings(id) on delete cascade,
  deal_id       uuid references public.deals(id) on delete set null,
  title         text not null,
  status        text not null default 'draft'
                check (status in ('draft','pending_signature','signed','rejected','archived')),
  filled_data   jsonb not null default '{}',
  parties       jsonb not null default '[]',
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists documents_listing_idx on public.documents (listing_id);
create index if not exists documents_deal_idx on public.documents (deal_id);

-- Signatures attached to a document, one row per signer.
create table if not exists public.document_signatures (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid references public.documents(id) on delete cascade,
  party_key     text not null,               -- matches parties[].key
  party_name    text,
  party_email   text,
  role          text,                        -- agent | seller | buyer | custom
  status        text not null default 'unsigned'
                check (status in ('unsigned','signed','declined','expired')),
  signature_data jsonb,                      -- SVG data URL or {name, ip, ts}
  signed_at     timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists document_signatures_doc_idx on public.document_signatures (document_id);

-- Immutable audit trail of document lifecycle events.
create table if not exists public.document_audit_logs (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid references public.documents(id) on delete cascade,
  actor_id      uuid references public.profiles(id) on delete set null,
  action        text not null,               -- created | filled | sent | signed | declined | status_changed | archived
  detail        jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists document_audit_logs_doc_idx on public.document_audit_logs (document_id);

-- ---------------------------------------------------------------------------
-- 2. STATE COMPLIANCE & LICENSING
-- ---------------------------------------------------------------------------

-- Profile license columns: real-estate license + verification status.
alter table public.profiles
  add column if not exists real_estate_license_number text,
  add column if not exists real_estate_license_state text,
  add column if not exists license_status text not null default 'unverified'
              check (license_status in ('unverified','pending','verified','not_required','expired')),
  add column if not exists is_license_verified boolean not null default false;

-- License verification event log (who verified, when, evidence).
create table if not exists public.license_verification_logs (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid references public.profiles(id) on delete cascade,
  state_code    text,                        -- 2-letter US state
  license_number text,
  status        text not null default 'pending'
                check (status in ('pending','verified','rejected','expired')),
  verified_by   uuid references public.profiles(id) on delete set null,
  notes         text,
  evidence_url  text,
  verified_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists license_verification_logs_profile_idx on public.license_verification_logs (profile_id);

-- ---------------------------------------------------------------------------
-- 3. REAL ESTATE OPTION
-- ---------------------------------------------------------------------------

-- Property detail columns on listings. `real_estate_included` already exists.
alter table public.listings
  add column if not exists property_value numeric,
  add column if not exists property_description text,
  add column if not exists square_footage numeric,
  add column if not exists land_acres numeric,
  add column if not exists year_built int,
  add column if not exists property_address text,
  add column if not exists property_city text,
  add column if not exists property_state text,
  add column if not exists property_zip text;

-- Total value = asking_price + property_value (computed column keeps it always
-- in sync; nulls are treated as 0).
alter table public.listings
  add column if not exists total_value numeric
    generated always as (coalesce(asking_price, 0) + coalesce(property_value, 0)) stored;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

-- Documents: authenticated (broker) read; owner write; anyone can insert their own.
alter table public.document_templates    enable row level security;
alter table public.documents             enable row level security;
alter table public.document_signatures   enable row level security;
alter table public.document_audit_logs   enable row level security;
alter table public.license_verification_logs enable row level security;

drop policy if exists "document_templates_read" on public.document_templates;
create policy "document_templates_read" on public.document_templates
  for select using (true);

drop policy if exists "document_templates_admin_write" on public.document_templates;
create policy "document_templates_admin_write" on public.document_templates
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  ) with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "documents_auth_read" on public.documents;
create policy "documents_auth_read" on public.documents
  for select using (true);

drop policy if exists "documents_auth_insert" on public.documents;
create policy "documents_auth_insert" on public.documents
  for insert with check (auth.uid() = created_by);

drop policy if exists "documents_owner_update" on public.documents;
create policy "documents_owner_update" on public.documents
  for update using (auth.uid() = created_by) with check (auth.uid() = created_by);

drop policy if exists "signatures_read" on public.document_signatures;
create policy "signatures_read" on public.document_signatures
  for select using (true);

drop policy if exists "signatures_insert" on public.document_signatures;
create policy "signatures_insert" on public.document_signatures
  for insert with check (true);

drop policy if exists "signatures_update" on public.document_signatures;
create policy "signatures_update" on public.document_signatures
  for update using (true) with check (true);

drop policy if exists "audit_logs_read" on public.document_audit_logs;
create policy "audit_logs_read" on public.document_audit_logs
  for select using (true);

drop policy if exists "audit_logs_insert" on public.document_audit_logs;
create policy "audit_logs_insert" on public.document_audit_logs
  for insert with check (true);

drop policy if exists "license_logs_owner_read" on public.license_verification_logs;
create policy "license_logs_owner_read" on public.license_verification_logs
  for select using (auth.uid() = profile_id or auth.uid() = verified_by);

drop policy if exists "license_logs_admin_manage" on public.license_verification_logs;
create policy "license_logs_admin_manage" on public.license_verification_logs
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  ) with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- Seed: starter document templates
-- ---------------------------------------------------------------------------
insert into public.document_templates (name, description, category, fields, parties, body_template)
select * from (values
  (
    'Standard NDA',
    'Confidentiality agreement for sharing deal information with a prospective buyer.',
    'NDA',
    '[{"key":"disclosing_party","label":"Disclosing Party","type":"text","required":true,"placeholder":"e.g. ABC Holdings, LLC"},{"key":"receiving_party","label":"Receiving Party","type":"text","required":true,"placeholder":"e.g. Buyer Name"},{"key":"effective_date","label":"Effective Date","type":"date","required":true}]'::jsonb,
    '[{"key":"seller","label":"Seller","role":"seller"},{"key":"buyer","label":"Buyer","role":"buyer"}]'::jsonb,
    '{{title}}\n\nEffective Date: {{effective_date}}\n\nDISCLOSING PARTY: {{disclosing_party}}\nRECEIVING PARTY: {{receiving_party}}\n\nThis Non-Disclosure Agreement...'
  ),
  (
    'Listing Agreement',
    'Seller engagement agreement for marketing and selling the business.',
    'Marketing Agreement',
    '[{"key":"seller_name","label":"Seller Name","type":"text","required":true},{"key":"listing_price","label":"Listing Price","type":"number","required":true},{"key":"commission_rate","label":"Commission Rate %","type":"number","required":true},{"key":"effective_date","label":"Effective Date","type":"date","required":true}]'::jsonb,
    '[{"key":"agent","label":"Agent","role":"agent"},{"key":"seller","label":"Seller","role":"seller"}]'::jsonb,
    '{{title}}\n\nEffective Date: {{effective_date}}\n\nSeller: {{seller_name}}\nListing Price: {{listing_price}}\nCommission: {{commission_rate}}%'
  ),
  (
    'Purchase Agreement',
    'Sale and purchase agreement between buyer and seller.',
    'Purchase Agreement',
    '[{"key":"buyer_name","label":"Buyer Name","type":"text","required":true},{"key":"seller_name","label":"Seller Name","type":"text","required":true},{"key":"purchase_price","label":"Purchase Price","type":"number","required":true},{"key":"closing_date","label":"Target Closing Date","type":"date","required":true}]'::jsonb,
    '[{"key":"seller","label":"Seller","role":"seller"},{"key":"buyer","label":"Buyer","role":"buyer"}]'::jsonb,
    '{{title}}\n\nPurchase Price: {{purchase_price}}\nTarget Closing: {{closing_date}}'
  )
) as v(name, description, category, fields, parties, body_template)
on conflict do nothing;

-- Sanity check: report if core tables are missing.
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='document_templates') then
    raise notice 'document_templates missing — re-run this migration after creating foundation tables.';
  end if;
end $$;
