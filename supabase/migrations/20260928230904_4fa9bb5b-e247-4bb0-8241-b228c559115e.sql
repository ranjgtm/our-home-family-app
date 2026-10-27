create table public.purchased_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  expense_id uuid references public.expenses(id) on delete set null,
  shopping_item_id uuid,
  name text not null,
  quantity numeric,
  unit text,
  unit_price numeric,
  line_total numeric,
  store text,
  purchased_on date not null default current_date,
  bought_by text not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.purchased_items to authenticated;
grant all on public.purchased_items to service_role;
alter table public.purchased_items enable row level security;
create policy "Members manage purchased items" on public.purchased_items for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create index purchased_items_household_idx on public.purchased_items(household_id, purchased_on desc);
create trigger t_purchased_upd before update on public.purchased_items for each row execute function public.update_updated_at_column();
alter publication supabase_realtime add table public.purchased_items;

-- Existing purchases become Bought Recently history (nothing deleted)
insert into public.purchased_items (household_id, shopping_item_id, name, purchased_on, bought_by, created_at)
select s.household_id, s.id, s.name, coalesce(s.purchased_at, s.updated_at)::date, s.added_by_name, coalesce(s.purchased_at, s.updated_at)
from public.shopping_items s where s.status = 'purchased';

-- A manual category choice is authoritative
alter table public.expenses add column category_manual boolean not null default false;

-- Receipt uploads: only into your own household's folder
drop policy if exists "Members upload receipts" on storage.objects;
create policy "Members upload receipts" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and public.is_household_member(((storage.foldername(name))[1])::uuid));