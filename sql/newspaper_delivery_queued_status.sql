-- =============================================================================
-- CONCORD DEAL PLATFORM — honest newspaper delivery status (2026-08-20)
-- =============================================================================
-- The "Email subscribers" button used to insert emails straight into
-- email_emails with status:'queued' and then unconditionally log
-- newspaper_delivery_log.status:'sent' — nothing ever actually attempted
-- delivery (no worker reads that queue), so every edition silently went
-- nowhere while the UI reported success. The publish route now calls the
-- real send path (lib/email.ts) and records what actually happened —
-- 'sent' only when SMTP genuinely delivered it, 'queued' when it's sitting
-- in email_emails waiting on SMTP configuration. Add 'queued' as an allowed
-- value for that honest status.
--
-- Run this ONCE in the Supabase SQL Editor. Idempotent.
-- =============================================================================

alter table public.newspaper_delivery_log drop constraint if exists newspaper_delivery_log_status_check;
alter table public.newspaper_delivery_log add constraint newspaper_delivery_log_status_check
  check (status in ('sent','queued','failed','bounced','opened'));

-- =============================================================================
-- DONE.
-- =============================================================================
