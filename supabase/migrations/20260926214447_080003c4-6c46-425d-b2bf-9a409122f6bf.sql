revoke execute on function public.is_household_member(uuid) from anon, public;
grant execute on function public.is_household_member(uuid) to authenticated;