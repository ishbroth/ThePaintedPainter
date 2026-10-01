-- Customer loyalty points.
--
-- Rules (per product spec):
--   * 1 point per $100 of a completed project's guaranteed price.
--   * Every 20 points earned = 1% off the customer's next project, up to a
--     5% cap (100 points).
--   * Each discount percentage point has a 12-month clock. The clock
--     (profiles.loyalty_discount_earned_at) starts/restarts whenever a
--     project brings the customer up to a NEW percentage point (e.g. 10 pts
--     + 10 pts => 1%, and the clock starts on the second project). If 12
--     months pass without reaching another percentage point, they lose 1
--     point of discount (20 points) and a fresh 12 months starts for the
--     next one — repeating until 0%.
--   * At the 5% cap there is no "new" point to earn, so the discount is kept
--     for another year only if they earned at least 20 points in that year.
--
-- Points are only ever awarded to a *registered* customer (quote_selections
-- .customer_id is only populated when the customer was logged in at claim
-- time — guest claims never earn points).
--
-- Known limitation (flagged, not fixed here): the only dollar figure ever
-- recorded on a completed job is quote_selections.guaranteed_price, set at
-- claim time from a client-computed, never server-validated number, and
-- never reconciled against what was actually paid (the remaining ~90% is
-- settled directly between customer and painter, off-platform). Points are
-- therefore computed from guaranteed_price as the best available proxy for
-- "amount booked."

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS loyalty_points_balance INTEGER NOT NULL DEFAULT 0
    CHECK (loyalty_points_balance >= 0 AND loyalty_points_balance <= 100),
  ADD COLUMN IF NOT EXISTS loyalty_points_lifetime INTEGER NOT NULL DEFAULT 0
    CHECK (loyalty_points_lifetime >= 0),
  ADD COLUMN IF NOT EXISTS loyalty_discount_earned_at TIMESTAMP WITH TIME ZONE;

-- Replaced by loyalty_discount_earned_at (an earlier draft of this migration was
-- already applied with the old column).
ALTER TABLE profiles DROP COLUMN IF EXISTS loyalty_last_decay_check_at;

-- Integer division floors in Postgres, so this is exactly floor(balance/20),
-- capped implicitly since loyalty_points_balance itself is capped at 100.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS loyalty_discount_percent INTEGER
    GENERATED ALWAYS AS (LEAST(loyalty_points_balance / 20, 5)) STORED;

CREATE TABLE IF NOT EXISTS loyalty_point_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quote_selection_id UUID REFERENCES quote_selections(id) ON DELETE SET NULL,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('project_completed', 'annual_decay')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_point_events_customer ON loyalty_point_events(customer_id);

ALTER TABLE loyalty_point_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers can view own loyalty events" ON loyalty_point_events;
CREATE POLICY "customers can view own loyalty events" ON loyalty_point_events
  FOR SELECT USING (auth.uid() = customer_id);

-- No INSERT/UPDATE/DELETE policies for regular users — all writes go through
-- the SECURITY DEFINER functions below (or the service role), never direct
-- client writes, since this is money-adjacent state.

-- ---------------------------------------------------------------------------
-- award_loyalty_points — called by the mark-job-completed edge function
-- (service role only) when a completed job belongs to a registered customer.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION award_loyalty_points(
  p_customer_id UUID,
  p_project_amount NUMERIC,
  p_quote_selection_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points INTEGER;
  v_old_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  IF p_customer_id IS NULL OR p_project_amount IS NULL THEN
    RETURN;
  END IF;

  v_points := FLOOR(p_project_amount / 100)::INTEGER;
  IF v_points <= 0 THEN
    RETURN;
  END IF;

  INSERT INTO loyalty_point_events (customer_id, quote_selection_id, points, reason)
  VALUES (p_customer_id, p_quote_selection_id, v_points, 'project_completed');

  SELECT loyalty_points_balance INTO v_old_balance
  FROM profiles WHERE id = p_customer_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_new_balance := LEAST(v_old_balance + v_points, 100);

  -- Reaching a new percentage point (re)starts the 12-month clock.
  UPDATE profiles
  SET loyalty_points_balance = v_new_balance,
      loyalty_points_lifetime = loyalty_points_lifetime + v_points,
      loyalty_discount_earned_at = CASE
        WHEN v_new_balance / 20 > v_old_balance / 20 THEN NOW()
        ELSE loyalty_discount_earned_at
      END
  WHERE id = p_customer_id;
END;
$$;

REVOKE ALL ON FUNCTION award_loyalty_points(UUID, NUMERIC, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION award_loyalty_points(UUID, NUMERIC, UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- sync_loyalty_decay — called directly by a logged-in customer (their own
-- id only, enforced below) whenever the app needs their current discount:
-- when finalizing a new chat estimate, and when viewing "My Projects".
-- Lazily evaluates any missed annual check(s) rather than relying on a
-- scheduled job, so behavior is correct regardless of whether/when a cron
-- ever runs.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_loyalty_decay(p_customer_id UUID)
RETURNS TABLE(points_balance INTEGER, points_lifetime INTEGER, discount_percent INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INTEGER;
  v_anchor TIMESTAMP WITH TIME ZONE;
  v_earned_in_window INTEGER;
BEGIN
  IF p_customer_id IS NULL OR p_customer_id <> auth.uid() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT loyalty_points_balance, loyalty_discount_earned_at
  INTO v_balance, v_anchor
  FROM profiles WHERE id = p_customer_id FOR UPDATE;

  -- Walk each missed 12-month period since the last percentage point was
  -- earned; each one costs 1 point of discount (20 pts), except at the cap
  -- where earning >= 20 points in the period keeps the discount.
  WHILE v_balance >= 20 AND v_anchor IS NOT NULL
        AND v_anchor + INTERVAL '1 year' <= NOW() LOOP
    v_earned_in_window := 0;
    IF v_balance >= 100 THEN
      SELECT COALESCE(SUM(points), 0) INTO v_earned_in_window
      FROM loyalty_point_events
      WHERE customer_id = p_customer_id
        AND reason = 'project_completed'
        AND created_at >= v_anchor
        AND created_at < v_anchor + INTERVAL '1 year';
    END IF;

    IF v_earned_in_window < 20 THEN
      INSERT INTO loyalty_point_events (customer_id, points, reason)
      VALUES (p_customer_id, -20, 'annual_decay');
      v_balance := v_balance - 20;
    END IF;

    v_anchor := v_anchor + INTERVAL '1 year';
  END LOOP;

  UPDATE profiles
  SET loyalty_points_balance = v_balance,
      loyalty_discount_earned_at = CASE WHEN v_balance >= 20 THEN v_anchor ELSE NULL END
  WHERE id = p_customer_id;

  RETURN QUERY
  SELECT loyalty_points_balance, loyalty_points_lifetime, loyalty_discount_percent
  FROM profiles WHERE id = p_customer_id;
END;
$$;

REVOKE ALL ON FUNCTION sync_loyalty_decay(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sync_loyalty_decay(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Award points atomically with job completion. A trigger on quote_selections
-- (rather than a separate call from the mark-job-completed edge function)
-- means the award commits or rolls back together with the status change, so
-- a transient failure can never leave a completed job without its points,
-- and the status guard means each job can only ever award once.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION award_loyalty_points_on_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    PERFORM award_loyalty_points(
      NEW.customer_id,
      COALESCE(NEW.guaranteed_price, NEW.selected_painter_price),
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_loyalty_points_on_completion ON quote_selections;
CREATE TRIGGER trg_award_loyalty_points_on_completion
  AFTER UPDATE OF status ON quote_selections
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
  EXECUTE FUNCTION award_loyalty_points_on_completion();

-- ---------------------------------------------------------------------------
-- Lock the loyalty columns against direct client writes. The profiles RLS
-- policies let a user insert/update their own row with any column values, so
-- without this a customer could set their own balance from the browser.
-- SECURITY DEFINER functions run as the function owner, so current_user is
-- 'authenticated'/'anon' only for direct PostgREST writes.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION protect_loyalty_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.loyalty_points_balance := 0;
    NEW.loyalty_points_lifetime := 0;
    NEW.loyalty_discount_earned_at := NULL;
  ELSIF NEW.loyalty_points_balance IS DISTINCT FROM OLD.loyalty_points_balance
     OR NEW.loyalty_points_lifetime IS DISTINCT FROM OLD.loyalty_points_lifetime
     OR NEW.loyalty_discount_earned_at IS DISTINCT FROM OLD.loyalty_discount_earned_at THEN
    RAISE EXCEPTION 'loyalty fields cannot be modified directly';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_loyalty_columns ON profiles;
CREATE TRIGGER trg_protect_loyalty_columns
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_loyalty_columns();
