-- =============================================
-- Account-level chat estimator session persistence
-- =============================================
-- Chat estimator progress was sessionStorage-only, which already does the
-- right thing for a guest: survives a page refresh, but is gone the moment
-- the tab/browser actually closes (no account to tie it to, so starting
-- over is correct). But a signed-in user has an identity to key
-- persistence off — this lets their in-progress or just-completed quote
-- survive closing the browser entirely, not just a refresh, and follow
-- them across devices, the same way theme_preference does.

CREATE TABLE IF NOT EXISTS chat_estimator_sessions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  state JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE chat_estimator_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own chat session" ON chat_estimator_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own chat session" ON chat_estimator_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat session" ON chat_estimator_sessions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat session" ON chat_estimator_sessions
  FOR DELETE USING (auth.uid() = user_id);
