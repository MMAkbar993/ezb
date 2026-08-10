-- =============================================================================
-- Concord Deal Platform — Search & Filter System schema
-- Run this in the Supabase SQL Editor (idempotent).
-- -----------------------------------------------------------------------------
-- Adds: saved_search_filters (per-user saved searches), Postgres full-text
-- search indexes on the main searchable tables, and a search log.
-- =============================================================================

-- Saved searches (per user, shown in the search dropdown).
create table if not exists public.saved_searches (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles(id) on delete cascade,
  name          text not null,
  scope         text not null default 'all',        -- all | listings | deals | leads | documents
  query         text,
  filters       jsonb default '{}',
  created_at    timestamptz not null default now()
);

create index if not exists saved_searches_user_idx on public.saved_searches (user_id);

-- Search usage log (optional, for "recent searches").
create table if not exists search_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles(id) on delete cascade,
  query      text,
  scope      text,
  created_at timestamptz not null default now()
);

create index if not exists search_log_user_idx on public.search_log (user_id);

-- --- Full-text search support ----------------------------------------------
-- If a column is missing, these fail — wrap defensively. The app also does a
-- client-side fallback (ilike over key columns) so search works even without
-- running this file, just slower. Re-run after ensuring columns exist.
-- Listings
alter table public.listings add column if not exists fts_document tsvector;
update public.listings set fts_document =
  to_tsvector('english',
    coalesce(business_name,'') || ' ' ||
    coalesce(headline,'') || ' ' ||
    coalesce(industry,'') || ' ' ||
    coalesce(location_general,'') || ' ' ||
    coalesce(description,'') || ' ' ||
    coalesce(reason_for_sale,'')
  ) where fts_document is null;
create index if not exists listings_fts_idx on public.listings using gin (fts_document);

-- Deals (search over title + status; deals reference listings for names)
alter table public.deals add column if not exists fts_document tsvector;
update public.deals set fts_document =
  to_tsvector('english',
    coalesce(nullif(title,''), '') || ' ' ||
    coalesce(status,'') || ' ' ||
    coalesce(cast(purchase_price as text),'')
  ) where fts_document is null;
create index if not exists deals_fts_idx on public.deals using gin (fts_document);

-- Seller leads
alter table public.seller_leads add column if not exists fts_document tsvector;
update public.seller_leads set fts_document =
  to_tsvector('english',
    coalesce(business_name,'') || ' ' ||
    coalesce(contact_name,'') || ' ' ||
    coalesce(location_general,'') || ' ' ||
    coalesce(industry,'') || ' ' ||
    coalesce(notes,'')
  ) where fts_document is null;
create index if not exists seller_leads_fts_idx on public.seller_leads using gin (fts_document);

-- Buyer leads
alter table public.buyer_leads add column if not exists fts_document tsvector;
update public.buyer_leads set fts_document =
  to_tsvector('english',
    coalesce(contact_name,'') || ' ' ||
    coalesce(company,'') || ' ' ||
    coalesce(email,'') || ' ' ||
    coalesce(industry_interest,'') || ' ' ||
    coalesce(notes,'')
  ) where fts_document is null;
create index if not exists buyer_leads_fts_idx on public.buyer_leads using gin (fts_document);

-- RLS for saved searches
alter table public.saved_searches enable row level security;
drop policy if exists "saved_searches_own" on public.saved_searches;
create policy "saved_searches_own" on public.saved_searches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
