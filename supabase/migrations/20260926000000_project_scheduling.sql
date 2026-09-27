-- =============================================
-- Real project scheduling for "My Projects"
-- =============================================
-- Up to now, nothing captured a confirmed project date, and nothing linked
-- a quote_selections row to an actual logged-in customer account (the claim
-- flow is guest-checkout style via emailed tokens). This adds both, plus
-- groundwork for a customer splitting one job into multiple independently
-- scheduled phases (e.g. "bedrooms now, exterior in the spring").
--
-- Flow this supports:
--   1. Customer optionally states a preferred start date when claiming.
--   2. Painter proposes/confirms the actual scheduled_date when accepting
--      (see the new painter-confirm-date page/function).
--   3. My Projects (customer dashboard) lists confirmed rows by
--      scheduled_date, joined to the accepted painter's contact info.

ALTER TABLE quote_selections
  ADD COLUMN IF NOT EXISTS customer_preferred_date DATE,
  ADD COLUMN IF NOT EXISTS scheduled_date DATE,
  ADD COLUMN IF NOT EXISTS date_confirmed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parent_quote_id UUID REFERENCES quote_selections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS phase_label TEXT;

COMMENT ON COLUMN quote_selections.customer_preferred_date IS
  'What the customer asked for at claim time — a request, not a commitment.';
COMMENT ON COLUMN quote_selections.scheduled_date IS
  'The actual confirmed date, set by the painter when accepting (defaults to customer_preferred_date, but the painter can counter-propose).';
COMMENT ON COLUMN quote_selections.customer_id IS
  'Set when the customer was logged in at claim time. NULL for guest claims — My Projects falls back to matching by customer_email in that case.';
COMMENT ON COLUMN quote_selections.parent_quote_id IS
  'When a customer splits one estimate into multiple independently-scheduled phases (different rooms on different dates), each phase is its own quote_selections row sharing this pointer to the first/primary row.';
COMMENT ON COLUMN quote_selections.phase_label IS
  'Human label for a phase when parent_quote_id is set, e.g. "Bedrooms" / "Exterior".';

CREATE INDEX IF NOT EXISTS idx_quote_selections_customer_id ON quote_selections(customer_id);
CREATE INDEX IF NOT EXISTS idx_quote_selections_customer_email ON quote_selections(customer_email);
CREATE INDEX IF NOT EXISTS idx_quote_selections_parent_quote_id ON quote_selections(parent_quote_id);
