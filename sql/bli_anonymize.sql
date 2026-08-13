-- =============================================================================
-- CONCORD DEAL PLATFORM — BLI name anonymization (2026-08-12)
-- =============================================================================
-- The Business Listing Information (BLI) document is often shared more
-- broadly than the CIM (which only goes to NDA'd buyers) — brokers need the
-- option to keep the real business name out of it and show the confidential
-- headline/description instead (e.g. "Non-skilled home care for sale"
-- rather than the real trade name).
--
-- Run this ONCE in the Supabase SQL Editor. Idempotent.
-- =============================================================================

alter table public.listings
  add column if not exists bli_anonymize boolean not null default false;

comment on column public.listings.bli_anonymize is 'When true, generateBliContent() (lib/bli.ts) shows the confidential headline instead of the real business name. Does not affect CIM/BOV, which are only released to NDA''d buyers.';

-- =============================================================================
-- DONE.
-- =============================================================================
