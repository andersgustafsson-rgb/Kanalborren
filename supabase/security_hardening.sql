-- Security hardening: admin flag, session coords/expiry, company request flow
-- Apply on production; keep for new envs.

-- ---------------------------------------------------------------------------
-- 1) Protect profiles.is_admin / banned_at
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.is_admin is distinct from old.is_admin then
      if current_setting('kanalhugget.allow_admin_flag', true) is distinct from 'on' then
        raise exception 'is_admin kan inte ändras via klient';
      end if;
    end if;
    if new.banned_at is distinct from old.banned_at then
      if not public.is_admin()
         and current_setting('kanalhugget.allow_admin_flag', true) is distinct from 'on' then
        raise exception 'banned_at kräver admin';
      end if;
    end if;
  elsif tg_op = 'INSERT' then
    if coalesce(new.is_admin, false) then
      if current_setting('kanalhugget.allow_admin_flag', true) is distinct from 'on' then
        new.is_admin := false;
      end if;
    end if;
    if new.banned_at is not null then
      if current_setting('kanalhugget.allow_admin_flag', true) is distinct from 'on' then
        new.banned_at := null;
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_privileges on public.profiles;
create trigger profiles_protect_privileges
  before insert or update on public.profiles
  for each row execute function public.protect_profile_privileges();

-- Narrow column updates for authenticated (defense in depth)
revoke update on table public.profiles from anon, authenticated;
grant update (display_name, avatar_id, age_attested_16_plus)
  on table public.profiles to authenticated;

-- Keep ban RPC working under the privilege guard
create or replace function public.admin_set_banned(target uuid, ban boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Ej admin';
  end if;
  if target = auth.uid() then
    raise exception 'Du kan inte banna dig själv';
  end if;
  perform set_config('kanalhugget.allow_admin_flag', 'on', true);
  update public.profiles
  set banned_at = case when ban then now() else null end
  where id = target;
  if ban then
    update public.fishing_sessions
    set ended_at = now()
    where user_id = target and ended_at is null;
  end if;
end;
$$;

revoke all on function public.admin_set_banned(uuid, boolean) from public;
grant execute on function public.admin_set_banned(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Server-side privacy rounding + session duration cap
-- ---------------------------------------------------------------------------
create or replace function public.round_coord_privacy(lat double precision, lng double precision)
returns table (out_lat double precision, out_lng double precision)
language sql
immutable
as $$
  select
    round((lat / 0.0006)::numeric) * 0.0006,
    round((lng / 0.001)::numeric) * 0.001;
$$;

create or replace function public.sanitize_fishing_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  spot_lat double precision;
  spot_lng double precision;
  rounded record;
  max_len interval := interval '6 hours';
  default_len interval := interval '4 hours';
begin
  if new.starts_at is null then
    new.starts_at := now();
  end if;

  if new.expires_at is null or new.expires_at <= new.starts_at then
    new.expires_at := new.starts_at + default_len;
  end if;
  if new.expires_at > new.starts_at + max_len then
    new.expires_at := new.starts_at + max_len;
  end if;

  if new.visibility = 'ghost' then
    new.lat := null;
    new.lng := null;
  elsif new.visibility = 'zone' then
    if new.zone_id is not null then
      select cs.lat, cs.lng into spot_lat, spot_lng
      from public.canal_spots cs
      where cs.id = new.zone_id;
      if found then
        new.lat := spot_lat;
        new.lng := spot_lng;
      elsif new.lat is not null and new.lng is not null then
        select * into rounded from public.round_coord_privacy(new.lat, new.lng);
        new.lat := rounded.out_lat;
        new.lng := rounded.out_lng;
      else
        new.lat := null;
        new.lng := null;
      end if;
    else
      new.lat := null;
      new.lng := null;
    end if;
  elsif new.visibility = 'precise' then
    if new.lat is not null and new.lng is not null then
      select * into rounded from public.round_coord_privacy(new.lat, new.lng);
      new.lat := rounded.out_lat;
      new.lng := rounded.out_lng;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists fishing_sessions_sanitize on public.fishing_sessions;
create trigger fishing_sessions_sanitize
  before insert or update on public.fishing_sessions
  for each row execute function public.sanitize_fishing_session();

-- ---------------------------------------------------------------------------
-- 3) Company requests: only controlled status transitions + chat creation
-- ---------------------------------------------------------------------------
drop policy if exists "company_update_involved" on public.company_requests;
drop policy if exists "chats_insert_member" on public.chats;

create or replace function public.decline_company_request(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.company_requests%rowtype;
begin
  select * into r from public.company_requests where id = request_id for update;
  if not found then
    raise exception 'Förfrågan hittades inte';
  end if;
  if r.to_user_id <> auth.uid() then
    raise exception 'Bara mottagaren kan avböja';
  end if;
  if r.status <> 'pending' or r.expires_at <= now() then
    raise exception 'Förfrågan är inte längre giltig';
  end if;
  update public.company_requests
  set status = 'declined'
  where id = r.id;
end;
$$;

create or replace function public.cancel_company_request(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.company_requests%rowtype;
begin
  select * into r from public.company_requests where id = request_id for update;
  if not found then
    raise exception 'Förfrågan hittades inte';
  end if;
  if r.from_user_id <> auth.uid() then
    raise exception 'Bara avsändaren kan avbryta';
  end if;
  if r.status <> 'pending' then
    raise exception 'Förfrågan är inte längre giltig';
  end if;
  update public.company_requests
  set status = 'cancelled'
  where id = r.id;
end;
$$;

revoke all on function public.decline_company_request(uuid) from public;
revoke all on function public.cancel_company_request(uuid) from public;
grant execute on function public.decline_company_request(uuid) to authenticated;
grant execute on function public.cancel_company_request(uuid) to authenticated;

-- accept_company_request already creates chats as security definer
