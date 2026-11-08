-- Optional diary note when ending a fishing session / trip.

alter table public.fishing_sessions
  add column if not exists trip_note text
  check (char_length(coalesce(trip_note, '')) <= 400);
