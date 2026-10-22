-- Painter rewards: achievements earned for completed jobs and good reviews.
--
-- Rows are written only by edge functions (service role) through
-- _shared/achievements.ts; a painter can read their own. The unique key makes
-- awarding idempotent, so it can safely run on every job completion, every
-- review, and as a backfill when the Rewards page loads.
--   kind:      'jobs' (completed jobs) | 'reviews' (reviews of 2 stars or more)
--   threshold: the milestone reached (jobs 5/15/30/100, reviews 1/5/15/50)

CREATE TABLE IF NOT EXISTS painter_achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  painter_id UUID NOT NULL REFERENCES painters(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('jobs', 'reviews')),
  threshold INTEGER NOT NULL,
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (painter_id, kind, threshold)
);

CREATE INDEX IF NOT EXISTS idx_painter_achievements_painter ON painter_achievements(painter_id);
ALTER TABLE painter_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Painters read own achievements" ON painter_achievements;
CREATE POLICY "Painters read own achievements" ON painter_achievements
  FOR SELECT TO authenticated
  USING (painter_id IN (SELECT id FROM painters WHERE user_id = auth.uid()));
