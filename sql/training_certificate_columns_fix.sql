-- ---------------------------------------------------------------------------
-- Live-DB audit (item 8 final smoke test) found training_certificates is
-- missing two columns that lib/training.ts's saveCertificate() has always
-- written on every insert: `template` and `certificate_key`. Confirmed live:
-- verification_code and verified_at already exist (added at some point),
-- but template/certificate_key never landed — so every real certificate
-- issuance in production has been failing with "Could not find the
-- 'template' column of 'training_certificates' in the schema cache."
-- This is the same fix already written (but apparently never fully applied)
-- in sql/onboarding_schema.sql's do$$ block — isolated here as a small,
-- idempotent, standalone fix so it can be safely re-run without re-running
-- that file's other statements (onboarding_steps seed, certified_brokers
-- view).
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='training_certificates' and column_name='template') then
    alter table public.training_certificates
      add column template text not null default 'gold';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='training_certificates' and column_name='certificate_key') then
    alter table public.training_certificates
      add column certificate_key text;      -- base64-encoded payload for QR
  end if;
end $$;
