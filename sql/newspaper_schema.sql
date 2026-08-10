-- =============================================================================
-- Concord Deal Platform — Weekly Newspaper System schema
-- Run this in the Supabase SQL Editor (idempotent).
--
-- The weekly newspaper is a curated digest of platform activity (new listings,
-- deals closed, new leads, social highlights) delivered to subscribers each
-- week. Editors can auto-generate then hand-edit before publishing.
--
-- Tables:
--   newspaper_editions     — one row per weekly issue (status: draft|published)
--   newspaper_articles     — content sections within an edition
--   newspaper_subscriptions— recipients + status
--   newspaper_delivery_log — per-issue delivery tracking
-- =============================================================================

create table if not exists public.newspaper_editions (
  id             uuid primary key default gen_random_uuid(),
  title          text not null default 'Concord Weekly',
  issue_label    text,                       -- e.g. "Week of Aug 3, 2026"
  edition_date   date default current_date,
  status         text not null default 'draft' check (status in ('draft','published')),
  published_at   timestamptz,
  summary        text,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists newspaper_editions_status_idx on public.newspaper_editions (status);
create index if not exists newspaper_editions_date_idx   on public.newspaper_editions (edition_date);

create table if not exists public.newspaper_articles (
  id           uuid primary key default gen_random_uuid(),
  edition_id   uuid references public.newspaper_editions(id) on delete cascade,
  section      text not null default 'Market News',   -- Market News | Featured Listings | Deals Closed | New Leads | Team Updates
  headline     text,
  body         text,
  image_url    text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists newspaper_articles_edition_idx on public.newspaper_articles (edition_id);

create table if not exists public.newspaper_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  name          text,
  status        text not null default 'active' check (status in ('active','unsubscribed','bounced')),
  token         text,                       -- unsubscribe token
  created_at    timestamptz not null default now()
);
create index if not exists newspaper_subs_email_idx on public.newspaper_subscriptions (email);
create index if not exists newspaper_subs_status_idx on public.newspaper_subscriptions (status);

create table if not exists public.newspaper_delivery_log (
  id            uuid primary key default gen_random_uuid(),
  edition_id    uuid references public.newspaper_editions(id) on delete cascade,
  email         text,
  status        text default 'sent' check (status in ('sent','failed','bounced','opened')),
  opened_at     timestamptz,
  error         text,
  created_at    timestamptz not null default now()
);
create index if not exists newspaper_delivery_edition_idx on public.newspaper_delivery_log (edition_id);

-- RLS: authenticated team reads/writes publications + subscriptions.
alter table public.newspaper_editions enable row level security;
alter table public.newspaper_articles enable row level security;
alter table public.newspaper_subscriptions enable row level security;
alter table public.newspaper_delivery_log enable row level security;

drop policy if exists "newspaper_editions_select" on public.newspaper_editions;
create policy "newspaper_editions_select" on public.newspaper_editions for select to authenticated using (true);
drop policy if exists "newspaper_editions_insert" on public.newspaper_editions;
create policy "newspaper_editions_insert" on public.newspaper_editions for insert to authenticated with check (true);
drop policy if exists "newspaper_editions_update" on public.newspaper_editions;
create policy "newspaper_editions_update" on public.newspaper_editions for update to authenticated using (true);
drop policy if exists "newspaper_editions_delete" on public.newspaper_editions;
create policy "newspaper_editions_delete" on public.newspaper_editions for delete to authenticated using (true);

drop policy if exists "newspaper_articles_select" on public.newspaper_articles;
create policy "newspaper_articles_select" on public.newspaper_articles for select to authenticated using (true);
drop policy if exists "newspaper_articles_insert" on public.newspaper_articles;
create policy "newspaper_articles_insert" on public.newspaper_articles for insert to authenticated with check (true);
drop policy if exists "newspaper_articles_update" on public.newspaper_articles;
create policy "newspaper_articles_update" on public.newspaper_articles for update to authenticated using (true);
drop policy if exists "newspaper_articles_delete" on public.newspaper_articles;
create policy "newspaper_articles_delete" on public.newspaper_articles for delete to authenticated using (true);

drop policy if exists "newspaper_subs_select" on public.newspaper_subscriptions;
create policy "newspaper_subs_select" on public.newspaper_subscriptions for select to authenticated using (true);
drop policy if exists "newspaper_subs_insert" on public.newspaper_subscriptions;
create policy "newspaper_subs_insert" on public.newspaper_subscriptions for insert to authenticated with check (true);
drop policy if exists "newspaper_subs_update" on public.newspaper_subscriptions;
create policy "newspaper_subs_update" on public.newspaper_subscriptions for update to authenticated using (true);
drop policy if exists "newspaper_subs_delete" on public.newspaper_subscriptions;
create policy "newspaper_subs_delete" on public.newspaper_subscriptions for delete to authenticated using (true);

drop policy if exists "newspaper_delivery_select" on public.newspaper_delivery_log;
create policy "newspaper_delivery_select" on public.newspaper_delivery_log for select to authenticated using (true);
drop policy if exists "newspaper_delivery_insert" on public.newspaper_delivery_log;
create policy "newspaper_delivery_insert" on public.newspaper_delivery_log for insert to authenticated with check (true);
