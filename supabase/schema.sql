-- KanalHugget Etapp 1 — run in Supabase SQL editor
-- Enable Realtime for fishing_sessions after create (Database → Replication)

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  age_attested_16_plus boolean not null default false,
  avatar_id text,
  created_at timestamptz not null default now(),
  banned_at timestamptz
);

create table if not exists public.fishing_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  mode text not null check (mode in ('fishing_now', 'planned')),
  visibility text not null check (visibility in ('ghost', 'zone', 'precise')),
  zone_id text,
  zone_name text,
  lat double precision,
  lng double precision,
  open_for_company boolean not null default false,
  note text check (char_length(coalesce(note, '')) <= 200),
  avatar_id text,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  last_heartbeat_at timestamptz not null default now()
);

create index if not exists fishing_sessions_active_idx
  on public.fishing_sessions (expires_at)
  where ended_at is null;

alter table public.profiles enable row level security;
alter table public.fishing_sessions enable row level security;

drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "sessions_select_public" on public.fishing_sessions;
drop policy if exists "sessions_select_own" on public.fishing_sessions;
drop policy if exists "sessions_insert_own" on public.fishing_sessions;
drop policy if exists "sessions_update_own" on public.fishing_sessions;

create policy "profiles_select" on public.profiles
  for select using (banned_at is null);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "sessions_select_public" on public.fishing_sessions
  for select using (
    ended_at is null
    and expires_at > now()
    and visibility in ('zone', 'precise')
  );

create policy "sessions_select_own" on public.fishing_sessions
  for select using (auth.uid() = user_id);

create policy "sessions_insert_own" on public.fishing_sessions
  for insert with check (auth.uid() = user_id);

create policy "sessions_update_own" on public.fishing_sessions
  for update using (auth.uid() = user_id);

-- Auto profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, age_attested_16_plus)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Fiskare'),
    coalesce((new.raw_user_meta_data->>'age_attested_16_plus')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
