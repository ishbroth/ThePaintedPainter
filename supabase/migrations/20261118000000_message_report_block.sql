-- Report and block for the in-app messages between a job's customer and painter.
--
-- Block: each side can turn messaging off for ONE job (the job itself carries on: deposit, schedule and completion are untouched).
-- Two flags, one per side, so that one person unblocking never undoes the other's block. The other person is only told that
-- messaging has been turned off, never by whom. Checked by the job-messages edge function (_shared/jobMessages.ts canSendMessages).
--
-- Report: a person on the job can report the other one (optionally pointing at one message). The row keeps a snapshot of the
-- recent thread so it can still be reviewed after anything is edited or removed, and the owner is emailed. Server-only like
-- job_messages: row level security on with no policies, no privileges for the browser roles.

ALTER TABLE quote_selections
  ADD COLUMN IF NOT EXISTS customer_blocked_messages BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS painter_blocked_messages BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS message_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES quote_selections(id) ON DELETE SET NULL,
  reporter_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_role TEXT NOT NULL CHECK (reporter_role IN ('customer', 'painter')),
  reported_role TEXT NOT NULL CHECK (reported_role IN ('customer', 'painter')),
  -- the message the report points at, when it points at one
  message_id UUID REFERENCES job_messages(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN ('harassment', 'inappropriate', 'spam', 'scam', 'off_platform', 'other')),
  details TEXT CHECK (details IS NULL OR char_length(details) <= 500),
  -- the last messages in the thread when the report was made: [{ from: 'customer'|'painter', body, at }]
  snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  also_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_reports_job ON message_reports(job_id, created_at);
CREATE INDEX IF NOT EXISTS idx_message_reports_open ON message_reports(created_at) WHERE status = 'open';

ALTER TABLE message_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON message_reports FROM anon, authenticated;

COMMENT ON TABLE message_reports IS
  'Reports of a person on a job by the other person on it. Server-only: written by the job-messages edge function, reviewed by the owner.';
