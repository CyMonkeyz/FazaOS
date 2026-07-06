
-- ============ ACTIVITY ============
CREATE TYPE public.task_status AS ENUM ('todo','in_progress','done','revision');
CREATE TYPE public.task_priority AS ENUM ('low','medium','high','urgent');
CREATE TYPE public.event_kind AS ENUM ('class','meeting','deadline','personal','other');

CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  lecturer TEXT,
  sks INTEGER DEFAULT 0,
  semester TEXT,
  color TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own courses" ON public.courses FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER trg_courses_upd BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.academic_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status public.task_status NOT NULL DEFAULT 'todo',
  priority public.task_priority NOT NULL DEFAULT 'medium',
  due_date DATE,
  estimate_minutes INTEGER,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_tasks TO authenticated;
GRANT ALL ON public.academic_tasks TO service_role;
ALTER TABLE public.academic_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own academic_tasks" ON public.academic_tasks FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER trg_academic_tasks_upd BEFORE UPDATE ON public.academic_tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_academic_tasks_user_due ON public.academic_tasks(user_id, due_date) WHERE deleted_at IS NULL;

CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  kind TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  started_on DATE,
  ended_on DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own organizations" ON public.organizations FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER trg_organizations_upd BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.org_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  location TEXT,
  agenda TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_meetings TO authenticated;
GRANT ALL ON public.org_meetings TO service_role;
ALTER TABLE public.org_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own org_meetings" ON public.org_meetings FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER trg_org_meetings_upd BEFORE UPDATE ON public.org_meetings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind public.event_kind NOT NULL DEFAULT 'other',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_events TO authenticated;
GRANT ALL ON public.activity_events TO service_role;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own activity_events" ON public.activity_events FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER trg_activity_events_upd BEFORE UPDATE ON public.activity_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_activity_events_user_start ON public.activity_events(user_id, starts_at) WHERE deleted_at IS NULL;

CREATE TABLE public.competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  organizer TEXT,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  registration_deadline DATE,
  event_date DATE,
  result TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitions TO authenticated;
GRANT ALL ON public.competitions TO service_role;
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own competitions" ON public.competitions FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER trg_competitions_upd BEFORE UPDATE ON public.competitions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.portfolio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT,
  role TEXT,
  link TEXT,
  description TEXT,
  date_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_items TO authenticated;
GRANT ALL ON public.portfolio_items TO service_role;
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own portfolio_items" ON public.portfolio_items FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER trg_portfolio_items_upd BEFORE UPDATE ON public.portfolio_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ BUSINESS ============
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own suppliers" ON public.suppliers FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER trg_suppliers_upd BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  hpp NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (hpp >= 0),
  price NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own products" ON public.products FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER trg_products_upd BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(15,2) NOT NULL CHECK (unit_price >= 0),
  unit_hpp NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (unit_hpp >= 0),
  total NUMERIC(15,2) NOT NULL,
  profit NUMERIC(15,2) NOT NULL DEFAULT 0,
  channel TEXT,
  sold_at DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sales" ON public.sales FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER trg_sales_upd BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_sales_user_date ON public.sales(user_id, sold_at DESC) WHERE deleted_at IS NULL;

-- ============ REVIEW ============
CREATE TABLE public.daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  mood INTEGER CHECK (mood BETWEEN 1 AND 5),
  energy INTEGER CHECK (energy BETWEEN 1 AND 5),
  focus INTEGER CHECK (focus BETWEEN 1 AND 5),
  wins TEXT,
  struggles TEXT,
  gratitude TEXT,
  tomorrow_focus TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(user_id, log_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_logs TO authenticated;
GRANT ALL ON public.daily_logs TO service_role;
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own daily_logs" ON public.daily_logs FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER trg_daily_logs_upd BEFORE UPDATE ON public.daily_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.weekly_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  week_start DATE NOT NULL,
  highlights TEXT,
  lessons TEXT,
  next_week_focus TEXT,
  score_money INTEGER CHECK (score_money BETWEEN 1 AND 5),
  score_academic INTEGER CHECK (score_academic BETWEEN 1 AND 5),
  score_organization INTEGER CHECK (score_organization BETWEEN 1 AND 5),
  score_business INTEGER CHECK (score_business BETWEEN 1 AND 5),
  score_health INTEGER CHECK (score_health BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(user_id, week_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_reviews TO authenticated;
GRANT ALL ON public.weekly_reviews TO service_role;
ALTER TABLE public.weekly_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own weekly_reviews" ON public.weekly_reviews FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER trg_weekly_reviews_upd BEFORE UPDATE ON public.weekly_reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  area TEXT,
  target_date DATE,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own goals" ON public.goals FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER trg_goals_upd BEFORE UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
