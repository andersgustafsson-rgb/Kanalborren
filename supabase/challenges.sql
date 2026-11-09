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

drop policy if exists "challenges_select_involved" on public.challenges;
create policy "challenges_select_involved" on public.challenges
  for select using (
    auth.uid() = from_user_id or auth.uid() = to_user_id or public.is_admin()
  );

drop policy if exists "challenges_insert_own" on public.challenges;
create policy "challenges_insert_own" on public.challenges
  for insert to authenticated
  with check (
    auth.uid() = from_user_id
    and status = 'pending'
  );

-- Status transitions via RPCs (accept / resolve / sweep), not broad UPDATE.

create or replace function public.accept_challenge(challenge_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  c public.challenges%rowtype;
begin
  select * into c from public.challenges where id = challenge_id for update;
  if not found then raise exception 'Utmaning hittades inte'; end if;
  if c.to_user_id <> auth.uid() then raise exception 'Bara mottagaren kan acceptera'; end if;
  if c.status <> 'pending' or c.ends_at <= now() then raise exception 'Utmaningen gäller inte längre'; end if;
  update public.challenges
  set status = 'active', starts_at = now()
  where id = c.id;
  return c.id;
end;
$$;

create or replace function public.resolve_challenge(challenge_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  c public.challenges%rowtype;
  from_score numeric;
  to_score numeric;
  winner uuid;
  window_start timestamptz;
begin
  select * into c from public.challenges where id = challenge_id for update;
  if not found then raise exception 'Utmaning hittades inte'; end if;
  if c.status <> 'active' then return c.winner_user_id; end if;
  if auth.uid() <> c.from_user_id and auth.uid() <> c.to_user_id and not public.is_admin() then
    raise exception 'Ej behörig';
  end if;

  window_start := coalesce(c.starts_at, c.created_at);

  if c.metric = 'weight_kg' then
    select max(cr.weight_kg) into from_score from public.catch_reports cr
      where cr.user_id = c.from_user_id and cr.species = c.species
        and cr.caught_at >= window_start and cr.caught_at <= c.ends_at
        and coalesce(cr.is_private, false) = false;
    select max(cr.weight_kg) into to_score from public.catch_reports cr
      where cr.user_id = c.to_user_id and cr.species = c.species
        and cr.caught_at >= window_start and cr.caught_at <= c.ends_at
        and coalesce(cr.is_private, false) = false;
  else
    select max(cr.length_cm) into from_score from public.catch_reports cr
      where cr.user_id = c.from_user_id and cr.species = c.species
        and cr.caught_at >= window_start and cr.caught_at <= c.ends_at
        and coalesce(cr.is_private, false) = false;
    select max(cr.length_cm) into to_score from public.catch_reports cr
      where cr.user_id = c.to_user_id and cr.species = c.species
        and cr.caught_at >= window_start and cr.caught_at <= c.ends_at
        and coalesce(cr.is_private, false) = false;
  end if;

  if from_score is null and to_score is null then
    winner := null;
  elsif from_score is null then
    winner := c.to_user_id;
  elsif to_score is null then
    winner := c.from_user_id;
  elsif from_score > to_score then
    winner := c.from_user_id;
  elsif to_score > from_score then
    winner := c.to_user_id;
  else
    winner := null; -- oavgjort
  end if;

  update public.challenges
  set status = 'completed', winner_user_id = winner
  where id = c.id;

  return winner;
end;
$$;

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

revoke all on function public.accept_challenge(uuid) from public;
revoke all on function public.resolve_challenge(uuid) from public;
revoke all on function public.sweep_my_challenges() from public;
grant execute on function public.accept_challenge(uuid) to authenticated;
grant execute on function public.resolve_challenge(uuid) to authenticated;
grant execute on function public.sweep_my_challenges() to authenticated;
