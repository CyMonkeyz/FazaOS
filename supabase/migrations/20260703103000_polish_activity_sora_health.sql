-- Extra polish for Activity, Health reminders, and supplement UX.

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS notify_body_weekly boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS body_weekly_reminder_day integer NOT NULL DEFAULT 1 CHECK (body_weekly_reminder_day BETWEEN 0 AND 6),
  ADD COLUMN IF NOT EXISTS body_weekly_reminder_time time NOT NULL DEFAULT '07:30';

ALTER TABLE public.supplement_items
  ADD COLUMN IF NOT EXISTS dose_quantity numeric NOT NULL DEFAULT 1 CHECK (dose_quantity > 0),
  ADD COLUMN IF NOT EXISTS last_taken_at timestamptz;

ALTER TABLE public.workout_goals
  ADD COLUMN IF NOT EXISTS progress_note text;

ALTER TABLE public.academic_tasks
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_academic_tasks_focus
  ON public.academic_tasks(user_id, due_date, status)
  WHERE deleted_at IS NULL;

