-- =============================================
-- Job claim marketplace: broadcast/direct painter offers,
-- race-safe claiming, and deposit groundwork.
-- =============================================
--
-- Flow this supports:
--   1. Customer "claims their price" (picks a specific painter or
--      "mystery painter") and provides contact info. A row is inserted
--      here with status = 'offer_sent' and the eligible painter(s) in
--      notified_painters (or selected_painter_id for a direct pick).
--   2. Each notified painter gets an email with a masked summary (first
--      name, zip, timeline, payout) and an Accept link keyed on
--      claim_token + their own painter id. The first painter to hit that
--      link flips status to 'painter_accepted' — the UPDATE's WHERE
--      status = 'offer_sent' clause makes this atomic/race-safe; anyone
--      who clicks after that gets 0 rows updated and sees "already
--      claimed."
--   3. The customer gets an email (customer_confirm_token link) showing
--      the accepted painter's contact info, asking them to confirm and
--      pay the deposit.
--   4. On successful Stripe payment (webhook), status becomes 'confirmed'
--      and the painter gets a final email with the customer's full
--      contact info.

ALTER TABLE quote_selections
  ADD COLUMN IF NOT EXISTS customer_street_address TEXT,
  ADD COLUMN IF NOT EXISTS customer_city TEXT,
  ADD COLUMN IF NOT EXISTS customer_state TEXT,
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC NOT NULL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS painter_payout_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS claim_token UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS customer_confirm_token UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS offer_sent_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS deposit_status TEXT NOT NULL DEFAULT 'unpaid', -- unpaid, paid
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE;

-- status now also takes: 'offer_sent', 'painter_accepted', 'confirmed', 'expired'
-- (in addition to the original 'pending', 'accepted', 'completed', 'cancelled')

COMMENT ON COLUMN quote_selections.claim_token IS
  'Shared secret embedded in every painter Accept link for this job. Combined with notified_painters/selected_painter_id to identify who is claiming.';
COMMENT ON COLUMN quote_selections.customer_confirm_token IS
  'Secret embedded in the customer''s confirm-and-pay link, sent once a painter accepts.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_selections_claim_token ON quote_selections(claim_token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_selections_confirm_token ON quote_selections(customer_confirm_token);

-- =============================================
-- customer_projects: add the columns the Stripe webhook has referenced
-- since it was written (it silently failed on every payment — these
-- never existed). Fixed here as part of the same payment-groundwork pass.
-- =============================================
ALTER TABLE customer_projects
  ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent TEXT;
