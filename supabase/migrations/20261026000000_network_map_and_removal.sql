-- Network map, demo painters, geocoding, and removing painters from the network.
--
-- Map
--   map_painters is the public, safe-to-read list of who is on the network (no contact details, no
--   credentials numbers). A trigger on painters keeps it exact: a painter appears the moment they are
--   approved and disappears the moment they are removed, suspended-for-good, rejected, or deleted. It is in
--   the realtime publication, so open maps update instantly with no refresh.
--
-- Demo painters
--   painters.is_demo marks the fake profiles used for demonstration and testing. They are mixed into the
--   map, but every place that picks painters for a real customer (results, job offers, outreach) skips them.
--
-- Geocoding
--   zip_geocodes caches the exact coordinates of each ZIP (looked up once from Google). Matching customers
--   to painters uses these instead of the rough 3-digit-prefix centers.
--
-- Removal
--   status 'removed' takes a painter out of the network. removed_painters keeps a snapshot of who they were
--   (name, address, phone, license number) so a later application matching any of it is flagged to the owner.

ALTER TABLE painters
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS geocoded_zip TEXT,
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS removal_reason TEXT,
  ADD COLUMN IF NOT EXISTS previously_removed_note TEXT;

COMMENT ON COLUMN painters.status IS
  'pending | needs_info | approved | rejected | suspended (credential turned off, paused) | removed (taken out of the network)';
COMMENT ON COLUMN painters.previously_removed_note IS
  'Set at application time when the name, address, phone or license number matches a painter removed earlier.';

-- Clients may not edit these (they are set by edge functions / the admin flow).
CREATE OR REPLACE FUNCTION protect_painter_network_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF NEW.is_demo IS DISTINCT FROM OLD.is_demo
     OR NEW.latitude IS DISTINCT FROM OLD.latitude
     OR NEW.longitude IS DISTINCT FROM OLD.longitude
     OR NEW.geocoded_zip IS DISTINCT FROM OLD.geocoded_zip
     OR NEW.removed_at IS DISTINCT FROM OLD.removed_at
     OR NEW.removal_reason IS DISTINCT FROM OLD.removal_reason
     OR NEW.previously_removed_note IS DISTINCT FROM OLD.previously_removed_note THEN
    RAISE EXCEPTION 'these fields cannot be modified directly';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_painter_network_columns ON painters;
CREATE TRIGGER trg_protect_painter_network_columns
  BEFORE UPDATE ON painters
  FOR EACH ROW
  EXECUTE FUNCTION protect_painter_network_columns();

-- ---------------------------------------------------------------------------
-- ZIP -> coordinates cache (service role only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS zip_geocodes (
  zip TEXT PRIMARY KEY,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
ALTER TABLE zip_geocodes ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Painters who were removed
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS removed_painters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  painter_id UUID REFERENCES painters(id) ON DELETE SET NULL,
  removed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  reason TEXT NOT NULL,                -- 'bad_reviews' | 'admin'
  details TEXT,
  company_name TEXT,
  owner_name TEXT,
  email TEXT,
  -- normalized for matching (lowercase letters/digits only)
  company_key TEXT,
  owner_key TEXT,
  phone_key TEXT,
  address_key TEXT,
  license_key TEXT
);
CREATE INDEX IF NOT EXISTS idx_removed_painters_phone ON removed_painters(phone_key);
CREATE INDEX IF NOT EXISTS idx_removed_painters_license ON removed_painters(license_key);
CREATE INDEX IF NOT EXISTS idx_removed_painters_address ON removed_painters(address_key);
CREATE INDEX IF NOT EXISTS idx_removed_painters_owner ON removed_painters(owner_key);
ALTER TABLE removed_painters ENABLE ROW LEVEL SECURITY;
-- No policies: service role only.

-- ---------------------------------------------------------------------------
-- map_painters: the public list behind the map
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS map_painters (
  id UUID PRIMARY KEY,                 -- same id as painters.id
  company_name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  years_in_business INTEGER,
  crew_size INTEGER,
  is_licensed BOOLEAN NOT NULL DEFAULT FALSE,
  is_insured BOOLEAN NOT NULL DEFAULT FALSE,
  is_bonded BOOLEAN NOT NULL DEFAULT FALSE,
  service_types TEXT[] NOT NULL DEFAULT '{}',
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  avg_rating NUMERIC NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE map_painters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone can see who is on the network" ON map_painters;
CREATE POLICY "anyone can see who is on the network" ON map_painters
  FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON map_painters TO anon, authenticated;

-- Keep map_painters in step with painters.
CREATE OR REPLACE FUNCTION sync_map_painter()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rating NUMERIC := 0;
  reviews INTEGER := 0;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM map_painters WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.status = 'approved' AND NEW.verified = TRUE AND NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    SELECT COALESCE(ROUND(AVG(r.rating)::numeric, 1), 0), COUNT(r.id)::int
      INTO rating, reviews
      FROM reviews r WHERE r.painter_id = NEW.user_id;
    INSERT INTO map_painters (id, company_name, city, state, zip_code, latitude, longitude, years_in_business, crew_size,
                              is_licensed, is_insured, is_bonded, service_types, is_demo, avg_rating, review_count, updated_at)
    VALUES (NEW.id, NEW.company_name, NEW.city, NEW.state, NEW.zip_code, NEW.latitude, NEW.longitude, NEW.years_in_business, NEW.crew_size,
            COALESCE(NEW.has_license, FALSE), COALESCE(NEW.is_insured, FALSE), COALESCE(NEW.is_bonded, FALSE),
            COALESCE(NEW.service_types, '{}'), NEW.is_demo, rating, reviews, NOW())
    ON CONFLICT (id) DO UPDATE SET
      company_name = EXCLUDED.company_name, city = EXCLUDED.city, state = EXCLUDED.state, zip_code = EXCLUDED.zip_code,
      latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, years_in_business = EXCLUDED.years_in_business,
      crew_size = EXCLUDED.crew_size, is_licensed = EXCLUDED.is_licensed, is_insured = EXCLUDED.is_insured,
      is_bonded = EXCLUDED.is_bonded, service_types = EXCLUDED.service_types, is_demo = EXCLUDED.is_demo,
      avg_rating = EXCLUDED.avg_rating, review_count = EXCLUDED.review_count, updated_at = NOW();
  ELSE
    DELETE FROM map_painters WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_map_painter ON painters;
CREATE TRIGGER trg_sync_map_painter
  AFTER INSERT OR UPDATE OR DELETE ON painters
  FOR EACH ROW
  EXECUTE FUNCTION sync_map_painter();

-- A new / changed / deleted review refreshes that painter's stars on the map.
CREATE OR REPLACE FUNCTION sync_map_painter_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := COALESCE(NEW.painter_id, OLD.painter_id);
BEGIN
  UPDATE map_painters m
     SET avg_rating = COALESCE((SELECT ROUND(AVG(r.rating)::numeric, 1) FROM reviews r WHERE r.painter_id = uid), 0),
         review_count = (SELECT COUNT(r.id)::int FROM reviews r WHERE r.painter_id = uid),
         updated_at = NOW()
   WHERE m.id IN (SELECT p.id FROM painters p WHERE p.user_id = uid);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_map_painter_rating ON reviews;
CREATE TRIGGER trg_sync_map_painter_rating
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION sync_map_painter_rating();

-- Realtime: open maps hear about every change.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'map_painters'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE map_painters;
  END IF;
END $$;

-- Painters already approved before this migration: give them their map row once they are geocoded
-- (the geocode-painter function fills latitude/longitude; the trigger above then adds the row).

-- A customer's ZIP, so the painters map can open on their area.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS zip_code TEXT;
