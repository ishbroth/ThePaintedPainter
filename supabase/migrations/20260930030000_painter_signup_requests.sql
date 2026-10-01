-- Painter sign-up is now confirm-first.
--
-- Submitting the sign-up form no longer creates an account. It stores the
-- answers here (with only a bcrypt hash of the chosen password) and emails a
-- confirmation link. Clicking the link (confirm-painter-signup function) is
-- what creates the auth user + painter record and sends the application to the
-- admin. An unconfirmed request is never an account, expires after 14 days, and
-- is deleted — along with everything the applicant typed — by the nightly purge.

CREATE TABLE IF NOT EXISTS painter_signup_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,   -- sha256 of the emailed token; the token itself is never stored
  password_hash TEXT NOT NULL,       -- bcrypt; plaintext password is never stored
  payload JSONB NOT NULL,            -- the form answers
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() + INTERVAL '14 days'
);

CREATE INDEX IF NOT EXISTS idx_painter_signup_requests_email ON painter_signup_requests(lower(email));
CREATE INDEX IF NOT EXISTS idx_painter_signup_requests_expires ON painter_signup_requests(expires_at);

ALTER TABLE painter_signup_requests ENABLE ROW LEVEL SECURITY;
-- No policies at all: only the service role (edge functions) can touch this table.

-- Is there already an auth account with this email? (edge functions only)
CREATE OR REPLACE FUNCTION auth_email_exists(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(p_email));
$$;
REVOKE ALL ON FUNCTION auth_email_exists(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_email_exists(TEXT) TO service_role;

-- Nightly purge of expired, never-confirmed requests.
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'purge-expired-painter-signups';
SELECT cron.schedule(
  'purge-expired-painter-signups',
  '30 3 * * *',
  $$ DELETE FROM painter_signup_requests WHERE expires_at < NOW(); $$
);
