-- =============================================================================
-- CONCORD DEAL PLATFORM — Buyer NDA + Buyer Profile Form fields (2026-08-12)
-- =============================================================================
-- Extends listing_nda_signatures (built + verified end-to-end earlier this
-- session) in place, rather than replacing it, so the already-working
-- sign -> token -> unlock-financials flow keeps working unchanged.
--
-- Adds the remaining Confidentiality/NDA fields (address, phone, EIN/DL —
-- everything in the source form except Business Listing ID No. and Business
-- Category, which are pre-filled from the listing itself, never buyer-
-- entered) and the full Buyer Profile Form, as jsonb payloads (matching the
-- recast_projects convention already used elsewhere in this schema).
--
-- Run this ONCE in the Supabase SQL Editor. Idempotent.
-- =============================================================================

alter table public.listing_nda_signatures
  add column if not exists nda_form_data jsonb not null default '{}'::jsonb,
  add column if not exists buyer_profile jsonb not null default '{}'::jsonb,
  add column if not exists guide_acknowledged boolean not null default false,
  add column if not exists pdf_url text;

comment on column public.listing_nda_signatures.nda_form_data is 'Remaining Confidentiality & Registration Agreement fields (address, phone, EIN/DL, etc). Business Listing ID and Business Category are derived from listings at render/PDF time, never stored here.';
comment on column public.listing_nda_signatures.buyer_profile is 'Full Buyer Profile Form answers (personal info, preferences, background, financials, assets/liabilities).';
comment on column public.listing_nda_signatures.guide_acknowledged is 'Buyer confirmed they read the Buyer Forms Overview & Confidentiality Guide before signing.';

-- =============================================================================
-- DONE.
-- =============================================================================
