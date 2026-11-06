-- KanalHugget utmaningar (already applied in prod; keep for new envs)
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.profiles (id) on delete cascade,
  to_user_id uuid not null references public.profiles (id) on delete cascade,
  species text not null default 'Abborre',
  metric text not null default 'length_cm' check (metric in ('length_cm', 'weight_kg')),
  message text check (char_length(coalesce(message, '')) <= 200),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'declined', 'completed', 'expired', 'cancelled')),
  starts_at timestamptz,
  ends_at timestamptz not null,
  winner_user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);

alter table public.challenges enable row level security;
-- policies + RPCs: see production / prior migration apply
