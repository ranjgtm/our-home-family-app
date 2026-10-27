CREATE TABLE public.calendar_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  person text NOT NULL,
  ics_url text NOT NULL,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_feeds TO authenticated;
GRANT ALL ON public.calendar_feeds TO service_role;

ALTER TABLE public.calendar_feeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view calendar feeds" ON public.calendar_feeds
  FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

CREATE POLICY "Members manage own calendar feed" ON public.calendar_feeds
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.is_household_member(household_id))
  WITH CHECK (user_id = auth.uid() AND public.is_household_member(household_id));

CREATE TRIGGER update_calendar_feeds_updated_at
  BEFORE UPDATE ON public.calendar_feeds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();