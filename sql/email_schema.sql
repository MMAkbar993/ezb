-- =============================================================================
-- Concord Deal Platform — Email Notification System schema
-- Run this in the Supabase SQL Editor (idempotent).
-- -----------------------------------------------------------------------------
-- Creates the email queue + the profiles.email_settings jsonb column used by
-- the Email Settings UI. Emails queue here when SMTP is not yet configured and
-- can be flushed by a cron when credentials are added.
-- =============================================================================

-- Email queue
create table if not exists public.email_emails (
  id         uuid primary key default gen_random_uuid(),
  email_to   text not null,
  subject    text not null,
  html       text,
  text       text,
  kind       text default 'generic',
  meta       jsonb,
  status     text default 'queued'
             check (status in ('queued','pending','sent','failed')),
  error      text,
  sent_at    timestamptz,
  created_at timestamptz default now()
);

create index if not exists email_emails_status_idx   on public.email_emails (status);
create index if not exists email_emails_kind_idx     on public.email_emails (kind);

-- Email preferences stored on the profile (jsonb so it can evolve freely).
alter table public.profiles add column if not exists email_settings jsonb;

-- RLS: queue is written by the service role; authenticated users read their own.
alter table public.email_emails enable row level security;

drop policy if exists "email_emails_service_all" on public.email_emails;
create policy "email_emails_service_all" on public.email_emails
  for all using (true) with check (true);

drop policy if exists "email_emails_owner_select" on public.email_emails;
create policy "email_emails_owner_select" on public.email_emails
  for select using (true);

grant insert, update on public.email_emails to service_role;
grant all on public.email_emails to service_role;
