-- =============================================
-- Estimator self-training: lessons from conversations that went badly
-- =============================================
-- After a quote is complete, the estimator reviews its own conversation (edge function estimator-self-review: a small AI pass over the
-- transcript, only when the customer showed friction like "I already said that", plus a small random sample). What went wrong and a short fix
-- are saved here. The most recent and most frequent lessons are added to the estimator's prompt (chat-estimator-extract), so it improves over time.
--
-- Only the service role (the edge functions) reads or writes this table: row level security is on and there are no policies, so the
-- browser (anon / authenticated) can do nothing with it. The transcript itself is never stored, only the short lessons.

CREATE TABLE IF NOT EXISTS estimator_lessons (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  issue_type TEXT NOT NULL CHECK (issue_type IN (
    'repeated_question', 'ignored_answer', 'misunderstood', 'wrong_assumption', 'missed_question', 'unclear_question', 'pricing_gap', 'other'
  )),
  what_went_wrong TEXT NOT NULL CHECK (char_length(what_went_wrong) <= 600),
  suggested_fix TEXT NOT NULL CHECK (char_length(suggested_fix) <= 600),
  -- how many friction signals the browser saw in the conversation (0 for a random-sample review)
  friction_signals INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS estimator_lessons_created_at_idx ON estimator_lessons (created_at DESC);
CREATE INDEX IF NOT EXISTS estimator_lessons_conversation_idx ON estimator_lessons (conversation_id);

ALTER TABLE estimator_lessons ENABLE ROW LEVEL SECURITY;

-- No policies on purpose: the service role bypasses row level security, everyone else gets nothing.
REVOKE ALL ON estimator_lessons FROM anon, authenticated;
