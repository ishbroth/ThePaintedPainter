-- A customer leaving a review can attach photos of the finished work — uploaded the same guest-friendly way as the
-- chat estimator's own photos (the quote-photos bucket already allows anonymous upload/view; reused here rather than
-- standing up a second bucket for the same purpose).

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN reviews.photos IS
  'Array of {url} — photos the customer attached to their review, shown alongside it.';
