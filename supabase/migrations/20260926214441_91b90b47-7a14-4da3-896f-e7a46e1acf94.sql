
create or replace function public.update_updated_at_column() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- Households
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our Home',
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.households to authenticated;
grant all on public.households to service_role;
alter table public.households enable row level security;

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null unique,
  person text not null check (person in ('Robin','Husband')),
  created_at timestamptz not null default now(),
  unique (household_id, person)
);
grant select on public.household_members to authenticated;
grant all on public.household_members to service_role;
alter table public.household_members enable row level security;

create or replace function public.is_household_member(_household_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.household_members where household_id = _household_id and user_id = auth.uid())
$$;

create policy "Members view household" on public.households for select to authenticated using (public.is_household_member(id));
create policy "Members update household" on public.households for update to authenticated using (public.is_household_member(id)) with check (public.is_household_member(id));
create policy "Members view members" on public.household_members for select to authenticated using (public.is_household_member(household_id));

-- Child profile
create table public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null default 'Little one',
  birth_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.child_profiles to authenticated;
grant all on public.child_profiles to service_role;
alter table public.child_profiles enable row level security;
create policy "Members manage child" on public.child_profiles for all to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

-- Shopping
create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  quantity text,
  unit text,
  category text not null default 'Other',
  note text,
  added_by uuid default auth.uid(),
  added_by_name text not null default 'Robin',
  frequent boolean not null default false,
  status text not null default 'to_buy' check (status in ('to_buy','in_basket','purchased')),
  purchased_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.shopping_items to authenticated;
grant all on public.shopping_items to service_role;
alter table public.shopping_items enable row level security;
create policy "Members manage shopping" on public.shopping_items for all to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create index on public.shopping_items (household_id, status);

-- Pantry
create table public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  category text not null default 'Other',
  status text not null default 'Available' check (status in ('Available','Low','Used Up')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.pantry_items to authenticated;
grant all on public.pantry_items to service_role;
alter table public.pantry_items enable row level security;
create policy "Members manage pantry" on public.pantry_items for all to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

-- Expenses
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  amount numeric(10,2) not null check (amount >= 0),
  spent_on date not null default current_date,
  category text not null default 'Other' check (category in ('Groceries','Dining','Utilities','Transport','Shopping','Child','Other')),
  store text,
  paid_by text not null check (paid_by in ('Robin','Husband')),
  note text,
  receipt_path text,
  from_shopping_trip boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.expenses to authenticated;
grant all on public.expenses to service_role;
alter table public.expenses enable row level security;
create policy "Members manage expenses" on public.expenses for all to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

create trigger t_households_upd before update on public.households for each row execute function public.update_updated_at_column();
create trigger t_child_upd before update on public.child_profiles for each row execute function public.update_updated_at_column();
create trigger t_shop_upd before update on public.shopping_items for each row execute function public.update_updated_at_column();
create trigger t_pantry_upd before update on public.pantry_items for each row execute function public.update_updated_at_column();
create trigger t_exp_upd before update on public.expenses for each row execute function public.update_updated_at_column();

-- Create / join
create or replace function public.create_household(_person text, _child_name text default 'Little one')
returns uuid language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if _person not in ('Robin','Husband') then raise exception 'Invalid person'; end if;
  if exists (select 1 from household_members where user_id = auth.uid()) then raise exception 'Already in a household'; end if;
  insert into households (name, created_by) values ('Our Home', auth.uid()) returning id into hid;
  insert into household_members (household_id, user_id, person) values (hid, auth.uid(), _person);
  insert into child_profiles (household_id, name) values (hid, coalesce(nullif(trim(_child_name),''),'Little one'));
  return hid;
end; $$;

create or replace function public.join_household(_code text, _person text)
returns uuid language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if _person not in ('Robin','Husband') then raise exception 'Invalid person'; end if;
  if exists (select 1 from household_members where user_id = auth.uid()) then raise exception 'Already in a household'; end if;
  select id into hid from households where invite_code = upper(trim(_code));
  if hid is null then raise exception 'Invite code not found'; end if;
  if (select count(*) from household_members where household_id = hid) >= 2 then raise exception 'Household is full'; end if;
  if exists (select 1 from household_members where household_id = hid and person = _person) then raise exception 'That name is already taken in this household'; end if;
  insert into household_members (household_id, user_id, person) values (hid, auth.uid(), _person);
  return hid;
end; $$;

revoke execute on function public.create_household(text, text) from anon, public;
revoke execute on function public.join_household(text, text) from anon, public;
grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.join_household(text, text) to authenticated;
grant execute on function public.is_household_member(uuid) to authenticated;

-- Realtime
alter table public.shopping_items replica identity full;
alter table public.pantry_items replica identity full;
alter table public.expenses replica identity full;
alter publication supabase_realtime add table public.shopping_items, public.pantry_items, public.expenses;

-- Receipt storage policies (bucket 'receipts', path = household_id/filename)
create policy "Members read receipts" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and public.is_household_member(((storage.foldername(name))[1])::uuid));
create policy "Members upload receipts" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and public.is_household_member(((storage.foldername(name))[1])::uuid));
create policy "Members delete receipts" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and public.is_household_member(((storage.foldername(name))[1])::uuid));
