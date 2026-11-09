-- KanalHugget — fiskesällskap (kör i Supabase SQL Editor)
-- Efteråt: Database → Replication → aktivera Realtime för
-- company_requests och chat_messages

create table if not exists public.company_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.profiles (id) on delete cascade,
  to_user_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid references public.fishing_sessions (id) on delete set null,
  message text not null check (char_length(message) > 0 and char_length(message) <= 200),
  proposed_time timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  expires_at timestamptz not null default (now() + interval '2 hours'),
  chat_id uuid,
  created_at timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);

create index if not exists company_requests_to_pending_idx
  on public.company_requests (to_user_id, status)
  where status = 'pending';

create index if not exists company_requests_from_idx
  on public.company_requests (from_user_id, created_at desc);

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.company_requests (id) on delete cascade,
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.company_requests
  drop constraint if exists company_requests_chat_id_fkey;
alter table public.company_requests
  add constraint company_requests_chat_id_fkey
  foreign key (chat_id) references public.chats (id) on delete set null;

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) > 0 and char_length(body) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_chat_idx
  on public.chat_messages (chat_id, created_at);

alter table public.company_requests enable row level security;
alter table public.chats enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "company_select_involved" on public.company_requests;
drop policy if exists "company_insert_own" on public.company_requests;
drop policy if exists "company_update_involved" on public.company_requests;
drop policy if exists "chats_select_member" on public.chats;
drop policy if exists "chats_insert_member" on public.chats;
drop policy if exists "messages_select_member" on public.chat_messages;
drop policy if exists "messages_insert_member" on public.chat_messages;

create policy "company_select_involved" on public.company_requests
  for select using (
    auth.uid() = from_user_id or auth.uid() = to_user_id
  );

create policy "company_insert_own" on public.company_requests
  for insert with check (
    auth.uid() = from_user_id
    and expires_at > now()
  );

-- No direct UPDATE policy: status changes go through accept/decline/cancel RPCs.
-- No direct chats INSERT policy: chats are created only by accept_company_request.

create policy "chats_select_member" on public.chats
  for select using (
    auth.uid() = user_a or auth.uid() = user_b
  );

create policy "messages_select_member" on public.chat_messages
  for select using (
    exists (
      select 1 from public.chats c
      where c.id = chat_id
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );

create policy "messages_insert_member" on public.chat_messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.chats c
      where c.id = chat_id
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );

-- Acceptera förfrågan + skapa chatt i ett svep
create or replace function public.accept_company_request(request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.company_requests%rowtype;
  new_chat_id uuid;
begin
  select * into r from public.company_requests where id = request_id for update;
  if not found then
    raise exception 'Förfrågan hittades inte';
  end if;
  if r.to_user_id <> auth.uid() then
    raise exception 'Bara mottagaren kan acceptera';
  end if;
  if r.status <> 'pending' or r.expires_at <= now() then
    raise exception 'Förfrågan är inte längre giltig';
  end if;

  insert into public.chats (request_id, user_a, user_b)
  values (r.id, r.from_user_id, r.to_user_id)
  returning id into new_chat_id;

  update public.company_requests
  set status = 'accepted', chat_id = new_chat_id
  where id = r.id;

  return new_chat_id;
end;
$$;

revoke all on function public.accept_company_request(uuid) from public;
grant execute on function public.accept_company_request(uuid) to authenticated;

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
