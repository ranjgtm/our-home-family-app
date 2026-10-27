CREATE TABLE public.planned_meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  plan_date date NOT NULL,
  slot text NOT NULL DEFAULT 'dinner' CHECK (slot IN ('lunch','dinner')),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  prep_minutes integer,
  at_home text[] NOT NULL DEFAULT '{}',
  missing text[] NOT NULL DEFAULT '{}',
  toddler_note text,
  toddler_friendly boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, plan_date, slot)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planned_meals TO authenticated;
GRANT ALL ON public.planned_meals TO service_role;
ALTER TABLE public.planned_meals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage meals" ON public.planned_meals FOR ALL TO authenticated
  USING (public.is_household_member(household_id)) WITH CHECK (public.is_household_member(household_id));
CREATE TRIGGER planned_meals_updated BEFORE UPDATE ON public.planned_meals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.planned_meals REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.planned_meals;