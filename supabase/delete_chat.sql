-- Allow either chat participant to permanently delete a chat (messages cascade).

create or replace function public.delete_my_chat(p_chat_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.chats%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Logga in först';
  end if;

  select * into c from public.chats where id = p_chat_id for update;
  if not found then
    raise exception 'Chatten hittades inte';
  end if;
  if c.user_a <> auth.uid() and c.user_b <> auth.uid() then
    raise exception 'Du får bara radera egna chattar';
  end if;

  update public.company_requests
  set status = 'cancelled', chat_id = null
  where id = c.request_id;

  delete from public.chats where id = c.id;
end;
$$;

revoke all on function public.delete_my_chat(uuid) from public;
grant execute on function public.delete_my_chat(uuid) to authenticated;
