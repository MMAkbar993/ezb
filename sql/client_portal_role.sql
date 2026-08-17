-- Adds a seller/buyer party distinction to client_portal_access so a broker
-- can issue separate links for the seller and a buyer on the same deal, and
-- the portal API can scope what each party sees.
-- Idempotent — safe to run multiple times.

alter table client_portal_access
  add column if not exists party_type text not null default 'seller';

alter table client_portal_access
  drop constraint if exists client_portal_access_party_type_check;

alter table client_portal_access
  add constraint client_portal_access_party_type_check
  check (party_type in ('seller', 'buyer'));
