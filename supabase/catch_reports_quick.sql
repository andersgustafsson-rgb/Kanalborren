-- Allow quick catches without length/weight (fill in later)
alter table public.catch_reports drop constraint if exists catch_has_measure;
