-- Ghost + open for company: visible in zone list (no map pin; lat/lng stay null)
drop policy if exists "sessions_select_public" on public.fishing_sessions;
create policy "sessions_select_public" on public.fishing_sessions
  for select using (
    ended_at is null
    and expires_at > now()
    and (
      visibility in ('zone', 'precise')
      or (
        visibility = 'ghost'
        and open_for_company = true
        and zone_id is not null
      )
    )
  );
