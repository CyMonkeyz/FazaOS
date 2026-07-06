-- Realtime and feature polish for Faza OS.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS budget_id uuid REFERENCES public.budgets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS affects_budget boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_transactions_budget ON public.transactions(user_id, budget_id)
  WHERE deleted_at IS NULL;

ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS recurrence text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS recurrence_day integer CHECK (recurrence_day BETWEEN 1 AND 31);

ALTER TABLE public.receivables
  ADD COLUMN IF NOT EXISTS recurrence text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS recurrence_day integer CHECK (recurrence_day BETWEEN 1 AND 31);

ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS recurrence_day integer CHECK (recurrence_day BETWEEN 1 AND 31);

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS resource_url text;

CREATE TABLE IF NOT EXISTS public.business_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount numeric(15,2) NOT NULL CHECK (amount >= 0),
  expense_date date NOT NULL DEFAULT current_date,
  category text,
  vendor text,
  notes text,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_expenses TO authenticated;
GRANT ALL ON public.business_expenses TO service_role;
ALTER TABLE public.business_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own business_expenses" ON public.business_expenses FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_business_expenses_business_date
  ON public.business_expenses(user_id, business_id, expense_date DESC)
  WHERE deleted_at IS NULL;
CREATE TRIGGER trg_business_expenses_updated BEFORE UPDATE ON public.business_expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.workout_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  target_type text NOT NULL DEFAULT 'sessions',
  target_value numeric NOT NULL DEFAULT 0,
  current_value numeric NOT NULL DEFAULT 0,
  period text NOT NULL DEFAULT 'weekly',
  start_date date NOT NULL DEFAULT current_date,
  target_date date,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_goals TO authenticated;
GRANT ALL ON public.workout_goals TO service_role;
ALTER TABLE public.workout_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own workout_goals" ON public.workout_goals FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_workout_goals_user_status ON public.workout_goals(user_id, status)
  WHERE deleted_at IS NULL;
CREATE TRIGGER trg_workout_goals_updated BEFORE UPDATE ON public.workout_goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.workout_routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  workout_type text NOT NULL DEFAULT 'strength',
  weekdays integer[] NOT NULL DEFAULT '{}',
  workout_time time,
  target_duration_minutes integer CHECK (target_duration_minutes IS NULL OR target_duration_minutes >= 0),
  target_intensity text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_routines TO authenticated;
GRANT ALL ON public.workout_routines TO service_role;
ALTER TABLE public.workout_routines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own workout_routines" ON public.workout_routines FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_workout_routines_user_active ON public.workout_routines(user_id, is_active)
  WHERE deleted_at IS NULL;
CREATE TRIGGER trg_workout_routines_updated BEFORE UPDATE ON public.workout_routines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'transactions','budgets','debts','debt_payments','receivables','receivable_payments','bills',
    'assets','investments','investment_price_history','businesses','products','sales',
    'business_expenses','suppliers','academic_tasks','activity_events','courses','organizations',
    'competitions','workout_plans','workout_logs','workout_goals','workout_routines','body_metrics',
    'supplement_items','supplement_logs','daily_logs','weekly_reviews','goals'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = tbl AND relnamespace = 'public'::regnamespace)
      AND NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl
      )
    THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END $$;
