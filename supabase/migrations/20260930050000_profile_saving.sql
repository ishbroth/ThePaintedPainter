-- Real saving for profiles, settings and portfolio.
--
-- Until now the Profile / Settings / Portfolio pages only pretended to save.
-- This adds what they need, and locks down the columns users must NOT be able
-- to change themselves now that direct updates are possible.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT '{"email": true, "push": true}'::jsonb;

-- Users can already UPDATE their own profile row (RLS), but nothing stopped them
-- from setting role='admin' on it. Role is fixed at sign-up and changed only
-- server-side. (Loyalty columns are protected by trg_protect_loyalty_columns.)
CREATE OR REPLACE FUNCTION protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'role cannot be changed directly';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON profiles;
CREATE TRIGGER trg_protect_profile_role
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_profile_role();

-- Whether to send an optional email to this address. Defaults to yes (guests and
-- people without an account have no preference). Used by send-email.
CREATE OR REPLACE FUNCTION email_notifications_enabled(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (p.notification_prefs->>'email')::boolean
       FROM profiles p JOIN auth.users u ON u.id = p.id
      WHERE lower(u.email) = lower(p_email)
      LIMIT 1),
    TRUE
  );
$$;
REVOKE ALL ON FUNCTION email_notifications_enabled(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION email_notifications_enabled(TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- painters: let a painter edit their own listing, but not who they are or
-- whether they're approved.
-- ---------------------------------------------------------------------------
ALTER TABLE painters ADD COLUMN IF NOT EXISTS bio TEXT;

DROP POLICY IF EXISTS "Painters update own row" ON painters;
CREATE POLICY "Painters update own row" ON painters
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Replaces the earlier status/verified-only guard. Client writes may not touch
-- approval state, ownership, review bookkeeping, or the vetted credentials
-- (license / insurance / bond / workers' comp / certifications): changing those
-- after approval would undo the verification, so they change via the admin
-- review flow, not from the profile page. The email column follows the auth
-- account (see sync_painter_email below).
CREATE OR REPLACE FUNCTION protect_painter_approval_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.verified IS DISTINCT FROM OLD.verified
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.application_tasks IS DISTINCT FROM OLD.application_tasks
     OR NEW.admin_message IS DISTINCT FROM OLD.admin_message
     OR NEW.last_reminder_at IS DISTINCT FROM OLD.last_reminder_at
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR NEW.has_license IS DISTINCT FROM OLD.has_license
     OR NEW.license_number IS DISTINCT FROM OLD.license_number
     OR NEW.license_state IS DISTINCT FROM OLD.license_state
     OR NEW.license_expiration IS DISTINCT FROM OLD.license_expiration
     OR NEW.is_bonded IS DISTINCT FROM OLD.is_bonded
     OR NEW.bonding_company IS DISTINCT FROM OLD.bonding_company
     OR NEW.bond_amount IS DISTINCT FROM OLD.bond_amount
     OR NEW.is_insured IS DISTINCT FROM OLD.is_insured
     OR NEW.insurance_company IS DISTINCT FROM OLD.insurance_company
     OR NEW.policy_number IS DISTINCT FROM OLD.policy_number
     OR NEW.coverage_amount IS DISTINCT FROM OLD.coverage_amount
     OR NEW.has_workers_comp IS DISTINCT FROM OLD.has_workers_comp
     OR NEW.workers_comp_carrier IS DISTINCT FROM OLD.workers_comp_carrier
     OR NEW.certifications IS DISTINCT FROM OLD.certifications
     OR NEW.other_certification IS DISTINCT FROM OLD.other_certification THEN
    RAISE EXCEPTION 'these fields cannot be modified directly';
  END IF;
  RETURN NEW;
END;
$$;

-- Keep painters.email (where job emails go) in step with the login email when it
-- changes after the user confirms the new address.
CREATE OR REPLACE FUNCTION sync_painter_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.painters SET email = NEW.email WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_painter_email ON auth.users;
CREATE TRIGGER trg_sync_painter_email
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_painter_email();

-- ---------------------------------------------------------------------------
-- Portfolio
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS painter_portfolio (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  painter_id UUID NOT NULL REFERENCES painters(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_painter_portfolio_painter ON painter_portfolio(painter_id, created_at DESC);
ALTER TABLE painter_portfolio ENABLE ROW LEVEL SECURITY;

-- Anyone can see an approved painter's portfolio; painters always see their own.
DROP POLICY IF EXISTS "portfolio visible for approved painters" ON painter_portfolio;
CREATE POLICY "portfolio visible for approved painters" ON painter_portfolio
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM painters p WHERE p.id = painter_id AND p.verified = TRUE AND p.status = 'approved'));

DROP POLICY IF EXISTS "painters read own portfolio" ON painter_portfolio;
CREATE POLICY "painters read own portfolio" ON painter_portfolio
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM painters p WHERE p.id = painter_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "painters add to own portfolio" ON painter_portfolio;
CREATE POLICY "painters add to own portfolio" ON painter_portfolio
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM painters p WHERE p.id = painter_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "painters edit own portfolio" ON painter_portfolio;
CREATE POLICY "painters edit own portfolio" ON painter_portfolio
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM painters p WHERE p.id = painter_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM painters p WHERE p.id = painter_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "painters delete from own portfolio" ON painter_portfolio;
CREATE POLICY "painters delete from own portfolio" ON painter_portfolio
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM painters p WHERE p.id = painter_id AND p.user_id = auth.uid()));

-- Public bucket (images are shown on listings); writes limited to your own folder.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('painter-portfolio', 'painter-portfolio', TRUE, 8388608, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "painters upload own portfolio images" ON storage.objects;
CREATE POLICY "painters upload own portfolio images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'painter-portfolio' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "painters delete own portfolio images" ON storage.objects;
CREATE POLICY "painters delete own portfolio images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'painter-portfolio' AND (storage.foldername(name))[1] = auth.uid()::text);
