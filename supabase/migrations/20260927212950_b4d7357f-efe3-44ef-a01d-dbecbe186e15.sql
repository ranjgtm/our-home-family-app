ALTER TABLE public.supermarket_offers
  ADD COLUMN discount_pct integer,
  ADD COLUMN package_size text,
  ADD COLUMN lidl_plus_required boolean NOT NULL DEFAULT false;

CREATE TABLE public.offer_import_runs (
  retailer text PRIMARY KEY,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  status text NOT NULL DEFAULT 'never',
  message text,
  offers_imported integer NOT NULL DEFAULT 0,
  pages_used text[] NOT NULL DEFAULT '{}'
);
GRANT SELECT ON public.offer_import_runs TO authenticated;
GRANT ALL ON public.offer_import_runs TO service_role;
ALTER TABLE public.offer_import_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read import status" ON public.offer_import_runs FOR SELECT TO authenticated USING (true);
INSERT INTO public.offer_import_runs (retailer) VALUES ('Lidl');

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
SELECT cron.schedule('lidl-offers-daily', '0 4 * * *', $$
  SELECT net.http_post(
    url := 'https://your-app.example.com/api/public/import-lidl',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
$$);