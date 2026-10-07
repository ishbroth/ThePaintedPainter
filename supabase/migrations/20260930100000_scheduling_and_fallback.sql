-- Dates, availability, declines and the "next best painters" fallback.
--
-- Painters
--   leads_paused / paused_until / blackout_dates: how a painter says "I'm booked".
--     * paused with no date          -> hidden from every search
--     * paused until a date and/or blackout date ranges -> still listed, but only
--       for customers whose dates fit (flexible customers see "available from ...")
--
-- Jobs (quote_selections)
--   customer_start_date / customer_end_date / dates_flexible / timeline: what the
--     customer told the chat about timing (previously only a coarse bucket, unused)
--   estimated_days: working days the job should take, so a painter's dates can be
--     sanity-checked
--   painter_availability / date_state / customer_counter / scheduled_end_date: the
--     dates conversation after a painter accepts (exact windows or "flexible around
--     a date"; customer accepts, picks a start inside a flexible window, or counters)
--   declined_painters + fallback_*: when a painter declines, the customer gets the
--     next three matches by email; the links and suggestions expire after 72 hours
--   resume_state: the saved estimate so "load my search results again" works

ALTER TABLE painters
  ADD COLUMN IF NOT EXISTS leads_paused BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS paused_until DATE,
  ADD COLUMN IF NOT EXISTS blackout_dates JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE quote_selections
  ADD COLUMN IF NOT EXISTS customer_start_date DATE,
  ADD COLUMN IF NOT EXISTS customer_end_date DATE,
  ADD COLUMN IF NOT EXISTS dates_flexible BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS timeline TEXT,
  ADD COLUMN IF NOT EXISTS estimated_days INTEGER,
  ADD COLUMN IF NOT EXISTS resume_state JSONB,
  ADD COLUMN IF NOT EXISTS painter_availability JSONB,
  ADD COLUMN IF NOT EXISTS date_state TEXT NOT NULL DEFAULT 'awaiting_painter_dates',
  ADD COLUMN IF NOT EXISTS customer_counter JSONB,
  ADD COLUMN IF NOT EXISTS scheduled_end_date DATE,
  ADD COLUMN IF NOT EXISTS declined_painters UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fallback_token UUID,
  ADD COLUMN IF NOT EXISTS fallback_expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS fallback_suggestions JSONB;

COMMENT ON COLUMN quote_selections.date_state IS
  'awaiting_painter_dates | painter_offered | customer_countered | agreed';
COMMENT ON COLUMN quote_selections.status IS
  'offer_sent | painter_accepted | confirmed | completed | needs_new_painter (painter declined, customer choosing) | cancelled | expired';

CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_selections_fallback_token
  ON quote_selections(fallback_token) WHERE fallback_token IS NOT NULL;
