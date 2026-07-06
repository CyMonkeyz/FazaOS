
-- ============ workout_plans ============
CREATE TABLE public.workout_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  workout_date date NOT NULL,
  workout_time time NULL,
  workout_type text NOT NULL,
  target_duration_minutes integer CHECK (target_duration_minutes >= 0),
  target_intensity text,
  notes text,
  status text NOT NULL DEFAULT 'planned',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_plans TO authenticated;
GRANT ALL ON public.workout_plans TO service_role;
ALTER TABLE public.workout_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own workout_plans" ON public.workout_plans FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_workout_plans_user_date ON public.workout_plans(user_id, workout_date);
CREATE TRIGGER trg_workout_plans_updated BEFORE UPDATE ON public.workout_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ workout_logs ============
CREATE TABLE public.workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_plan_id uuid REFERENCES public.workout_plans(id) ON DELETE SET NULL,
  workout_date date NOT NULL DEFAULT current_date,
  workout_type text NOT NULL,
  duration_minutes integer CHECK (duration_minutes >= 0),
  intensity text,
  calories_estimated integer CHECK (calories_estimated >= 0),
  mood_before integer CHECK (mood_before BETWEEN 1 AND 5),
  mood_after integer CHECK (mood_after BETWEEN 1 AND 5),
  energy_before integer CHECK (energy_before BETWEEN 1 AND 5),
  energy_after integer CHECK (energy_after BETWEEN 1 AND 5),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_logs TO authenticated;
GRANT ALL ON public.workout_logs TO service_role;
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own workout_logs" ON public.workout_logs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_workout_logs_user_date ON public.workout_logs(user_id, workout_date);
CREATE TRIGGER trg_workout_logs_updated BEFORE UPDATE ON public.workout_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ exercise_library ============
CREATE TABLE public.exercise_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  muscle_group text,
  equipment text,
  default_sets integer CHECK (default_sets >= 0),
  default_reps integer CHECK (default_reps >= 0),
  default_duration_seconds integer CHECK (default_duration_seconds >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercise_library TO authenticated;
GRANT ALL ON public.exercise_library TO service_role;
ALTER TABLE public.exercise_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own exercise_library" ON public.exercise_library FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_exercise_library_user_name ON public.exercise_library(user_id, name);
CREATE TRIGGER trg_exercise_library_updated BEFORE UPDATE ON public.exercise_library
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ workout_sets ============
CREATE TABLE public.workout_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_log_id uuid NOT NULL REFERENCES public.workout_logs(id) ON DELETE CASCADE,
  exercise_id uuid REFERENCES public.exercise_library(id) ON DELETE SET NULL,
  set_number integer NOT NULL CHECK (set_number >= 1),
  reps integer CHECK (reps >= 0),
  weight numeric(10,2) CHECK (weight >= 0),
  duration_seconds integer CHECK (duration_seconds >= 0),
  distance_km numeric(10,2) CHECK (distance_km >= 0),
  rest_seconds integer CHECK (rest_seconds >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_sets TO authenticated;
GRANT ALL ON public.workout_sets TO service_role;
ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own workout_sets" ON public.workout_sets FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_workout_sets_user_log ON public.workout_sets(user_id, workout_log_id);
CREATE TRIGGER trg_workout_sets_updated BEFORE UPDATE ON public.workout_sets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ body_metrics ============
CREATE TABLE public.body_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_date date NOT NULL DEFAULT current_date,
  weight_kg numeric(6,2) CHECK (weight_kg >= 0),
  body_fat_percentage numeric(5,2) CHECK (body_fat_percentage >= 0),
  waist_cm numeric(6,2) CHECK (waist_cm >= 0),
  chest_cm numeric(6,2) CHECK (chest_cm >= 0),
  arm_cm numeric(6,2) CHECK (arm_cm >= 0),
  thigh_cm numeric(6,2) CHECK (thigh_cm >= 0),
  sleep_hours numeric(4,2) CHECK (sleep_hours >= 0),
  sleep_quality integer CHECK (sleep_quality BETWEEN 1 AND 5),
  water_liters numeric(4,2) CHECK (water_liters >= 0),
  steps integer CHECK (steps >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE(user_id, metric_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_metrics TO authenticated;
GRANT ALL ON public.body_metrics TO service_role;
ALTER TABLE public.body_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own body_metrics" ON public.body_metrics FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_body_metrics_user_date ON public.body_metrics(user_id, metric_date);
CREATE TRIGGER trg_body_metrics_updated BEFORE UPDATE ON public.body_metrics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
