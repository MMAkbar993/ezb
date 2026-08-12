-- =============================================================================
-- CONCORD DEAL PLATFORM — Buyer NDA (accountless, per-listing) (2026-08-12)
-- =============================================================================
-- Implements "NDA & Security" from the brief: a buyer signs an NDA for ONE
-- specific listing (no account required — name + email only) and gets a
-- token that unlocks that listing's full financials (revenue/SDE/EBITDA).
-- Nothing else is gated. The public listing feed (public_listing_feed) is
-- untouched and continues to never expose financials by default — the
-- unlock happens through a separate, dedicated, server-validated endpoint
-- (app/api/public/nda/*), never by loosening the safe view itself.
--
-- RLS: intentionally has NO anon/authenticated policies at all — every read
-- and write goes through the service-role API routes, which validate the
-- token server-side before ever returning a financial figure. This is the
-- strictest possible posture for a table that gates confidential financial
-- data.
--
-- Run this ONCE in the Supabase SQL Editor. Idempotent.
-- =============================================================================

create table if not exists public.listing_nda_signatures (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references public.listings(id) on delete cascade,
  buyer_name    text not null,
  buyer_email   text not null,
  unlock_token  text not null unique,
  ip_address    text,
  user_agent    text,
  signed_at     timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists listing_nda_signatures_listing_idx on public.listing_nda_signatures (listing_id);
create index if not exists listing_nda_signatures_token_idx on public.listing_nda_signatures (unlock_token);
create index if not exists listing_nda_signatures_email_idx on public.listing_nda_signatures (buyer_email);

alter table public.listing_nda_signatures enable row level security;
-- No policies created — service-role only. This is deliberate.

-- =============================================================================
-- DONE.
-- =============================================================================
