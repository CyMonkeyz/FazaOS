-- Habit tracker, monthly Growth Garden, and server-side Sora confirmation state.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

ALTER TABLE IF EXISTS public.user_preferences
  ADD COLUMN IF NOT EXISTS notify_habits boolean NOT NULL DEFAULT true;

ALTER TABLE IF EXISTS public.sora_action_logs
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS prompt_tokens integer,
  ADD COLUMN IF NOT EXISTS completion_tokens integer,
  ADD COLUMN IF NOT EXISTS duration_ms integer;

CREATE TABLE IF NOT EXISTS public.habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description text,
  icon text NOT NULL DEFAULT 'leaf',
  color text NOT NULL DEFAULT 'emerald',
  weekdays integer[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6]::integer[],
  reminder_enabled boolean NOT NULL DEFAULT false,
  reminder_time time,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (weekdays <@ ARRAY[0,1,2,3,4,5,6]::integer[])
);

CREATE TABLE IF NOT EXISTS public.habit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id uuid NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Jakarta')::date),
  completed_at timestamptz NOT NULL DEFAULT now(),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(habit_id, log_date)
);

CREATE TABLE IF NOT EXISTS public.garden_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  season_month date NOT NULL,
  score integer NOT NULL DEFAULT 0 CHECK (score >= 0),
  stage text NOT NULL DEFAULT 'seed' CHECK (stage IN ('seed','sprout','sapling','leafy','bud','bloom')),
  vitality integer NOT NULL DEFAULT 0 CHECK (vitality BETWEEN 0 AND 100),
  best_streak integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  final_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, season_month),
  CHECK (season_month = date_trunc('month', season_month::timestamp)::date)
);

CREATE TABLE IF NOT EXISTS public.garden_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES public.garden_seasons(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('journal','habit_summary','goal_progress','decay','backfill')),
  source_key text NOT NULL,
  event_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Jakarta')::date),
  points integer NOT NULL CHECK (points BETWEEN -5 AND 5),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, source_type, source_key, event_date)
);

CREATE TABLE IF NOT EXISTS public.sora_pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('web','telegram')),
  conversation_key text NOT NULL DEFAULT 'default',
  action_type text NOT NULL CHECK (action_type IN ('delete_record')),
  target_table text NOT NULL,
  target_id uuid NOT NULL,
  target_label text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  confirmation_step integer NOT NULL DEFAULT 0 CHECK (confirmation_step BETWEEN 0 AND 2),
  challenge text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','cancelled','expired')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sora_pending_active
  ON public.sora_pending_actions(user_id, channel, conversation_key)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_habits_user_active
  ON public.habits(user_id, sort_order, created_at)
  WHERE deleted_at IS NULL AND is_active;

CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date
  ON public.habit_logs(user_id, log_date DESC);

CREATE INDEX IF NOT EXISTS idx_garden_events_user_date
  ON public.garden_events(user_id, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_garden_seasons_user_month
  ON public.garden_seasons(user_id, season_month DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.habits, public.habit_logs TO authenticated;
GRANT SELECT ON public.garden_seasons, public.garden_events, public.sora_pending_actions TO authenticated;
GRANT ALL ON public.habits, public.habit_logs, public.garden_seasons, public.garden_events, public.sora_pending_actions TO service_role;

ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garden_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garden_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sora_pending_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own habits" ON public.habits;
CREATE POLICY "own habits" ON public.habits
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own habit logs" ON public.habit_logs;
CREATE POLICY "own habit logs" ON public.habit_logs
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "read own garden seasons" ON public.garden_seasons;
CREATE POLICY "read own garden seasons" ON public.garden_seasons
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "read own garden events" ON public.garden_events;
CREATE POLICY "read own garden events" ON public.garden_events
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "read own sora pending" ON public.sora_pending_actions;
CREATE POLICY "read own sora pending" ON public.sora_pending_actions
FOR SELECT
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_habits_updated ON public.habits;
CREATE TRIGGER trg_habits_updated
BEFORE UPDATE ON public.habits
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_garden_seasons_updated ON public.garden_seasons;
CREATE TRIGGER trg_garden_seasons_updated
BEFORE UPDATE ON public.garden_seasons
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_garden_events_updated ON public.garden_events;
CREATE TRIGGER trg_garden_events_updated
BEFORE UPDATE ON public.garden_events
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_sora_pending_updated ON public.sora_pending_actions;
CREATE TRIGGER trg_sora_pending_updated
BEFORE UPDATE ON public.sora_pending_actions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.garden_stage(p_score integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_score >= 110 THEN 'bloom'
    WHEN p_score >= 85 THEN 'bud'
    WHEN p_score >= 55 THEN 'leafy'
    WHEN p_score >= 30 THEN 'sapling'
    WHEN p_score >= 12 THEN 'sprout'
    ELSE 'seed'
  END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_garden_season(
  p_user_id uuid,
  p_date date DEFAULT ((now() AT TIME ZONE 'Asia/Jakarta')::date)
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := date_trunc('month', p_date::timestamp)::date;
  v_current_month date := date_trunc('month', (now() AT TIME ZONE 'Asia/Jakarta'))::date;
  v_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Cannot manage another user garden';
  END IF;

  UPDATE public.garden_seasons
  SET
    status = 'archived',
    archived_at = COALESCE(archived_at, now()),
    final_snapshot = jsonb_build_object(
      'score', score,
      'stage', stage,
      'vitality', vitality,
      'best_streak', best_streak
    ),
    updated_at = now()
  WHERE user_id = p_user_id
    AND season_month < v_month
    AND status = 'active';

  INSERT INTO public.garden_seasons(user_id, season_month)
  VALUES (p_user_id, v_month)
  ON CONFLICT (user_id, season_month)
  DO UPDATE SET
    status = CASE
      WHEN EXCLUDED.season_month = v_current_month THEN 'active'
      ELSE public.garden_seasons.status
    END,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_garden_season(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_garden_season(uuid, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.refresh_garden_season(
  p_user_id uuid,
  p_date date DEFAULT ((now() AT TIME ZONE 'Asia/Jakarta')::date)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season uuid;
  v_score integer := 0;
  v_vitality integer := 0;
  v_streak integer := 0;
BEGIN
  v_season := public.ensure_garden_season(p_user_id, p_date);

  SELECT COALESCE(SUM(LEAST(5, daily_points)), 0)::integer
  INTO v_score
  FROM (
    SELECT event_date, SUM(points) AS daily_points
    FROM public.garden_events
    WHERE user_id = p_user_id
      AND season_id = v_season
    GROUP BY event_date
  ) d;

  v_score := GREATEST(0, v_score);

  SELECT LEAST(
    100,
    ROUND(
      COUNT(DISTINCT event_date) FILTER (WHERE points > 0) * 100.0 / 7
    )
  )::integer
  INTO v_vitality
  FROM public.garden_events
  WHERE user_id = p_user_id
    AND event_date BETWEEN p_date - 6 AND p_date;

  WITH daily AS (
    SELECT
      gs.i AS day_offset,
      COALESCE(
        SUM(e.points) FILTER (
          WHERE e.source_type IN ('journal','habit_summary')
        ),
        0
      ) AS points
    FROM generate_series(0, 30) AS gs(i)
    LEFT JOIN public.garden_events e
      ON e.user_id = p_user_id
     AND e.event_date = p_date - gs.i
    GROUP BY gs.i
  )
  SELECT COALESCE(
    MIN(day_offset) FILTER (WHERE points <= 0),
    31
  )::integer
  INTO v_streak
  FROM daily;

  UPDATE public.garden_seasons
  SET
    score = v_score,
    stage = public.garden_stage(v_score),
    vitality = COALESCE(v_vitality, 0),
    best_streak = GREATEST(best_streak, v_streak),
    updated_at = now()
  WHERE id = v_season;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_garden_season(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_garden_season(uuid, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.refresh_habit_garden_day(
  p_user_id uuid,
  p_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season uuid;
  v_due integer := 0;
  v_done integer := 0;
  v_points integer := 0;
  v_current_month date := date_trunc('month', (now() AT TIME ZONE 'Asia/Jakarta'))::date;
BEGIN
  IF date_trunc('month', p_date::timestamp)::date <> v_current_month THEN
    RETURN;
  END IF;

  v_season := public.ensure_garden_season(p_user_id, p_date);

  SELECT COUNT(*)
  INTO v_due
  FROM public.habits
  WHERE user_id = p_user_id
    AND is_active
    AND deleted_at IS NULL
    AND EXTRACT(DOW FROM p_date)::integer = ANY(weekdays);

  SELECT COUNT(*)
  INTO v_done
  FROM public.habit_logs l
  JOIN public.habits h ON h.id = l.habit_id
  WHERE l.user_id = p_user_id
    AND l.log_date = p_date
    AND h.is_active
    AND h.deleted_at IS NULL
    AND EXTRACT(DOW FROM p_date)::integer = ANY(h.weekdays);

  v_points := CASE
    WHEN v_due = 0 OR v_done = 0 THEN 0
    WHEN v_done >= v_due THEN 2
    ELSE 1
  END;

  IF v_points = 0 THEN
    DELETE FROM public.garden_events
    WHERE user_id = p_user_id
      AND source_type = 'habit_summary'
      AND source_key = p_date::text
      AND event_date = p_date;
  ELSE
    INSERT INTO public.garden_events(
      user_id,
      season_id,
      source_type,
      source_key,
      event_date,
      points,
      metadata
    )
    VALUES (
      p_user_id,
      v_season,
      'habit_summary',
      p_date::text,
      p_date,
      v_points,
      jsonb_build_object('completed', v_done, 'scheduled', v_due)
    )
    ON CONFLICT (user_id, source_type, source_key, event_date)
    DO UPDATE SET
      points = EXCLUDED.points,
      metadata = EXCLUDED.metadata,
      updated_at = now();
  END IF;

  PERFORM public.refresh_garden_season(p_user_id, p_date);
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_habit_garden_day(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_habit_garden_day(uuid, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.on_daily_log_garden()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season uuid;
  v_current_month date := date_trunc('month', (now() AT TIME ZONE 'Asia/Jakarta'))::date;
BEGIN
  IF date_trunc('month', NEW.log_date::timestamp)::date <> v_current_month THEN
    RETURN NEW;
  END IF;

  v_season := public.ensure_garden_season(NEW.user_id, NEW.log_date);

  IF NEW.deleted_at IS NULL THEN
    INSERT INTO public.garden_events(
      user_id,
      season_id,
      source_type,
      source_key,
      event_date,
      points
    )
    VALUES (
      NEW.user_id,
      v_season,
      'journal',
      NEW.id::text,
      NEW.log_date,
      2
    )
    ON CONFLICT (user_id, source_type, source_key, event_date)
    DO UPDATE SET
      points = 2,
      updated_at = now();
  ELSE
    DELETE FROM public.garden_events
    WHERE user_id = NEW.user_id
      AND source_type = 'journal'
      AND source_key = NEW.id::text;
  END IF;

  PERFORM public.refresh_garden_season(NEW.user_id, NEW.log_date);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_habit_log_garden()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_log_date date;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
    v_log_date := OLD.log_date;
  ELSE
    v_user_id := NEW.user_id;
    v_log_date := NEW.log_date;
  END IF;

  PERFORM public.refresh_habit_garden_day(v_user_id, v_log_date);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_goal_progress_garden()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date date := ((now() AT TIME ZONE 'Asia/Jakarta')::date);
  v_season uuid;
BEGIN
  IF NEW.deleted_at IS NULL
     AND NEW.progress > COALESCE(OLD.progress, 0)
  THEN
    v_season := public.ensure_garden_season(NEW.user_id, v_date);

    INSERT INTO public.garden_events(
      user_id,
      season_id,
      source_type,
      source_key,
      event_date,
      points,
      metadata
    )
    VALUES (
      NEW.user_id,
      v_season,
      'goal_progress',
      NEW.id::text,
      v_date,
      1,
      jsonb_build_object(
        'from', OLD.progress,
        'to', NEW.progress,
        'title', NEW.title
      )
    )
    ON CONFLICT (user_id, source_type, source_key, event_date)
    DO NOTHING;

    PERFORM public.refresh_garden_season(NEW.user_id, v_date);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_habit_log_garden ON public.habit_logs;
CREATE TRIGGER trg_habit_log_garden
AFTER INSERT OR DELETE ON public.habit_logs
FOR EACH ROW
EXECUTE FUNCTION public.on_habit_log_garden();

DO $$
BEGIN
  IF to_regclass('public.daily_logs') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_daily_log_garden ON public.daily_logs';

    EXECUTE '
      CREATE TRIGGER trg_daily_log_garden
      AFTER INSERT OR UPDATE OF deleted_at ON public.daily_logs
      FOR EACH ROW
      EXECUTE FUNCTION public.on_daily_log_garden()
    ';
  END IF;

  IF to_regclass('public.goals') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_goal_progress_garden ON public.goals';

    EXECUTE '
      CREATE TRIGGER trg_goal_progress_garden
      AFTER UPDATE OF progress ON public.goals
      FOR EACH ROW
      EXECUTE FUNCTION public.on_goal_progress_garden()
    ';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.run_garden_maintenance(
  p_date date DEFAULT ((now() AT TIME ZONE 'Asia/Jakarta')::date - 1)
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_season uuid;
  v_count integer := 0;
  v_sql text;
BEGIN
  v_sql := '
    SELECT DISTINCT user_id FROM public.garden_seasons
    UNION
    SELECT DISTINCT user_id FROM public.habits WHERE deleted_at IS NULL
  ';

  IF to_regclass('public.daily_logs') IS NOT NULL THEN
    v_sql := v_sql || '
      UNION
      SELECT DISTINCT user_id FROM public.daily_logs WHERE deleted_at IS NULL
    ';
  END IF;

  FOR r IN EXECUTE v_sql LOOP
    v_season := public.ensure_garden_season(r.user_id, p_date);

    IF NOT EXISTS (
      SELECT 1
      FROM public.garden_events
      WHERE user_id = r.user_id
        AND event_date = p_date
        AND source_type IN ('journal','habit_summary')
        AND points > 0
    ) THEN
      INSERT INTO public.garden_events(
        user_id,
        season_id,
        source_type,
        source_key,
        event_date,
        points
      )
      VALUES (
        r.user_id,
        v_season,
        'decay',
        p_date::text,
        p_date,
        -3
      )
      ON CONFLICT (user_id, source_type, source_key, event_date)
      DO NOTHING;

      IF FOUND THEN
        v_count := v_count + 1;
      END IF;
    END IF;

    PERFORM public.refresh_garden_season(r.user_id, p_date);
    PERFORM public.ensure_garden_season(
      r.user_id,
      ((now() AT TIME ZONE 'Asia/Jakarta')::date)
    );
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.run_garden_maintenance(date) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.run_garden_maintenance(date) TO service_role;

-- Backfill current-month journals and goal progress, if source tables exist.
DO $$
DECLARE
  v_month date := date_trunc('month', (now() AT TIME ZONE 'Asia/Jakarta'))::date;
  r record;
BEGIN
  IF to_regclass('public.daily_logs') IS NOT NULL THEN
    INSERT INTO public.garden_seasons(user_id, season_month)
    SELECT DISTINCT user_id, v_month
    FROM public.daily_logs
    WHERE deleted_at IS NULL
    ON CONFLICT (user_id, season_month)
    DO NOTHING;

    INSERT INTO public.garden_events(
      user_id,
      season_id,
      source_type,
      source_key,
      event_date,
      points,
      metadata
    )
    SELECT
      d.user_id,
      s.id,
      'journal',
      d.id::text,
      d.log_date,
      2,
      jsonb_build_object('backfilled', true)
    FROM public.daily_logs d
    JOIN public.garden_seasons s
      ON s.user_id = d.user_id
     AND s.season_month = date_trunc('month', d.log_date::timestamp)::date
    WHERE d.deleted_at IS NULL
      AND d.log_date >= v_month
    ON CONFLICT (user_id, source_type, source_key, event_date)
    DO NOTHING;
  END IF;

  IF to_regclass('public.goals') IS NOT NULL THEN
    INSERT INTO public.garden_seasons(user_id, season_month)
    SELECT DISTINCT user_id, v_month
    FROM public.goals
    WHERE deleted_at IS NULL
      AND progress > 0
    ON CONFLICT (user_id, season_month)
    DO NOTHING;

    INSERT INTO public.garden_events(
      user_id,
      season_id,
      source_type,
      source_key,
      event_date,
      points,
      metadata
    )
    SELECT
      g.user_id,
      s.id,
      'goal_progress',
      g.id::text,
      GREATEST(g.updated_at::date, s.season_month),
      1,
      jsonb_build_object(
        'backfilled', true,
        'progress', g.progress
      )
    FROM public.goals g
    JOIN public.garden_seasons s
      ON s.user_id = g.user_id
     AND s.season_month = v_month
    WHERE g.deleted_at IS NULL
      AND g.progress > 0
      AND g.updated_at >= v_month
    ON CONFLICT (user_id, source_type, source_key, event_date)
    DO NOTHING;
  END IF;

  FOR r IN SELECT DISTINCT user_id FROM public.garden_seasons LOOP
    PERFORM public.refresh_garden_season(
      r.user_id,
      ((now() AT TIME ZONE 'Asia/Jakarta')::date)
    );
  END LOOP;
END $$;

DO $$
DECLARE
  tbl text;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    FOREACH tbl IN ARRAY ARRAY[
      'habits',
      'habit_logs',
      'garden_seasons',
      'garden_events',
      'sora_pending_actions'
    ]
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = tbl
      ) THEN
        EXECUTE format(
          'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
          tbl
        );
      END IF;
    END LOOP;
  END IF;
END $$;