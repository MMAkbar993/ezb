-- =============================================================================
-- Concord Deal Platform — Training Center Schema
-- Run this in the Supabase SQL Editor (AFTER full_schema.sql / phase2_schema.sql).
-- Creates the training tables with RLS + grants. Idempotent and safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. training_modules — top-level course modules
--    order: 1..10 (as defined in the training manual)
-- ---------------------------------------------------------------------------
create table if not exists public.training_modules (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  icon         text default '📘',
  "order"      int not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. training_lessons — lessons within a module
-- ---------------------------------------------------------------------------
create table if not exists public.training_lessons (
  id               uuid primary key default gen_random_uuid(),
  module_id        uuid references public.training_modules(id) on delete cascade,
  title            text not null,
  content          text,                 -- markdown / rich lesson body
  video_url        text,                 -- embedded video (YouTube/Loom/Vimeo)
  pdf_url          text,                 -- downloadable PDF guide
  "order"          int not null default 0,
  duration_minutes int not null default 10,
  is_published     boolean not null default true,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. training_quiz_questions — quiz per lesson (multiple choice)
--    options: JSON array of strings e.g. '["A","B","C","D"]'
--    correct_answer: text matching one of the options
-- ---------------------------------------------------------------------------
create table if not exists public.training_quiz_questions (
  id              uuid primary key default gen_random_uuid(),
  lesson_id       uuid references public.training_lessons(id) on delete cascade,
  question        text not null,
  options         jsonb not null default '[]'::jsonb,
  correct_answer  text not null,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. training_progress — per-broker lesson completion + rating
-- ---------------------------------------------------------------------------
create table if not exists public.training_progress (
  id          uuid primary key default gen_random_uuid(),
  broker_id   uuid references public.profiles(id) on delete cascade,
  lesson_id   uuid references public.training_lessons(id) on delete cascade,
  completed   boolean not null default false,
  completed_at timestamptz,
  rating      int,                       -- 1..5 (lesson feedback)
  created_at  timestamptz not null default now(),
  unique (broker_id, lesson_id)
);

-- ---------------------------------------------------------------------------
-- 5. training_certificates — module completion certificates
-- ---------------------------------------------------------------------------
create table if not exists public.training_certificates (
  id             uuid primary key default gen_random_uuid(),
  broker_id      uuid references public.profiles(id) on delete cascade,
  module_id      uuid references public.training_modules(id) on delete cascade,
  certificate_url text,
  issued_at      timestamptz not null default now(),
  unique (broker_id, module_id)
);

-- ---------------------------------------------------------------------------
-- 6. training_uploads — broker-submitted training materials
-- ---------------------------------------------------------------------------
create table if not exists public.training_uploads (
  id          uuid primary key default gen_random_uuid(),
  broker_id   uuid references public.profiles(id) on delete cascade,
  title       text not null,
  file_url    text not null,
  file_type   text not null default 'pdf',  -- pdf | video | doc | xlsx | ppt
  module_id   uuid references public.training_modules(id) on delete set null,
  uploaded_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists training_lessons_module_idx on public.training_lessons (module_id);
create index if not exists training_quiz_lesson_idx on public.training_quiz_questions (lesson_id);
create index if not exists training_progress_broker_idx on public.training_progress (broker_id);
create index if not exists training_progress_lesson_idx on public.training_progress (lesson_id);
create index if not exists training_cert_broker_idx on public.training_certificates (broker_id);
create index if not exists training_uploads_broker_idx on public.training_uploads (broker_id);

-- ---------------------------------------------------------------------------
-- RLS — default deny; authenticated (broker team) read + own-write.
-- Training content is read by all authenticated; progress/certificates/uploads
-- are scoped to the owning broker.
-- ---------------------------------------------------------------------------
alter table public.training_modules enable row level security;
alter table public.training_lessons enable row level security;
alter table public.training_quiz_questions enable row level security;
alter table public.training_progress enable row level security;
alter table public.training_certificates enable row level security;
alter table public.training_uploads enable row level security;

-- Content tables: authenticated read (published content); admins manage via
-- direct DB / SQL (no admin write path needed for this build).
drop policy if exists "train_modules_read" on public.training_modules;
create policy "train_modules_read" on public.training_modules
  for select to authenticated using (true);

drop policy if exists "train_modules_write" on public.training_modules;
create policy "train_modules_write" on public.training_modules
  for insert to authenticated with check (true);

drop policy if exists "train_lessons_read" on public.training_lessons;
create policy "train_lessons_read" on public.training_lessons
  for select to authenticated using (true);

drop policy if exists "train_lessons_write" on public.training_lessons;
create policy "train_lessons_write" on public.training_lessons
  for insert to authenticated with check (true);

drop policy if exists "train_quiz_read" on public.training_quiz_questions;
create policy "train_quiz_read" on public.training_quiz_questions
  for select to authenticated using (true);

drop policy if exists "train_quiz_write" on public.training_quiz_questions;
create policy "train_quiz_write" on public.training_quiz_questions
  for insert to authenticated with check (true);

-- Progress: owner-only full control (upsert on completion)
drop policy if exists "train_progress_owner_all" on public.training_progress;
create policy "train_progress_owner_all" on public.training_progress
  for all using (auth.uid() = broker_id) with check (auth.uid() = broker_id);

-- Certificates: owner read, service/admin write
drop policy if exists "train_cert_owner_read" on public.training_certificates;
create policy "train_cert_owner_read" on public.training_certificates
  for select using (auth.uid() = broker_id);

drop policy if exists "train_cert_write" on public.training_certificates;
create policy "train_cert_write" on public.training_certificates
  for insert to authenticated with check (true);

-- Uploads: owner read/write, authenticated read (team materials)
drop policy if exists "train_uploads_owner_all" on public.training_uploads;
create policy "train_uploads_owner_all" on public.training_uploads
  for all using (auth.uid() = broker_id) with check (auth.uid() = broker_id);

drop policy if exists "train_uploads_auth_read" on public.training_uploads;
create policy "train_uploads_auth_read" on public.training_uploads
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Storage bucket for training materials + policy
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('training', 'training', true)
on conflict (id) do nothing;

drop policy if exists "training public read" on storage.objects;
create policy "training public read" on storage.objects
  for select using (bucket_id = 'training');

drop policy if exists "training auth upload" on storage.objects;
create policy "training auth upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'training');

-- ---------------------------------------------------------------------------
-- Grants — standard permissions for authenticated + service role
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated, service_role;
grant select on public.training_modules, public.training_lessons,
  public.training_quiz_questions, public.training_progress,
  public.training_certificates, public.training_uploads to authenticated;
grant insert, update, delete on public.training_progress,
  public.training_uploads to authenticated;
grant all on all tables in schema public to service_role;
