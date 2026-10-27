ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS trip_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS expenses_trip_id_key ON public.expenses(trip_id);

CREATE TABLE public.merchant_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  merchant_key text NOT NULL,
  category text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, merchant_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_categories TO authenticated;
GRANT ALL ON public.merchant_categories TO service_role;
ALTER TABLE public.merchant_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage merchant categories" ON public.merchant_categories FOR ALL TO authenticated
  USING (public.is_household_member(household_id)) WITH CHECK (public.is_household_member(household_id));
CREATE TRIGGER t_merchant_upd BEFORE UPDATE ON public.merchant_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();