-- =============================================
-- Job completion tracking + real reviews
-- =============================================
-- We don't handle the actual labor contract/payment between painter and
-- customer — that happens off-platform. So "done" is the painter's own
-- attestation: they mark a confirmed job completed from their dashboard,
-- which fires a review-request email to the customer with a one-time
-- token link. The reviews table already existed but was 100% unused
-- (empty, referenced only by mock pages) — this wires it to the real
-- quote_selections flow instead of the dead customer_projects table.

ALTER TABLE quote_selections
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS review_token UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS review_requested_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS review_submitted_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN quote_selections.completed_at IS
  'Set when the painter marks this job done & paid from their dashboard. Not a platform-verified payment — just the painter''s attestation, since labor payment happens off-platform.';
COMMENT ON COLUMN quote_selections.review_token IS
  'Secret embedded in the "confirm & rate" email link sent to the customer once the painter marks the job completed.';
COMMENT ON COLUMN quote_selections.review_submitted_at IS
  'Set once the customer has submitted a review for this job, so the link/CTA can''t be used twice.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_selections_review_token ON quote_selections(review_token);

-- =============================================
-- reviews: repoint at the real job table, allow guest reviewers
-- =============================================
-- reviews.project_id pointed at customer_projects, a parallel table the
-- real claim/confirm/schedule flow never writes to. The actual job record
-- is always a quote_selections row.
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS fk_reviews_project;
ALTER TABLE reviews
  ADD CONSTRAINT fk_reviews_project
  FOREIGN KEY (project_id) REFERENCES quote_selections(id) ON DELETE SET NULL;

-- Guest claims (no logged-in account at claim time) have no profiles row,
-- so a guest customer confirming and rating from the email link can't
-- satisfy a NOT NULL customer_id FK. customer_name already carries the
-- display name for this case.
ALTER TABLE reviews ALTER COLUMN customer_id DROP NOT NULL;

-- One review per job.
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_project_unique ON reviews(project_id) WHERE project_id IS NOT NULL;

-- =============================================
-- painter_ratings: aggregate view for marketplace display
-- =============================================
-- reviews.painter_id references profiles(id) (the painter's auth user id),
-- which is the same id as painters.user_id — NOT painters.id, which is
-- what quote_selections/realPainterMatcher key on. This view bridges the
-- two so a plain `.eq('painter_id', painters.id)` lookup works everywhere
-- painters are already queried.
CREATE OR REPLACE VIEW painter_ratings AS
SELECT
  p.id AS painter_id,
  COUNT(r.id)::int AS review_count,
  COALESCE(ROUND(AVG(r.rating)::numeric, 1), 0) AS avg_rating
FROM painters p
LEFT JOIN reviews r ON r.painter_id = p.user_id
GROUP BY p.id;

GRANT SELECT ON painter_ratings TO anon, authenticated;
