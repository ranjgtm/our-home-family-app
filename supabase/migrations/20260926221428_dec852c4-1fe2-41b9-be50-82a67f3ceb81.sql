-- Allow any display name for household members
alter table public.household_members drop constraint if exists household_members_person_check;
alter table public.household_members add constraint household_members_person_len check (char_length(trim(person)) between 1 and 40);

alter table public.expenses drop constraint if exists expenses_paid_by_check;
alter table public.expenses add constraint expenses_paid_by_len check (char_length(trim(paid_by)) between 1 and 40);

-- Members may rename themselves
create policy "Members rename themselves" on public.household_members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_household_member(household_id));

create or replace function public.create_household(_person text, _child_name text default 'Little one', _home_name text default 'Our Home')
returns uuid language plpgsql security definer set search_path = public as $$
declare hid uuid; nm text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  nm := nullif(trim(_person), '');
  if nm is null or char_length(nm) > 40 then raise exception 'Please enter your name'; end if;
  if exists (select 1 from household_members where user_id = auth.uid()) then raise exception 'Already in a household'; end if;
  insert into households (name, created_by) values (coalesce(nullif(trim(_home_name),''),'Our Home'), auth.uid()) returning id into hid;
  insert into household_members (household_id, user_id, person) values (hid, auth.uid(), nm);
  insert into child_profiles (household_id, name) values (hid, coalesce(nullif(trim(_child_name),''),'Little one'));
  return hid;
end; $$;

create or replace function public.join_household(_code text, _person text)
returns uuid language plpgsql security definer set search_path = public as $$
declare hid uuid; nm text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  nm := nullif(trim(_person), '');
  if nm is null or char_length(nm) > 40 then raise exception 'Please enter your name'; end if;
  if exists (select 1 from household_members where user_id = auth.uid()) then raise exception 'Already in a household'; end if;
  select id into hid from households where invite_code = upper(trim(_code));
  if hid is null then raise exception 'Invite code not found'; end if;
  if (select count(*) from household_members where household_id = hid) >= 2 then raise exception 'Household is full'; end if;
  if exists (select 1 from household_members where household_id = hid and lower(person) = lower(nm)) then raise exception 'That name is already taken in this household'; end if;
  insert into household_members (household_id, user_id, person) values (hid, auth.uid(), nm);
  return hid;
end; $$;

revoke execute on function public.create_household(text, text, text) from anon, public;
revoke execute on function public.join_household(text, text) from anon, public;
grant execute on function public.create_household(text, text, text) to authenticated;
grant execute on function public.join_household(text, text) to authenticated;