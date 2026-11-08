-- Private catches: only owner can see them. Public map/highscores skip these.

alter table public.catch_reports
  add column if not exists is_private boolean not null default false;

create index if not exists catch_reports_private_user_idx
  on public.catch_reports (user_id, is_private, caught_at desc);

drop policy if exists "catch_select_public" on public.catch_reports;
drop policy if exists "catch_select_visible" on public.catch_reports;

create policy "catch_select_visible" on public.catch_reports
  for select using (
    is_private = false
    or auth.uid() = user_id
  );
