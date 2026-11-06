-- Tips / buggar / idéer från användare → admin
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  kind text not null default 'tip'
    check (kind in ('tip', 'bug', 'idea')),
  message text not null
    check (char_length(message) >= 5 and char_length(message) <= 2000),
  page text check (char_length(coalesce(page, '')) <= 80),
  status text not null default 'new'
    check (status in ('new', 'done', 'ignored')),
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_at_idx
  on public.feedback (created_at desc);

alter table public.feedback enable row level security;

drop policy if exists "feedback_insert_own" on public.feedback;
create policy "feedback_insert_own" on public.feedback
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "feedback_select_own" on public.feedback;
create policy "feedback_select_own" on public.feedback
  for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "admin_update_feedback" on public.feedback;
create policy "admin_update_feedback" on public.feedback
  for update to authenticated
  using (public.is_admin());

drop policy if exists "admin_delete_feedback" on public.feedback;
create policy "admin_delete_feedback" on public.feedback
  for delete to authenticated
  using (public.is_admin());
