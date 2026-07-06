
-- BUSINESSES
CREATE TABLE public.businesses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT ALL ON public.businesses TO service_role;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own businesses" ON public.businesses FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_businesses_updated BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add business_id to products / sales / suppliers
ALTER TABLE public.products ADD COLUMN business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL;
ALTER TABLE public.sales ADD COLUMN business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL;
ALTER TABLE public.suppliers ADD COLUMN business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL;

-- Backfill: create a "Bisnis Utama" per user that already has products/sales/suppliers
INSERT INTO public.businesses (user_id, name, description)
SELECT DISTINCT user_id, 'Bisnis Utama', 'Dibuat otomatis'
FROM (
  SELECT user_id FROM public.products WHERE deleted_at IS NULL
  UNION SELECT user_id FROM public.sales WHERE deleted_at IS NULL
  UNION SELECT user_id FROM public.suppliers WHERE deleted_at IS NULL
) u
ON CONFLICT DO NOTHING;

UPDATE public.products p SET business_id = b.id
  FROM public.businesses b
  WHERE b.user_id = p.user_id AND b.name = 'Bisnis Utama' AND p.business_id IS NULL;
UPDATE public.sales s SET business_id = b.id
  FROM public.businesses b
  WHERE b.user_id = s.user_id AND b.name = 'Bisnis Utama' AND s.business_id IS NULL;
UPDATE public.suppliers su SET business_id = b.id
  FROM public.businesses b
  WHERE b.user_id = su.user_id AND b.name = 'Bisnis Utama' AND su.business_id IS NULL;

CREATE INDEX idx_products_business ON public.products(business_id);
CREATE INDEX idx_sales_business ON public.sales(business_id);
CREATE INDEX idx_suppliers_business ON public.suppliers(business_id);

-- INVESTMENTS
DO $$ BEGIN
  CREATE TYPE public.investment_type AS ENUM ('saham','crypto','obligasi','reksadana','p2p','emas','deposito','forex','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.investments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.investment_type NOT NULL DEFAULT 'saham',
  ticker TEXT,
  name TEXT NOT NULL,
  quantity NUMERIC(20,8) NOT NULL DEFAULT 0,
  avg_buy_price NUMERIC(20,4) NOT NULL DEFAULT 0,
  current_price NUMERIC(20,4) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'IDR',
  notes TEXT,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investments TO authenticated;
GRANT ALL ON public.investments TO service_role;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own investments" ON public.investments FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_investments_updated BEFORE UPDATE ON public.investments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_investments_user ON public.investments(user_id);
