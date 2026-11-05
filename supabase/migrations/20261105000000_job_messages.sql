-- In-app messages between the customer and the painter of a confirmed job.
--
-- Like quote_selections, this table is reachable ONLY through the `job-messages` edge function (service role): the
-- function works out who the caller is, checks they are the customer or the painter on the job, and that the job is
-- confirmed (both parties confirmed and on the schedule) before it reads or writes anything. Row level security is
-- switched on with no policies and all table privileges are revoked from the browser roles, so nothing can be read or
-- written with the public key, by anyone, for any job.

CREATE TABLE IF NOT EXISTS job_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES quote_selections(id) ON DELETE CASCADE,
  -- null only for the made-up customers of the demonstration painters (they have no login) or after an account is deleted
  sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('customer', 'painter')),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  -- when the OTHER person opened the thread and saw it; null while unread
  read_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_job_messages_job ON job_messages(job_id, created_at);
-- unread counts: the messages one side has not read yet
CREATE INDEX IF NOT EXISTS idx_job_messages_unread ON job_messages(job_id, sender_role) WHERE read_at IS NULL;

ALTER TABLE job_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON job_messages FROM anon, authenticated;

COMMENT ON TABLE job_messages IS
  'Messages between a job''s customer and painter. Server-only: read and written by the job-messages edge function after it checks the caller is on the job and the job is confirmed.';
