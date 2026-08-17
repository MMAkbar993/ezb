-- Adds broker-controlled buyer/seller visibility to the two document tables
-- that actually hold shareable deal paperwork: financial_documents (source
-- uploads + generated Recast/BOV/CIM/BLI) and deal_documents (deal-scoped
-- uploads). Sellers see their own documents by default (matches today's
-- behavior); buyers see nothing until the broker explicitly shares it.
-- Idempotent — safe to run multiple times.

alter table financial_documents
  add column if not exists visible_to_seller boolean not null default true;
alter table financial_documents
  add column if not exists visible_to_buyer boolean not null default false;

alter table deal_documents
  add column if not exists visible_to_seller boolean not null default true;
alter table deal_documents
  add column if not exists visible_to_buyer boolean not null default false;
alter table deal_documents
  add column if not exists uploaded_by_role text;
