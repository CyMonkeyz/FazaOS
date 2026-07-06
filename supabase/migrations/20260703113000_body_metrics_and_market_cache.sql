-- Body analytics and safer market-data caching.

ALTER TABLE public.body_metrics
  ADD COLUMN IF NOT EXISTS height_cm numeric(6,2) CHECK (height_cm IS NULL OR height_cm > 0),
  ADD COLUMN IF NOT EXISTS body_goal text,
  ADD COLUMN IF NOT EXISTS vo2_max numeric(6,2) CHECK (vo2_max IS NULL OR vo2_max > 0);

ALTER TABLE public.investment_price_history
  ADD COLUMN IF NOT EXISTS stale boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS note text;

