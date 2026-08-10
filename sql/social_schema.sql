-- =============================================================================
-- Concord Deal Platform — Social Media Integration Schema
-- Run this in the Supabase SQL Editor.
--   Tables: social_connections, social_settings, social_posts, social_analytics
-- Includes RLS for all four (idempotent, safe to re-run).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. social_connections — one row per platform connection per agent
-- ---------------------------------------------------------------------------
create table if not exists public.social_connections (
  id               uuid primary key default gen_random_uuid(),
  agent_id         uuid references public.profiles(id) on delete cascade not null,
  platform         text not null check (platform in ('instagram','facebook','tiktok','x')),
  access_token     text,
  refresh_token    text,
  platform_user_id text,
  platform_username text,
  platform_name    text,
  expires_at       timestamptz,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (agent_id, platform)
);

-- ---------------------------------------------------------------------------
-- 2. social_settings — per-agent per-platform posting preferences
-- ---------------------------------------------------------------------------
create table if not exists public.social_settings (
  id                uuid primary key default gen_random_uuid(),
  agent_id          uuid references public.profiles(id) on delete cascade not null,
  platform          text not null check (platform in ('instagram','facebook','tiktok','x')),
  auto_post_enabled boolean not null default true,
  post_template     text,
  include_images    boolean not null default true,
  include_link      boolean not null default true,
  hashtags          text,
  custom_message    text,
  schedule_time     time,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (agent_id, platform)
);

-- ---------------------------------------------------------------------------
-- 3. social_posts — queued / posted / failed posts
-- ---------------------------------------------------------------------------
create table if not exists public.social_posts (
  id               uuid primary key default gen_random_uuid(),
  listing_id       uuid references public.listings(id) on delete cascade,
  agent_id         uuid references public.profiles(id) on delete cascade not null,
  platform         text not null check (platform in ('instagram','facebook','tiktok','x')),
  post_id          text,
  post_url         text,
  content          text,
  image_urls       text[] default '{}',
  scheduled_for    timestamptz,
  posted_at        timestamptz,
  status           text not null default 'pending'
                   check (status in ('pending','posted','failed','scheduled')),
  error            text,
  engagement_likes    integer not null default 0,
  engagement_comments integer not null default 0,
  engagement_shares   integer not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists social_posts_agent_idx     on public.social_posts (agent_id);
create index if not exists social_posts_listing_idx   on public.social_posts (listing_id);
create index if not exists social_posts_status_idx    on public.social_posts (status);
create index if not exists social_posts_platform_idx  on public.social_posts (platform);

-- ---------------------------------------------------------------------------
-- 4. social_analytics — engagement snapshots per post
-- ---------------------------------------------------------------------------
create table if not exists public.social_analytics (
  id              uuid primary key default gen_random_uuid(),
  post_id         uuid references public.social_posts(id) on delete cascade not null,
  platform        text not null,
  impressions     integer not null default 0,
  reach           integer not null default 0,
  clicks          integer not null default 0,
  engagement_rate numeric not null default 0,
  collected_at    timestamptz not null default now()
);
create index if not exists social_analytics_post_idx on public.social_analytics (post_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.social_connections enable row level security;
alter table public.social_settings    enable row level security;
alter table public.social_posts       enable row level security;
alter table public.social_analytics   enable row level security;

-- social_connections: owner-only (tokens are sensitive)
drop policy if exists "social_connections_owner_all" on public.social_connections;
create policy "social_connections_owner_all" on public.social_connections
  for all using (auth.uid() = agent_id) with check (auth.uid() = agent_id);

-- social_settings: owner-only
drop policy if exists "social_settings_owner_all" on public.social_settings;
create policy "social_settings_owner_all" on public.social_settings
  for all using (auth.uid() = agent_id) with check (auth.uid() = agent_id);

-- social_posts: owner-only
drop policy if exists "social_posts_owner_all" on public.social_posts;
create policy "social_posts_owner_all" on public.social_posts
  for all using (auth.uid() = agent_id) with check (auth.uid() = agent_id);

-- social_analytics: owner can read via their post; service role writes
drop policy if exists "social_analytics_owner_select" on public.social_analytics;
create policy "social_analytics_owner_select" on public.social_analytics
  for select using (
    exists (
      select 1 from public.social_posts p
      where p.id = social_analytics.post_id and p.agent_id = auth.uid()
    )
  );
