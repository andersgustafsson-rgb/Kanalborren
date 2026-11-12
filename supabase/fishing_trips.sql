-- Personal fishing pass (timer) — independent of check-in / fishing_sessions

create table if not exists public.fishing_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '4 hours'),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

-- Existing installs that created the table before expires_at
alter table public.fishing_trips
  add column if not exists expires_at timestamptz;

update public.fishing_trips
set expires_at = started_at + interval '4 hours'
where expires_at is null;

update public.fishing_trips
set ended_at = least(coalesce(expires_at, now()), now())
where ended_at is null
  and expires_at is not null
  and expires_at <= now();

alter table public.fishing_trips
  alter column expires_at set default (now() + interval '4 hours');

alter table public.fishing_trips
  alter column expires_at set not null;

create unique index if not exists fishing_trips_one_active_per_user
  on public.fishing_trips (user_id)
  where ended_at is null;

create index if not exists fishing_trips_user_started_idx
  on public.fishing_trips (user_id, started_at desc);

alter table public.fishing_trips enable row level security;

drop policy if exists "trips_select_own" on public.fishing_trips;
drop policy if exists "trips_insert_own" on public.fishing_trips;
drop policy if exists "trips_update_own" on public.fishing_trips;

create policy "trips_select_own" on public.fishing_trips
  for select using (auth.uid() = user_id);

create policy "trips_insert_own" on public.fishing_trips
  for insert with check (auth.uid() = user_id);

create policy "trips_update_own" on public.fishing_trips
  for update using (auth.uid() = user_id);
