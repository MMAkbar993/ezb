-- =============================================================================
-- Concord Deal Platform — Analytics & Commission tracking schema
-- Run this in the Supabase SQL Editor (idempotent).
-- -----------------------------------------------------------------------------
-- Adds a `commissions` table for revenue/commission analytics and broker
-- performance. If this is not run, the analytics dashboard degrades grace-
-- fully: revenue charts fall back to closed-deal purchase_price, and broker
-- performance returns empty.
-- =============================================================================

create table if not exists public.commissions (
  id                uuid primary key default gen_random_uuid(),
  deal_id           uuid references public.deals(id) on delete set null,
  agent_id          uuid references public.profiles(id) on delete set null,
  agent_name        text,                                 -- denormalized for reports
  amount            numeric default 0,                    -- deal revenue
  commission_amount numeric default 0,                    -- broker commission earned
  rate_percent      numeric default 0,                    -- commission rate
  status            text default 'unpaid'
                    check (status in ('unpaid','paid','partial','void')),
  paid_at           timestamptz,
  notes             text,
  created_at        timestamptz not null default now()
);

create index if not exists commissions_deal_idx   on public.commissions (deal_id);
create index if not exists commissions_agent_idx  on public.commissions (agent_id);
create index if not exists commissions_status_idx on public.commissions (status);

-- RLS: authenticated team can read/write commissions.
alter table public.commissions enable row level security;
drop policy if exists "commissions_select" on public.commissions;
create policy "commissions_select" on public.commissions for select to authenticated using (true);
drop policy if exists "commissions_insert" on public.commissions;
create policy "commissions_insert" on public.commissions for insert to authenticated with check (true);
drop policy if exists "commissions_update" on public.commissions;
create policy "commissions_update" on public.commissions for update to authenticated using (true);
