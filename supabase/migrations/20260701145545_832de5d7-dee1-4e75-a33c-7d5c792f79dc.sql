
-- Extend user_preferences with per-channel notification flags & quiet hours
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS notify_morning_brief boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_midday_check boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_night_review boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_workout boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_debt_due boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_receivable_due boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_deadline boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_amounts_in_telegram boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS quiet_hours_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS quiet_hours_start time DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS quiet_hours_end time DEFAULT '05:30';

-- Notifications table: unified queue + log with dedupe
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text,
  message text,
  channel text NOT NULL DEFAULT 'telegram',
  scheduled_at timestamptz DEFAULT now(),
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled',
  priority text DEFAULT 'normal',
  dedupe_key text NOT NULL,
  related_table text,
  related_id uuid,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, dedupe_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own notifications" ON public.notifications
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON public.notifications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_dedupe ON public.notifications(user_id, dedupe_key);

CREATE TRIGGER notifications_updated_at BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Telegram message logs (inbound + outbound)
CREATE TABLE IF NOT EXISTS public.telegram_message_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id bigint,
  direction text NOT NULL, -- 'in' | 'out'
  message_text text,
  status text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.telegram_message_logs TO authenticated;
GRANT ALL ON public.telegram_message_logs TO service_role;
ALTER TABLE public.telegram_message_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own tg logs" ON public.telegram_message_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own tg logs insert" ON public.telegram_message_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE INDEX IF NOT EXISTS idx_tg_logs_user ON public.telegram_message_logs(user_id, created_at DESC);
