delete from public.purchased_items where expense_id = '30c36987-cb47-4678-b0fe-6eb7c6976869';
delete from public.expenses where id = '30c36987-cb47-4678-b0fe-6eb7c6976869';
delete from public.pantry_items where household_id = 'ac5f3fbd-d4ca-4bed-bdef-398d8f867380' and name in ('Banana','Milk','Strawberry yogurt','Rye bread','Dish soap') and created_at > now() - interval '1 hour';
update public.shopping_items set status = 'to_buy', purchased_at = null where id = '03b68e04-ad38-4659-982e-00877ee3922d';