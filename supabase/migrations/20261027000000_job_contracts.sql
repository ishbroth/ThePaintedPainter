-- Contracts between a customer and the painter who confirmed their job.
--
-- The Painted Painter is a marketplace, not a contractor: the contract is between the customer and the painter. One row per version, so the
-- whole history is kept.
--   draft       the painter is preparing it (only the painter sees it)
--   sent        waiting for the customer to accept (the first version goes out automatically when the dates are agreed;
--               later ones are the painter's change notices)
--   accepted    the customer accepted it (typed name, time, IP recorded). The latest accepted version is the one in force.
--   declined    the customer declined it (with an optional note)
--   superseded  replaced by a later version
--
-- terms          the generated contract (parties, project, price, schedule, standard clauses), a snapshot taken when it is sent
-- painter_terms  what the painter adds: scope notes, special terms, warranty wording, change-order lines
-- document_*     the painter's own contract (PDF or Word) in the private contract-documents bucket
--
-- Everything goes through the `contract` edge function (service role), which checks who is asking, so no client policies are defined.

CREATE TABLE IF NOT EXISTS job_contracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES quote_selections(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'superseded')),
  terms JSONB NOT NULL DEFAULT '{}'::jsonb,
  painter_terms JSONB NOT NULL DEFAULT '{}'::jsonb,
  document_path TEXT,
  document_name TEXT,
  document_size INTEGER,
  change_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  responded_at TIMESTAMP WITH TIME ZONE,
  accepted_name TEXT,
  accepted_ip TEXT,
  accepted_user_agent TEXT,
  customer_note TEXT,
  UNIQUE (job_id, version)
);

CREATE INDEX IF NOT EXISTS idx_job_contracts_job ON job_contracts(job_id, version DESC);
ALTER TABLE job_contracts ENABLE ROW LEVEL SECURITY;
-- No policies: service role only.

-- Painters' own contract documents. Private; files are handed out as short-lived signed links by the contract function.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contract-documents', 'contract-documents', false, 10485760,
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
