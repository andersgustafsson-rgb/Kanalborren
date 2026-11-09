-- Lokala kanalplatser — publika att läsa, endast admin skriver
create table if not exists public.canal_spots (
  id text primary key,
  name text not null,
  note text,
  confidence text,
  sources jsonb not null default '[]'::jsonb,
  lng double precision not null,
  lat double precision not null,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

create index if not exists canal_spots_sort_order_idx
  on public.canal_spots (sort_order, name);

alter table public.canal_spots enable row level security;

drop policy if exists "canal_spots_select_public" on public.canal_spots;
create policy "canal_spots_select_public" on public.canal_spots
  for select using (true);

drop policy if exists "canal_spots_insert_admin" on public.canal_spots;
create policy "canal_spots_insert_admin" on public.canal_spots
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "canal_spots_update_admin" on public.canal_spots;
create policy "canal_spots_update_admin" on public.canal_spots
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "canal_spots_delete_admin" on public.canal_spots;
create policy "canal_spots_delete_admin" on public.canal_spots
  for delete to authenticated
  using (public.is_admin());

create or replace function public.touch_canal_spot()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if new.updated_by is null then
    new.updated_by = auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists canal_spots_touch on public.canal_spots;
create trigger canal_spots_touch
  before insert or update on public.canal_spots
  for each row execute function public.touch_canal_spot();

-- Realtime so other clients refresh without reload
do $$
begin
  alter publication supabase_realtime add table public.canal_spots;
exception
  when duplicate_object then null;
end;
$$;

-- Seed current spots (idempotent upsert)
insert into public.canal_spots (id, name, note, confidence, sources, lng, lat, sort_order)
values
  ('poliskurvan', 'Poliskurvan',
   'Kurvan där Rörsjökanalen möter Södra förstads kanalen (Östra Promenaden / Exercisgatan). Korrigerad enligt lokal kännedom 2026-11-06.',
   'high', '["Användarkorrigering","OSM-kanalgeometri"]'::jsonb,
   13.014657497406006, 55.60542065542826, 0),
  ('anna_lindhs_plats', 'Anna Lindhs plats',
   'Platsen vid kanalen / stationsområdet (Anna Lindhs plats).',
   'high', '["OpenStreetMap"]'::jsonb,
   12.996751070022585, 55.60937196811503, 1),
  ('kyrkogarden', 'Kyrkogården',
   'Kajen utanför Sankt Pauli kyrkogård längs Södra förstads kanalen.',
   'high', '["Användarönskemål","OSM-kanalgeometri"]'::jsonb,
   12.997475266456604, 55.600944646360766, 2),
  ('roddklubben', 'Roddklubben',
   'Malmö Roddklubb vid Slussplan – landmärke och omnämnd fiskezon i lokal snack.',
   'high', '["OpenStreetMap","malmoroddklubb.se"]'::jsonb,
   13.01234006881714, 55.60952346757884, 3),
  ('slussen', 'Slussen / Slussplan',
   'Området kring Slussbron mellan polishuset och roddklubben. Fiske från bron är förbjudet.',
   'high', '["OpenStreetMap","Fiskesnack-forum"]'::jsonb,
   13.01275, 55.60919, 4),
  ('schougens', 'Schougens',
   'Kajer kring Schougens bro (inte från bron).',
   'high', '["OpenStreetMap"]'::jsonb,
   13.01325, 55.6081, 5),
  ('gondolen', 'Gondolen',
   'Sportfiskarnas streetfiske-mötesplats vid Slottsparken/Gondolen.',
   'high', '["Sportfiskarna streetfiske (Eniro-länk)"]'::jsonb,
   12.98827, 55.60398, 6),
  ('trampbatar', 'Trampbåtsbryggan',
   'Raul Wallenbergs park – vanlig samlingsplats (KM, Abborrens dag, streetfiske).',
   'high', '["OpenStreetMap Trampbåtarna","Sportfiskarna","SFK Spinnaren"]'::jsonb,
   13.00434, 55.60221, 7),
  ('slottsparken', 'Slottsparken',
   'Parkkajer längs kanalen – ofta omnämnd i reportage.',
   'approx', '["Fiskejournalen","OpenStreetMap"]'::jsonb,
   12.99, 55.6035, 8),
  ('kungsparken', 'Kungsparken',
   'Kajsträcka vid Kungsparken.',
   'high', '["lokal kännedom"]'::jsonb,
   12.990034818649294, 55.602305382905584, 9),
  ('hovratten', 'Hovrätten',
   'Kajerna kring Hovrättsbron (inte från bron).',
   'high', '["Fiskesnack-forum","OpenStreetMap"]'::jsonb,
   12.990700006484987, 55.60677517632064, 10),
  ('sodertull', 'Södertull',
   'Där kanalen böjer sig vid Södertull / södra sträckan.',
   'approx', '["Fiskesnack-forum"]'::jsonb,
   12.9985, 55.6012, 11),
  ('davidshall', 'Davidshall',
   'Området kring Davidshallsbron.',
   'approx', '["OpenStreetMap"]'::jsonb,
   13.0009, 55.6011, 12),
  ('fersens', 'Fersens',
   'Kajerna kring Fersens bro.',
   'approx', '["OpenStreetMap"]'::jsonb,
   12.9952, 55.6016, 13),
  ('turbinen', 'Turbinen',
   'Västra ytterområdet vid Turbinbron / Turbinkanalen.',
   'high', '["OpenStreetMap","SFK Spinnaren (yttre gräns omnämnd)"]'::jsonb,
   12.9821, 55.6039, 14),
  ('citadell', 'Citadell',
   'Kajerna kring Citadellsbron / västra kanalarmen.',
   'approx', '["OpenStreetMap"]'::jsonb,
   12.9858, 55.6064, 15),
  ('centralen', 'Centralen',
   'Kanalsträckan närmast Centralstationen / Norra Vallgatan.',
   'high', '["lokal kännedom"]'::jsonb,
   13.000999689102175, 55.60852962042298, 16)
on conflict (id) do update set
  name = excluded.name,
  note = excluded.note,
  confidence = excluded.confidence,
  sources = excluded.sources,
  lng = excluded.lng,
  lat = excluded.lat,
  sort_order = excluded.sort_order;
