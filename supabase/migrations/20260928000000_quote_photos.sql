-- =============================================
-- Photo uploads for the chat estimator
-- =============================================
-- Certain scope details (repair extent, closet shelving, furniture pieces,
-- unusual trim/millwork) are hard to price from a text description alone,
-- so the chat estimator prompts for a picture in those cases (plus a
-- generic "photos of the property" ask at wrap-up). Uploads happen straight
-- from the browser with the anon key, before the customer necessarily has
-- an account — same guest-friendly pattern as the rest of the claim flow.

INSERT INTO storage.buckets (id, name, public)
VALUES ('quote-photos', 'quote-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can upload quote photos" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'quote-photos');

CREATE POLICY "Anyone can view quote photos" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'quote-photos');

-- Photos ride along with the rest of the job summary once the customer
-- claims a price — forwarded to the painter alongside the Q&A.
ALTER TABLE quote_selections
  ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN quote_selections.photos IS
  'Array of {url, description, label} — photos the customer uploaded during the chat estimate, forwarded to the painter.';
