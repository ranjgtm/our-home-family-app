CREATE TABLE public.supermarket_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer text NOT NULL CHECK (retailer IN ('Lidl','Prisma / S-group','K-Market / K-group')),
  store_location text,
  product_name text NOT NULL,
  normalized_name text NOT NULL,
  category text NOT NULL DEFAULT 'Other' CHECK (category IN ('Fruit & vegetables','Dairy','Meat / fish','Pantry','Household','Other')),
  promo_price numeric NOT NULL,
  normal_price numeric,
  unit_price numeric,
  unit text,
  starts_on date,
  ends_on date NOT NULL,
  source_url text,
  source_type text NOT NULL DEFAULT 'manual',
  external_id text,
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (retailer, external_id)
);
CREATE INDEX supermarket_offers_ends_on_idx ON public.supermarket_offers (ends_on);
GRANT SELECT ON public.supermarket_offers TO authenticated;
GRANT ALL ON public.supermarket_offers TO service_role;
ALTER TABLE public.supermarket_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read offers" ON public.supermarket_offers FOR SELECT TO authenticated USING (true);