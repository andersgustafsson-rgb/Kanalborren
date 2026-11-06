-- Run if catch_reports already exists without weight_kg
alter table public.catch_reports add column if not exists weight_kg numeric(6,3);
