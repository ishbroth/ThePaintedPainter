-- Support for "you haven't verified your email yet" at sign-in.
--
-- A painter who has submitted the form but not yet clicked the confirmation link
-- has no account, so signing in fails. check-pending-signup recognizes their
-- credentials against the pending request and tells them to check their email
-- (and can resend the link). These columns keep that endpoint from being used to
-- guess passwords or to spam someone's inbox.

ALTER TABLE painter_signup_requests
  ADD COLUMN IF NOT EXISTS check_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();
