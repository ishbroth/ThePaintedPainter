-- Harden anonymous painter sign-up.
--
-- The original policy let any anonymous client insert a painters row with any
-- column values (including status='approved', verified=true), which would let
-- someone approve themselves and start receiving job offers. Sign-up inserts
-- must always land as an unverified, pending application tied to a real auth
-- user, one painter row per user.

CREATE UNIQUE INDEX IF NOT EXISTS idx_painters_user_id_unique
  ON painters(user_id) WHERE user_id IS NOT NULL;

-- anon can't read auth.users directly, so expose just an existence check.
CREATE OR REPLACE FUNCTION auth_user_exists(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id);
$$;
REVOKE ALL ON FUNCTION auth_user_exists(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_user_exists(UUID) TO anon, authenticated;

DROP POLICY IF EXISTS "Allow anonymous inserts on painters" ON painters;
DROP POLICY IF EXISTS "Anonymous painter applications start pending" ON painters;
DROP POLICY IF EXISTS "Authenticated painter applications start pending" ON painters;

CREATE POLICY "Anonymous painter applications start pending" ON painters
  FOR INSERT TO anon
  WITH CHECK (
    status = 'pending'
    AND verified = false
    AND user_id IS NOT NULL
    AND auth_user_exists(user_id)
  );

-- Same for the authenticated path (used if email confirmation is ever turned
-- off, since sign-up would then return a session): only for your own user id.
CREATE POLICY "Authenticated painter applications start pending" ON painters
  FOR INSERT TO authenticated
  WITH CHECK (
    status = 'pending'
    AND verified = false
    AND user_id = auth.uid()
  );

-- Defense in depth: no direct client write may change approval state, whatever
-- UPDATE policies exist or get added later. Approval is done by an admin
-- (service role / SQL editor), which runs as a non-client role.
CREATE OR REPLACE FUNCTION protect_painter_approval_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.verified IS DISTINCT FROM OLD.verified THEN
    RAISE EXCEPTION 'approval fields cannot be modified directly';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_painter_approval_columns ON painters;
CREATE TRIGGER trg_protect_painter_approval_columns
  BEFORE UPDATE ON painters
  FOR EACH ROW
  EXECUTE FUNCTION protect_painter_approval_columns();
