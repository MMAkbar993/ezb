-- =============================================================================
-- CONCORD DEAL PLATFORM — Admin-issued team invites (2026-08-14)
-- =============================================================================
-- Lets an admin invite a new team member with their role already decided
-- (Agent / Broker / Admin) — the person accepting the invite never sees a
-- role picker, closing the privilege-escalation risk an open self-signup
-- page would have. Follows the same accountless/token-gated pattern already
-- used by listing_nda_signatures and seller_forms: crypto-random token, RLS
-- enabled with ZERO policies (no direct client access at all, in either
-- direction), every read/write goes through a service-role API route that
-- re-validates the token itself:
--   app/api/team/invite/route.ts          (admin: create + list)
--   app/api/team/invite/[token]/route.ts  (public lookup, admin revoke)
--   app/api/team/invite/accept/route.ts   (public: create account from invite)
--
-- Run this ONCE in the Supabase SQL Editor. Idempotent.
-- =============================================================================

create table if not exists public.team_invites (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  role          text not null check (role in ('agent', 'broker', 'admin')),
  token         text not null unique,
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by    uuid references public.profiles(id) on delete set null,
  accepted_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  expires_at    timestamptz not null default (now() + interval '14 days')
);

create index if not exists team_invites_token_idx on public.team_invites (token);
create index if not exists team_invites_email_idx on public.team_invites (email);

alter table public.team_invites enable row level security;
-- Intentionally no policies — every access path is a service-role route.

-- =============================================================================
-- DONE.
-- =============================================================================
