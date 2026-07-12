-- Premium Dark Upgrade: scheduling, account transfers, Sheets snapshots, and unified Sora memory.

ALTER TABLE public.money_accounts
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS transfer_group_id uuid;
CREATE INDEX IF NOT EXISTS idx_transactions_user_account_date
  ON public.transactions(user_id, account_id, date DESC) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.transfer_money(
  p_from_account uuid, p_to_account uuid, p_amount numeric, p_date date DEFAULT ((now() AT TIME ZONE 'Asia/Jakarta')::date), p_note text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_group uuid := gen_random_uuid();
BEGIN
  IF v_user IS NULL OR p_amount <= 0 OR p_from_account = p_to_account THEN RAISE EXCEPTION 'Invalid transfer'; END IF;
  IF (SELECT count(*) FROM public.money_accounts WHERE id IN (p_from_account,p_to_account) AND user_id=v_user AND deleted_at IS NULL AND is_active)=2 THEN
    INSERT INTO public.transactions(user_id,type,amount,date,account_id,note,transfer_group_id)
    VALUES (v_user,'expense',p_amount,p_date,p_from_account,COALESCE(p_note,'Transfer keluar'),v_group),
           (v_user,'income',p_amount,p_date,p_to_account,COALESCE(p_note,'Transfer masuk'),v_group);
    RETURN v_group;
  END IF;
  RAISE EXCEPTION 'Account not found';
END $$;
REVOKE ALL ON FUNCTION public.transfer_money(uuid,uuid,numeric,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_money(uuid,uuid,numeric,date,text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.scheduled_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'telegram' CHECK(channel='telegram'), title text NOT NULL, message text NOT NULL,
  recurrence text NOT NULL CHECK(recurrence IN ('once','daily','weekly','monthly')),
  scheduled_time time NOT NULL, scheduled_date date, weekday integer CHECK(weekday BETWEEN 0 AND 6), month_day integer CHECK(month_day BETWEEN 1 AND 31),
  timezone text NOT NULL DEFAULT 'Asia/Jakarta', next_run_at timestamptz NOT NULL, last_run_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','completed','cancelled')),
  max_attempts integer NOT NULL DEFAULT 4, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_due ON public.scheduled_messages(status,next_run_at) WHERE deleted_at IS NULL;
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own scheduled messages" ON public.scheduled_messages FOR ALL USING(auth.uid()=user_id) WITH CHECK(auth.uid()=user_id);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.scheduled_messages TO authenticated;
GRANT ALL ON public.scheduled_messages TO service_role;

ALTER TABLE public.telegram_jobs ADD COLUMN IF NOT EXISTS scheduled_message_id uuid REFERENCES public.scheduled_messages(id) ON DELETE SET NULL;
ALTER TABLE public.telegram_jobs ADD COLUMN IF NOT EXISTS dedupe_key text;
ALTER TABLE public.telegram_jobs ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_jobs_dedupe ON public.telegram_jobs(dedupe_key) WHERE dedupe_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.sora_profile_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK(category IN ('identity','communication','interest','education','work','project','goal','habit','appearance','other')),
  memory_key text NOT NULL, content text NOT NULL CHECK(char_length(content)<=1000), source_channel text NOT NULL DEFAULT 'web',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
  UNIQUE(user_id,memory_key)
);
CREATE TABLE IF NOT EXISTS public.sora_conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK(channel IN ('web','telegram')), conversation_key text NOT NULL, role text NOT NULL CHECK(role IN ('user','assistant')),
  content text NOT NULL CHECK(char_length(content)<=4000), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sora_conversation_user_recent ON public.sora_conversation_messages(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS public.sora_memory_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_id uuid, action text NOT NULL, before_value jsonb, after_value jsonb, channel text, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sora_profile_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sora_conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sora_memory_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile memories" ON public.sora_profile_memories FOR ALL USING(auth.uid()=user_id) WITH CHECK(auth.uid()=user_id);
CREATE POLICY "own conversation memory" ON public.sora_conversation_messages FOR ALL USING(auth.uid()=user_id) WITH CHECK(auth.uid()=user_id);
CREATE POLICY "read own memory audit" ON public.sora_memory_audit FOR SELECT USING(auth.uid()=user_id);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.sora_profile_memories,public.sora_conversation_messages TO authenticated;
GRANT SELECT ON public.sora_memory_audit TO authenticated;
GRANT ALL ON public.sora_profile_memories,public.sora_conversation_messages,public.sora_memory_audit TO service_role;

CREATE TABLE IF NOT EXISTS public.business_sheet_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE, spreadsheet_id text NOT NULL,
  spreadsheet_url text, folder_id text, template_config jsonb NOT NULL DEFAULT '{"tabs":[]}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','error')), last_sync_at timestamptz, last_error text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,business_id)
);
CREATE TABLE IF NOT EXISTS public.business_sheet_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE, source_hash text NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}', sales jsonb NOT NULL DEFAULT '[]', expenses jsonb NOT NULL DEFAULT '[]',
  products jsonb NOT NULL DEFAULT '[]', stock jsonb NOT NULL DEFAULT '[]', captured_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id,source_hash)
);
CREATE INDEX IF NOT EXISTS idx_business_snapshot_latest ON public.business_sheet_snapshots(user_id,business_id,captured_at DESC);
ALTER TABLE public.business_sheet_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_sheet_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sheet connections" ON public.business_sheet_connections FOR ALL USING(auth.uid()=user_id) WITH CHECK(auth.uid()=user_id);
CREATE POLICY "read own sheet snapshots" ON public.business_sheet_snapshots FOR SELECT USING(auth.uid()=user_id);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.business_sheet_connections TO authenticated;
GRANT SELECT ON public.business_sheet_snapshots TO authenticated;
GRANT ALL ON public.business_sheet_connections,public.business_sheet_snapshots TO service_role;

DROP TRIGGER IF EXISTS trg_scheduled_messages_updated ON public.scheduled_messages;
CREATE TRIGGER trg_scheduled_messages_updated BEFORE UPDATE ON public.scheduled_messages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_sora_profile_memories_updated ON public.sora_profile_memories;
CREATE TRIGGER trg_sora_profile_memories_updated BEFORE UPDATE ON public.sora_profile_memories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_business_sheet_connections_updated ON public.business_sheet_connections;
CREATE TRIGGER trg_business_sheet_connections_updated BEFORE UPDATE ON public.business_sheet_connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$ DECLARE tbl text; BEGIN
  FOREACH tbl IN ARRAY ARRAY['money_accounts','scheduled_messages','sora_profile_memories','business_sheet_connections','business_sheet_snapshots'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=tbl) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',tbl);
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.cleanup_sora_conversations() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer; BEGIN DELETE FROM public.sora_conversation_messages WHERE created_at < now()-interval '90 days'; GET DIAGNOSTICS n=ROW_COUNT; RETURN n; END $$;
REVOKE ALL ON FUNCTION public.cleanup_sora_conversations() FROM PUBLIC,authenticated,anon;
GRANT EXECUTE ON FUNCTION public.cleanup_sora_conversations() TO service_role;

-- Destructive cutover requested by the owner. Business dashboard now uses immutable Sheets snapshots.
DROP TABLE IF EXISTS public.promo_simulations CASCADE;
DROP TABLE IF EXISTS public.hpp_calculations CASCADE;
DROP TABLE IF EXISTS public.business_expenses CASCADE;
DROP TABLE IF EXISTS public.supplier_business_links CASCADE;
DROP TABLE IF EXISTS public.inventory_movements CASCADE;
DROP TABLE IF EXISTS public.inventory_items CASCADE;
DROP TABLE IF EXISTS public.business_reviews CASCADE;
DROP TABLE IF EXISTS public.suppliers CASCADE;
DROP TABLE IF EXISTS public.sales CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
