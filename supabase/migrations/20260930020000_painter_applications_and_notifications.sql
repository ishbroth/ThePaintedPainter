-- Painter application review workflow + real notifications + web push.
--
-- Application flow
--   * A painter row is now created server-side (submit-painter-application edge
--     function) together with the auth user, so a failure can't leave an account
--     without a company record. Nothing inserts into painters from the browser
--     any more, so the anon/authenticated insert policies are dropped.
--   * status: 'pending' (awaiting review) | 'needs_info' (admin asked for more) |
--     'approved' | 'rejected'. Changed only by the admin-painter-review function
--     (signed link from the sign-up email), never directly by a client.
--   * application_tasks: [{ id, label, done }] — what the admin asked for.

ALTER TABLE painters
  ADD COLUMN IF NOT EXISTS application_tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS admin_message TEXT,
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

DROP POLICY IF EXISTS "Anonymous painter applications start pending" ON painters;
DROP POLICY IF EXISTS "Authenticated painter applications start pending" ON painters;
DROP POLICY IF EXISTS "Allow anonymous inserts on painters" ON painters;

-- A painter can read their own row (status, tasks) even while pending.
DROP POLICY IF EXISTS "Painters read own row" ON painters;
CREATE POLICY "Painters read own row" ON painters
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Private bucket for the proof documents painters upload for their tasks
-- (license, insurance, bond...). Each user can only touch their own folder.
INSERT INTO storage.buckets (id, name, public)
VALUES ('painter-documents', 'painter-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "painters upload own documents" ON storage.objects;
CREATE POLICY "painters upload own documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'painter-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "painters read own documents" ON storage.objects;
CREATE POLICY "painters read own documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'painter-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "painters delete own documents" ON storage.objects;
CREATE POLICY "painters delete own documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'painter-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Notifications
--   The notifications table already exists (user_id, type, title, body, link,
--   is_read). Rows are written server-side by edge functions; clients only read
--   and mark-as-read. Add realtime so open pages update instantly.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;

-- Web push subscriptions (one per browser/device).
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users manage own push subscriptions" ON push_subscriptions;
CREATE POLICY "users manage own push subscriptions" ON push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Which reminders have already gone out, so the daily job never double-sends.
CREATE TABLE IF NOT EXISTS job_reminders (
  job_id UUID NOT NULL REFERENCES quote_selections(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (job_id, kind)
);
ALTER TABLE job_reminders ENABLE ROW LEVEL SECURITY;
-- No policies: service role only.
