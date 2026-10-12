-- Finding painters for jobs in areas with none yet.
--
-- When a customer claims a price where no approved painter is within range, the job waits in status 'searching_painter' for 48 hours
-- (see send-reminders). Meanwhile local painting companies found through Google Places are invited by email to claim it.
--
--   outreach_leads    one row per company invited for a job (so nobody is emailed twice about the same job, and the owner can see who
--                     was contacted). invite_token is the secret in that company's links.
--   outreach_optouts  addresses that asked not to be contacted again. Checked before every invitation; never emailed again.
--
-- Both tables are written and read only by edge functions (the service role); there are no policies on purpose.

CREATE TABLE IF NOT EXISTS outreach_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES quote_selections(id) ON DELETE CASCADE,
  company_name TEXT,
  email TEXT NOT NULL,
  website TEXT,
  phone TEXT,
  source TEXT NOT NULL DEFAULT 'google_places',
  zip TEXT,
  status TEXT NOT NULL DEFAULT 'invited', -- invited | signed_up | unsubscribed
  invite_token UUID NOT NULL DEFAULT gen_random_uuid(),
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, email)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_outreach_leads_token ON outreach_leads(invite_token);
CREATE INDEX IF NOT EXISTS idx_outreach_leads_email ON outreach_leads(lower(email));
CREATE INDEX IF NOT EXISTS idx_outreach_leads_invited_at ON outreach_leads(invited_at);

CREATE TABLE IF NOT EXISTS outreach_optouts (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE outreach_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_optouts ENABLE ROW LEVEL SECURITY;
