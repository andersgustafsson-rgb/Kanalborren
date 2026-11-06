-- KanalHugget admin — already applied on production; keep for new envs
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- Promote your account (change email/id if needed):
-- update public.profiles set is_admin = true
-- where id = (select id from auth.users where email = 'agracing2@hotmail.com');

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "admin_select_profiles" on public.profiles;
create policy "admin_select_profiles" on public.profiles
  for select using (public.is_admin());

drop policy if exists "admin_update_profiles" on public.profiles;
create policy "admin_update_profiles" on public.profiles
  for update using (public.is_admin());

drop policy if exists "admin_select_sessions" on public.fishing_sessions;
create policy "admin_select_sessions" on public.fishing_sessions
  for select using (public.is_admin());

drop policy if exists "admin_update_sessions" on public.fishing_sessions;
create policy "admin_update_sessions" on public.fishing_sessions
  for update using (public.is_admin());

drop policy if exists "admin_select_company" on public.company_requests;
create policy "admin_select_company" on public.company_requests
  for select using (public.is_admin());

drop policy if exists "admin_select_chats" on public.chats;
create policy "admin_select_chats" on public.chats
  for select using (public.is_admin());

drop policy if exists "admin_select_messages" on public.chat_messages;
create policy "admin_select_messages" on public.chat_messages
  for select using (public.is_admin());

drop policy if exists "admin_delete_catch" on public.catch_reports;
create policy "admin_delete_catch" on public.catch_reports
  for delete using (public.is_admin());

create or replace function public.admin_list_users()
returns table (
  id uuid,
  display_name text,
  email text,
  is_admin boolean,
  banned_at timestamptz,
  created_at timestamptz,
  active_now boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Ej admin';
  end if;
  return query
  select
    p.id,
    p.display_name,
    u.email::text,
    p.is_admin,
    p.banned_at,
    p.created_at,
    exists (
      select 1 from public.fishing_sessions s
      where s.user_id = p.id
        and s.ended_at is null
        and s.expires_at > now()
    ) as active_now
  from public.profiles p
  join auth.users u on u.id = p.id
  order by p.created_at desc;
end;
$$;

revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;

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
