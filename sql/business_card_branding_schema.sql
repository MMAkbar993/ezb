-- =============================================================================
-- Per-Broker Business Card Branding
-- -----------------------------------------------------------------------------
-- Extends the existing white-label branding model with full business-card
-- theming. Agencies already carry brand_color / accent_color / logo_url; we add
-- the richer font + secondary/accent palette. Brokers get override fields on
-- broker_profiles so they can inherit the agency default or opt out with their
-- own colors, font, and logo.
--
-- Safe to run multiple times (idempotent ADD COLUMN IF NOT EXISTS).
-- =============================================================================

-- ---- agencies: agency-wide default business-card brand ----------------------
alter table public.agencies
  add column if not exists brand_primary_color   text default '#1a1a2e',
  add column if not exists brand_secondary_color text default '#16213e',
  add column if not exists brand_accent_color    text default '#c9a84c',
  add column if not exists brand_font            text default 'Georgia, serif',
  add column if not exists brand_logo_url        text;

-- ---- broker_profiles: per-broker overrides -----------------------------------
-- NULL values mean "inherit the agency default". Layout is a front-facing
-- preset key: 'classic' | 'minimal' | 'modern' | 'split'.
alter table public.broker_profiles
  add column if not exists card_primary_color   text,
  add column if not exists card_secondary_color text,
  add column if not exists card_accent_color    text,
  add column if not exists card_font            text,
  add column if not exists card_logo_url        text,
  add column if not exists card_layout          text;

-- ---------------------------------------------------------------------------
-- Complete Business Card System — photos, custom back text, QR contact saving.
-- Extends business_card_branding_schema.sql (v1).
-- Safe to run multiple times (idempotent ADD COLUMN IF NOT EXISTS).
-- ---------------------------------------------------------------------------

-- broker_profiles: content fields for the card itself.
alter table public.broker_profiles
  add column if not exists photo_url  text,          -- broker headshot
  add column if not exists back_text  text,          -- custom text printed on the back
  add column if not exists qr_code_url text,         -- stable URL the QR encodes (e.g. /qr/<id>)
  add column if not exists vcard_data jsonb;         -- generated vCard 3.0/4.0 payload (FN,TEL,EMAIL,ORG,PHOTO...)

-- ---- business_card_templates: saved card templates ---------------------------
create table if not exists public.business_card_templates (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references public.profiles(id) on delete cascade,
  name           text not null default 'Untitled card',
  qr_style       text not null default 'classic',   -- classic | rounded | modern
  photo_position text not null default 'top',       -- top | center | bottom
  brand          jsonb not null default '{}'::jsonb,
  owner          jsonb not null default '{}'::jsonb,
  back_text      text,
  photo_url      text,
  vcard_data     jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_business_card_templates_user on public.business_card_templates (user_id);

alter table public.business_card_templates enable row level security;

drop policy if exists business_card_templates_owner on public.business_card_templates;
create policy business_card_templates_owner on public.business_card_templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---- storage bucket: broker_photos (public) ------------------------------------
-- Created via the Supabase dashboard or this SQL (requires the storage schema).
insert into storage.buckets (id, name, public)
values ('broker_photos', 'broker_photos', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload into broker_photos.
drop policy if exists broker_photos_upload on storage.objects;
create policy broker_photos_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'broker_photos');

-- Public read for anyone (enables the public card + QR pages).
drop policy if exists broker_photos_read on storage.objects;
create policy broker_photos_read on storage.objects
  for select using (bucket_id = 'broker_photos');

-- Owner may delete/update their own uploads.
drop policy if exists broker_photos_owner on storage.objects;
create policy broker_photos_owner on storage.objects
  for update to authenticated using (bucket_id = 'broker_photos' and auth.uid() = owner)
  with check (bucket_id = 'broker_photos' and auth.uid() = owner);
create policy broker_photos_owner_delete on storage.objects
  for delete to authenticated using (bucket_id = 'broker_photos' and auth.uid() = owner);

-- ---- indexes (cheap, idempotent) ---------------------------------------------
create index if not exists idx_broker_profiles_agency on public.broker_profiles (agency_id);
