-- Stop exposing private painter data to the public.
--
-- Until now a few RLS policies let ANYONE (no login) read full rows:
--   * painters  — every approved painter's email, phone, address, license and
--                 policy numbers, and the six pricing answers
--   * profiles  — every painter's profile row
--   * reviews   — every review including the customer's full name and id
-- Customers now get painters through the painter-results / painter-detail edge
-- functions, which return only the fields meant to be seen (name, city, photos,
-- ratings, credentials status…) and compute each painter's price server-side,
-- so none of this needs to be readable from the browser any more.

DROP POLICY IF EXISTS "Allow reading verified painters" ON painters;
DROP POLICY IF EXISTS "Public can read painter profiles" ON profiles;
DROP POLICY IF EXISTS "Anyone can read reviews" ON reviews;

-- Painters read the reviews written about them; customers read their own.
DROP POLICY IF EXISTS "Participants read their reviews" ON reviews;
CREATE POLICY "Participants read their reviews" ON reviews
  FOR SELECT TO authenticated
  USING (painter_id = auth.uid() OR customer_id = auth.uid());

-- Where a painter's reputation lives elsewhere. Shape:
--   { "google":   { "url": "...", "rating": 4.8, "count": 120 },
--     "yelp":     { ... }, "facebook": { ... } }
-- Entirely painter-entered and optional; links are sanitized (https + known
-- hosts) before they're ever shown to a customer.
ALTER TABLE painters ADD COLUMN IF NOT EXISTS external_reviews JSONB NOT NULL DEFAULT '{}'::jsonb;
