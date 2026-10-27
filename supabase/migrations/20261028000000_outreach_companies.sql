-- A growing directory of painting companies found by outreach, and the rotation that decides who is invited next.
--
-- Every company a Google search turns up is kept here (with the business email found on its own website), so a second customer in the same
-- area costs no new searches, and so invitations can rotate through everyone instead of always going to the same nearest companies.
--
--   outreach_companies  one row per company (keyed by its website). invite_count / last_invited_at drive the rotation; signed_up and
--                       opted_out take a company out of it for good.
--   outreach_searches   when each ZIP was last searched on Google, so the search is repeated only when the stored list runs thin or old.
--
-- outreach_leads (one row per invitation sent for a job) stays as the log of what was sent. Service role only: no policies.

CREATE TABLE IF NOT EXISTS outreach_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_key TEXT NOT NULL UNIQUE,        -- the company's website without www, scheme or trailing slash
  name TEXT NOT NULL,
  website TEXT,
  phone TEXT,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  email TEXT,
  email_checked_at TIMESTAMP WITH TIME ZONE,   -- when we last read their website for an email (null = never)
  first_found_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_found_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  invite_count INTEGER NOT NULL DEFAULT 0,
  last_invited_at TIMESTAMP WITH TIME ZONE,
  signed_up BOOLEAN NOT NULL DEFAULT FALSE,
  opted_out BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_outreach_companies_geo ON outreach_companies(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_outreach_companies_email ON outreach_companies(lower(email));

CREATE TABLE IF NOT EXISTS outreach_searches (
  zip TEXT PRIMARY KEY,
  searched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  found INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE outreach_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_searches ENABLE ROW LEVEL SECURITY;
