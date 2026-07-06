
ALTER TABLE public.activity_events
  ADD COLUMN IF NOT EXISTS gcal_event_id text,
  ADD COLUMN IF NOT EXISTS gcal_synced_at timestamptz;

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS notify_daily_digest boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_bill_due boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_task_due boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.telegram_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id bigint UNIQUE,
  link_code text UNIQUE,
  link_code_expires_at timestamptz,
  linked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_users TO authenticated;
GRANT ALL ON public.telegram_users TO service_role;

ALTER TABLE public.telegram_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own telegram link"
  ON public.telegram_users
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER telegram_users_set_updated_at
  BEFORE UPDATE ON public.telegram_users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS telegram_users_chat_id_idx ON public.telegram_users(chat_id);
CREATE INDEX IF NOT EXISTS telegram_users_link_code_idx ON public.telegram_users(link_code);
