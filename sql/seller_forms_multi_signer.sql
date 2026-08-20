-- =============================================================================
-- CONCORD DEAL PLATFORM — Multiple co-seller signature slots (2026-08-19)
-- =============================================================================
-- A business can have more than one seller/owner (co-owned LLC, multiple
-- managing members, etc.) — previously seller_forms only ever captured one
-- signer_name/signer_title/signed_at. Adds a jsonb column for any co-sellers
-- beyond the primary signer, each as { name, title }.
--
-- Run this ONCE in the Supabase SQL Editor. Idempotent.
-- =============================================================================

alter table public.seller_forms
  add column if not exists additional_signers jsonb not null default '[]'::jsonb;

comment on column public.seller_forms.additional_signers is
  'Co-sellers beyond the primary signer_name/signer_title, e.g. [{"name":"Jane Doe","title":"Co-Owner"}]. The first fills the template''s second real signature block (Corp/LLC Resolution, Seller Interview) if it has one; the rest print on an appended Additional Signatures page.';

-- =============================================================================
-- DONE.
-- =============================================================================
