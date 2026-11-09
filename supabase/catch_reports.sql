-- Kanal-toppen / fångstrapporter — run in SQL Editor after schema.sql

create table if not exists public.catch_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  species text not null,
  length_cm numeric(5,1),
  weight_kg numeric(6,3),
  zone_id text,
  zone_name text,
  bait text,
  note text check (char_length(coalesce(note, '')) <= 200),
  caught_at timestamptz not null default now(),
  created_at timestamptz not null default now()
  -- length/weight optional (quick catch); see catch_reports_quick.sql
);

-- If table already existed without weight:
alter table public.catch_reports add column if not exists weight_kg numeric(6,3);

create index if not exists catch_reports_caught_at_idx
  on public.catch_reports (caught_at desc);

alter table public.catch_reports enable row level security;

drop policy if exists "catch_select_public" on public.catch_reports;
drop policy if exists "catch_insert_own" on public.catch_reports;
drop policy if exists "catch_update_own" on public.catch_reports;
drop policy if exists "catch_delete_own" on public.catch_reports;

create policy "catch_select_public" on public.catch_reports
  for select using (true);

create policy "catch_insert_own" on public.catch_reports
  for insert with check (auth.uid() = user_id);

create policy "catch_update_own" on public.catch_reports
  for update using (auth.uid() = user_id);

create policy "catch_delete_own" on public.catch_reports
  for delete using (auth.uid() = user_id);
