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

-- Auto-expire unanswered challenges and resolve timed-out active ones
create or replace function public.sweep_my_challenges()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r record;
  n integer := 0;
begin
  if auth.uid() is null then
    return 0;
  end if;

  update public.challenges
  set status = 'expired'
  where status = 'pending'
    and ends_at <= now()
    and (from_user_id = auth.uid() or to_user_id = auth.uid());
  get diagnostics n = row_count;

  for r in
    select id
    from public.challenges
    where status = 'active'
      and ends_at <= now()
      and (from_user_id = auth.uid() or to_user_id = auth.uid())
  loop
    perform public.resolve_challenge(r.id);
    n := n + 1;
  end loop;

  return n;
end;
$$;

grant execute on function public.sweep_my_challenges() to authenticated;
