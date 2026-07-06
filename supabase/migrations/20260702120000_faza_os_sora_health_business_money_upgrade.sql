-- Faza OS integrated Sora/Health/Business/Money upgrade.

-- Budget envelope improvements
ALTER TYPE public.budget_period ADD VALUE IF NOT EXISTS 'custom';

ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_budgets_user_status ON public.budgets(user_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_budgets_user_dates ON public.budgets(user_id, start_date, end_date) WHERE deleted_at IS NULL;

-- Business ownership hardening and advanced tables
INSERT INTO public.businesses (user_id, name, description)
SELECT DISTINCT user_id, 'Bisnis Utama', 'Dibuat otomatis untuk data lama'
FROM (
  SELECT user_id FROM public.products WHERE business_id IS NULL AND deleted_at IS NULL
  UNION
  SELECT user_id FROM public.sales WHERE business_id IS NULL AND deleted_at IS NULL
) orphan
WHERE NOT EXISTS (
  SELECT 1 FROM public.businesses b
  WHERE b.user_id = orphan.user_id AND b.name = 'Bisnis Utama' AND b.deleted_at IS NULL
);

UPDATE public.products p
SET business_id = b.id
FROM public.businesses b
WHERE p.business_id IS NULL
  AND p.user_id = b.user_id
  AND b.name = 'Bisnis Utama'
  AND p.deleted_at IS NULL;

UPDATE public.sales s
SET business_id = b.id
FROM public.businesses b
WHERE s.business_id IS NULL
  AND s.user_id = b.user_id
  AND b.name = 'Bisnis Utama'
  AND s.deleted_at IS NULL;

ALTER TABLE public.products ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.sales ALTER COLUMN business_id SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.hpp_calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name text,
  bahan_cost numeric(15,2) NOT NULL DEFAULT 0 CHECK (bahan_cost >= 0),
  kemasan_cost numeric(15,2) NOT NULL DEFAULT 0 CHECK (kemasan_cost >= 0),
  tenaga_cost numeric(15,2) NOT NULL DEFAULT 0 CHECK (tenaga_cost >= 0),
  overhead_cost numeric(15,2) NOT NULL DEFAULT 0 CHECK (overhead_cost >= 0),
  total_cost numeric(15,2) NOT NULL DEFAULT 0 CHECK (total_cost >= 0),
  yield_portion numeric(12,2) NOT NULL CHECK (yield_portion > 0),
  hpp_per_unit numeric(15,2) NOT NULL DEFAULT 0 CHECK (hpp_per_unit >= 0),
  margin_percent numeric(8,2) DEFAULT 0,
  suggested_price numeric(15,2) DEFAULT 0 CHECK (suggested_price >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hpp_calculations TO authenticated;
GRANT ALL ON public.hpp_calculations TO service_role;
ALTER TABLE public.hpp_calculations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own hpp_calculations" ON public.hpp_calculations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_hpp_user_business ON public.hpp_calculations(user_id, business_id);
CREATE TRIGGER trg_hpp_calculations_updated BEFORE UPDATE ON public.hpp_calculations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.promo_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name text,
  normal_price numeric(15,2) NOT NULL DEFAULT 0 CHECK (normal_price >= 0),
  hpp_per_unit numeric(15,2) NOT NULL DEFAULT 0 CHECK (hpp_per_unit >= 0),
  discount_percent numeric(8,2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0),
  promo_price numeric(15,2) NOT NULL DEFAULT 0 CHECK (promo_price >= 0),
  normal_units numeric(12,2) NOT NULL DEFAULT 0 CHECK (normal_units >= 0),
  target_units numeric(12,2) NOT NULL DEFAULT 0 CHECK (target_units >= 0),
  expected_profit numeric(15,2) NOT NULL DEFAULT 0,
  break_even_units numeric(12,2),
  result_status text NOT NULL DEFAULT 'break_even',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_simulations TO authenticated;
GRANT ALL ON public.promo_simulations TO service_role;
ALTER TABLE public.promo_simulations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own promo_simulations" ON public.promo_simulations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_promo_user_business ON public.promo_simulations(user_id, business_id);
CREATE TRIGGER trg_promo_simulations_updated BEFORE UPDATE ON public.promo_simulations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name text NOT NULL,
  quantity numeric(14,3) NOT NULL DEFAULT 0,
  unit text,
  low_stock_threshold numeric(14,3) NOT NULL DEFAULT 0,
  unit_cost numeric(15,2) DEFAULT 0 CHECK (unit_cost >= 0),
  expires_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own inventory_items" ON public.inventory_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_user_business ON public.inventory_items(user_id, business_id);
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON public.inventory_items(user_id, business_id, quantity, low_stock_threshold);
CREATE INDEX IF NOT EXISTS idx_inventory_expiry ON public.inventory_items(user_id, expires_at);
CREATE TRIGGER trg_inventory_items_updated BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  movement_type text NOT NULL,
  quantity numeric(14,3) NOT NULL,
  unit_cost numeric(15,2),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_movements TO authenticated;
GRANT ALL ON public.inventory_movements TO service_role;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own inventory_movements" ON public.inventory_movements FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_item ON public.inventory_movements(inventory_item_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_business ON public.inventory_movements(user_id, business_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.supplier_business_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, supplier_id, business_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_business_links TO authenticated;
GRANT ALL ON public.supplier_business_links TO service_role;
ALTER TABLE public.supplier_business_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own supplier_business_links" ON public.supplier_business_links FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_supplier_links_business ON public.supplier_business_links(user_id, business_id);

CREATE TABLE IF NOT EXISTS public.business_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  review_date date NOT NULL DEFAULT current_date,
  revenue numeric(15,2) DEFAULT 0,
  profit numeric(15,2) DEFAULT 0,
  score integer CHECK (score BETWEEN 1 AND 5),
  highlights text,
  issues text,
  next_actions text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_reviews TO authenticated;
GRANT ALL ON public.business_reviews TO service_role;
ALTER TABLE public.business_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own business_reviews" ON public.business_reviews FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_business_reviews_business ON public.business_reviews(user_id, business_id, review_date DESC);
CREATE TRIGGER trg_business_reviews_updated BEFORE UPDATE ON public.business_reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Health advanced tables
CREATE TABLE IF NOT EXISTS public.supplement_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  dosage text,
  frequency text,
  stock_quantity numeric DEFAULT 0,
  unit text,
  low_stock_threshold numeric DEFAULT 0,
  price_per_unit numeric DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplement_items TO authenticated;
GRANT ALL ON public.supplement_items TO service_role;
ALTER TABLE public.supplement_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own supplement_items" ON public.supplement_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_supplement_items_user ON public.supplement_items(user_id);
CREATE TRIGGER trg_supplement_items_updated BEFORE UPDATE ON public.supplement_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.supplement_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplement_id uuid REFERENCES public.supplement_items(id) ON DELETE SET NULL,
  taken_at timestamptz DEFAULT now(),
  quantity numeric DEFAULT 1,
  notes text,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplement_logs TO authenticated;
GRANT ALL ON public.supplement_logs TO service_role;
ALTER TABLE public.supplement_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own supplement_logs" ON public.supplement_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_supplement_logs_user_taken ON public.supplement_logs(user_id, taken_at DESC);

CREATE TABLE IF NOT EXISTS public.supplement_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplement_id uuid REFERENCES public.supplement_items(id) ON DELETE SET NULL,
  purchase_date date DEFAULT current_date,
  amount numeric NOT NULL CHECK(amount >= 0),
  quantity numeric DEFAULT 1,
  store text,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplement_purchases TO authenticated;
GRANT ALL ON public.supplement_purchases TO service_role;
ALTER TABLE public.supplement_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own supplement_purchases" ON public.supplement_purchases FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_supplement_purchases_user_date ON public.supplement_purchases(user_id, purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_supplement_purchases_transaction ON public.supplement_purchases(transaction_id);

CREATE TABLE IF NOT EXISTS public.recovery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT current_date,
  soreness integer CHECK (soreness BETWEEN 1 AND 5),
  stress integer CHECK (stress BETWEEN 1 AND 5),
  energy integer CHECK (energy BETWEEN 1 AND 5),
  sleep_quality integer CHECK (sleep_quality BETWEEN 1 AND 5),
  recovery_score integer CHECK (recovery_score BETWEEN 0 AND 100),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE(user_id, log_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recovery_logs TO authenticated;
GRANT ALL ON public.recovery_logs TO service_role;
ALTER TABLE public.recovery_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own recovery_logs" ON public.recovery_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_recovery_logs_user_date ON public.recovery_logs(user_id, log_date DESC);
CREATE TRIGGER trg_recovery_logs_updated BEFORE UPDATE ON public.recovery_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Investment auto price support
ALTER TABLE public.investments
  ADD COLUMN IF NOT EXISTS provider_symbol text,
  ADD COLUMN IF NOT EXISTS exchange text,
  ADD COLUMN IF NOT EXISTS auto_update_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS price_provider text NOT NULL DEFAULT 'alpha_vantage',
  ADD COLUMN IF NOT EXISTS last_price_error text;

CREATE INDEX IF NOT EXISTS idx_investments_auto_update ON public.investments(user_id, auto_update_enabled, ticker) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_investments_ticker ON public.investments(ticker);

CREATE TABLE IF NOT EXISTS public.investment_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investment_id uuid NOT NULL REFERENCES public.investments(id) ON DELETE CASCADE,
  ticker text,
  provider text NOT NULL,
  price numeric(20,6) NOT NULL,
  currency text DEFAULT 'IDR',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investment_price_history TO authenticated;
GRANT ALL ON public.investment_price_history TO service_role;
ALTER TABLE public.investment_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own investment_price_history" ON public.investment_price_history FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_price_history_investment ON public.investment_price_history(investment_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_ticker ON public.investment_price_history(ticker, fetched_at DESC);

CREATE TABLE IF NOT EXISTS public.investment_price_update_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  investment_id uuid REFERENCES public.investments(id) ON DELETE SET NULL,
  provider text NOT NULL,
  status text NOT NULL,
  old_price numeric(20,6),
  new_price numeric(20,6),
  error_message text,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investment_price_update_logs TO authenticated;
GRANT ALL ON public.investment_price_update_logs TO service_role;
ALTER TABLE public.investment_price_update_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own investment_price_update_logs" ON public.investment_price_update_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own investment_price_update_logs_insert" ON public.investment_price_update_logs FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE INDEX IF NOT EXISTS idx_price_update_logs_user ON public.investment_price_update_logs(user_id, fetched_at DESC);

-- Google Sheets Money sync metadata
CREATE TABLE IF NOT EXISTS public.google_sheets_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spreadsheet_id text,
  spreadsheet_url text,
  status text NOT NULL DEFAULT 'not_configured',
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE(user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_sheets_connections TO authenticated;
GRANT ALL ON public.google_sheets_connections TO service_role;
ALTER TABLE public.google_sheets_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own google_sheets_connections" ON public.google_sheets_connections FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_google_sheets_connections_user_status ON public.google_sheets_connections(user_id, status);
CREATE TRIGGER trg_google_sheets_connections_updated BEFORE UPDATE ON public.google_sheets_connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.google_sheets_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  table_name text NOT NULL,
  sheet_name text NOT NULL,
  source_id uuid,
  status text NOT NULL,
  action text,
  row_number integer,
  error_message text,
  synced_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_sheets_sync_logs TO authenticated;
GRANT ALL ON public.google_sheets_sync_logs TO service_role;
ALTER TABLE public.google_sheets_sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own google_sheets_sync_logs" ON public.google_sheets_sync_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_google_sheets_sync_logs_user ON public.google_sheets_sync_logs(user_id, synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_google_sheets_sync_source ON public.google_sheets_sync_logs(user_id, table_name, source_id);

-- Review advanced and retention
CREATE TABLE IF NOT EXISTS public.monthly_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_start date NOT NULL,
  highlights text,
  lessons text,
  next_month_focus text,
  score integer CHECK (score BETWEEN 1 AND 5),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE(user_id, month_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_reviews TO authenticated;
GRANT ALL ON public.monthly_reviews TO service_role;
ALTER TABLE public.monthly_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own monthly_reviews" ON public.monthly_reviews FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_reviews_user_month ON public.monthly_reviews(user_id, month_start DESC);
CREATE TRIGGER trg_monthly_reviews_updated BEFORE UPDATE ON public.monthly_reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.journal_retention_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  table_name text NOT NULL,
  deleted_count integer NOT NULL DEFAULT 0,
  ran_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.journal_retention_logs TO authenticated;
GRANT ALL ON public.journal_retention_logs TO service_role;
ALTER TABLE public.journal_retention_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own journal_retention_logs" ON public.journal_retention_logs FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.enforce_journal_retention(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  daily_deleted integer := 0;
  weekly_deleted integer := 0;
BEGIN
  WITH old_daily AS (
    SELECT id
    FROM (
      SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY log_date DESC, created_at DESC) AS rn
      FROM public.daily_logs
      WHERE user_id = _user_id
    ) ranked
    WHERE rn > 7
  ),
  deleted AS (
    DELETE FROM public.daily_logs d
    USING old_daily od
    WHERE d.id = od.id
    RETURNING d.id
  )
  SELECT count(*) INTO daily_deleted FROM deleted;

  WITH old_weekly AS (
    SELECT id
    FROM (
      SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY week_start DESC, created_at DESC) AS rn
      FROM public.weekly_reviews
      WHERE user_id = _user_id
    ) ranked
    WHERE rn > 4
  ),
  deleted AS (
    DELETE FROM public.weekly_reviews w
    USING old_weekly ow
    WHERE w.id = ow.id
    RETURNING w.id
  )
  SELECT count(*) INTO weekly_deleted FROM deleted;

  IF daily_deleted > 0 THEN
    INSERT INTO public.journal_retention_logs(user_id, table_name, deleted_count)
    VALUES (_user_id, 'daily_logs', daily_deleted);
  END IF;
  IF weekly_deleted > 0 THEN
    INSERT INTO public.journal_retention_logs(user_id, table_name, deleted_count)
    VALUES (_user_id, 'weekly_reviews', weekly_deleted);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_journal_retention_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enforce_journal_retention(NEW.user_id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_daily_logs_retention ON public.daily_logs;
CREATE TRIGGER trg_daily_logs_retention
  AFTER INSERT OR UPDATE ON public.daily_logs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_journal_retention_trigger();

DROP TRIGGER IF EXISTS trg_weekly_reviews_retention ON public.weekly_reviews;
CREATE TRIGGER trg_weekly_reviews_retention
  AFTER INSERT OR UPDATE ON public.weekly_reviews
  FOR EACH ROW EXECUTE FUNCTION public.enforce_journal_retention_trigger();

CREATE OR REPLACE FUNCTION public.cleanup_journal_retention()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
BEGIN
  FOR uid IN
    SELECT DISTINCT user_id FROM public.daily_logs
    UNION
    SELECT DISTINCT user_id FROM public.weekly_reviews
  LOOP
    PERFORM public.enforce_journal_retention(uid);
  END LOOP;
END $$;

-- Notification type indexes; notifications remain Telegram-only through channel.
CREATE INDEX IF NOT EXISTS idx_notifications_user_type_status ON public.notifications(user_id, type, status);
CREATE INDEX IF NOT EXISTS idx_notifications_channel ON public.notifications(channel);

REVOKE EXECUTE ON FUNCTION public.enforce_journal_retention(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_journal_retention_trigger() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_journal_retention() FROM public, anon, authenticated;
