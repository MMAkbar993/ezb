-- =============================================================================
-- Concord Deal Platform — Client Portal schema
-- Run this in the Supabase SQL Editor (idempotent).
-- -----------------------------------------------------------------------------
-- The client portal is token-gated (no broker-account login required for the
-- client). Each deal can have one or more authorized clients; they access a
-- private URL /portal/<dealId>/<token> to view deal progress, milestones,
-- documents, upload DD documents, and message the broker.
--
-- Tables:
--   client_portal_access — grants a client access to a deal (email + token)
--   portal_messages    — client <-> broker chat threads per deal
-- =============================================================================

create table if not exists public.client_portal_access (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid references public.deals(id) on delete cascade,
  client_name   text not null,
  client_email  text not null,
  token         text not null unique,
  status        text not null default 'active' check (status in ('active','revoked')),
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists client_portal_access_deal_idx  on public.client_portal_access (deal_id);
create index if not exists client_portal_access_token_idx on public.client_portal_access (token);

create table if not exists public.portal_messages (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid references public.deals(id) on delete cascade,
  author        text not null default 'client',   -- 'client' | 'broker'
  author_name   text,
  body          text not null,
  created_at    timestamptz not null default now()
);

create index if not exists portal_messages_deal_idx on public.portal_messages (deal_id);

-- --- RLS --------------------------------------------------------------------
-- Advisor team manages access + messages (authenticated). Clients authenticate
-- only via their secret token (validated server-side); the token itself is the
-- authorization, so we gate writes through the service role / a token-bearing
-- API route rather than Supabase auth RLS.
alter table public.client_portal_access enable row level security;
alter table public.portal_messages enable row level security;

drop policy if exists "client_portal_access_select" on public.client_portal_access;
create policy "client_portal_access_select" on public.client_portal_access for select to authenticated using (true);
drop policy if exists "client_portal_access_insert" on public.client_portal_access;
create policy "client_portal_access_insert" on public.client_portal_access for insert to authenticated with check (true);
drop policy if exists "client_portal_access_update" on public.client_portal_access;
create policy "client_portal_access_update" on public.client_portal_access for update to authenticated using (true);
drop policy if exists "client_portal_access_delete" on public.client_portal_access;
create policy "client_portal_access_delete" on public.client_portal_access for delete to authenticated using (true);

drop policy if exists "portal_messages_select" on public.portal_messages;
create policy "portal_messages_select" on public.portal_messages for select to authenticated using (true);
drop policy if exists "portal_messages_insert" on public.portal_messages;
create policy "portal_messages_insert" on public.portal_messages for insert to authenticated with check (true);

-- Token-authenticated client writes go through the service role client in the
-- portal API routes; those bypass RLS by design (token IS the auth).
