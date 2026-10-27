alter table public.pantry_items add column if not exists is_staple boolean not null default false;
alter table public.households add column if not exists cuisine_prefs jsonb not null default '{"Nepali":"Sometimes","Indian / South Asian":"Sometimes","European / Finnish":"Sometimes","International":"Sometimes"}'::jsonb;
alter table public.planned_meals add column if not exists cuisine text;
alter table public.planned_meals add column if not exists staples_used text[] not null default '{}';