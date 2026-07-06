
-- 1. Telegram update dedupe
CREATE TABLE IF NOT EXISTS public.telegram_update_dedupes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id text UNIQUE NOT NULL,
  chat_id text,
  received_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.telegram_update_dedupes TO authenticated;
GRANT ALL ON public.telegram_update_dedupes TO service_role;
ALTER TABLE public.telegram_update_dedupes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "svc only dedupe" ON public.telegram_update_dedupes FOR ALL USING (false) WITH CHECK (false);

-- 2. Telegram jobs queue
CREATE TABLE IF NOT EXISTS public.telegram_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id text NOT NULL,
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued',
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_telegram_jobs_status_sched ON public.telegram_jobs(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_telegram_jobs_user ON public.telegram_jobs(user_id);
GRANT SELECT ON public.telegram_jobs TO authenticated;
GRANT ALL ON public.telegram_jobs TO service_role;
ALTER TABLE public.telegram_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user read own jobs" ON public.telegram_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE TRIGGER trg_tj_updated BEFORE UPDATE ON public.telegram_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. telegram_message_logs upgrades
ALTER TABLE public.telegram_message_logs
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'outbound',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS duration_ms int;

-- 4. Sora Telegram sessions
CREATE TABLE IF NOT EXISTS public.sora_telegram_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id text NOT NULL,
  last_intent text,
  pending_action jsonb,
  pending_action_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, chat_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sora_telegram_sessions TO authenticated;
GRANT ALL ON public.sora_telegram_sessions TO service_role;
ALTER TABLE public.sora_telegram_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sora sessions" ON public.sora_telegram_sessions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_sts_updated BEFORE UPDATE ON public.sora_telegram_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Sora action logs
CREATE TABLE IF NOT EXISTS public.sora_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'telegram',
  intent text,
  input_text text,
  parsed_data jsonb,
  confidence numeric,
  action_taken boolean NOT NULL DEFAULT false,
  requires_confirmation boolean NOT NULL DEFAULT false,
  status text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.sora_action_logs TO authenticated;
GRANT ALL ON public.sora_action_logs TO service_role;
ALTER TABLE public.sora_action_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sora logs" ON public.sora_action_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own sora logs ins" ON public.sora_action_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. Notifications dedupe + channel
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'telegram';
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_user_dedupe
  ON public.notifications(user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- 7. User preferences: selected business
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS selected_business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL;

-- 8. Ensure business child tables carry business_id where sensible (add if missing)
ALTER TABLE public.products     ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL;
ALTER TABLE public.sales        ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL;
ALTER TABLE public.suppliers    ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_products_user_biz  ON public.products(user_id, business_id);
CREATE INDEX IF NOT EXISTS idx_sales_user_biz     ON public.sales(user_id, business_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_user_biz ON public.suppliers(user_id, business_id);
