-- An email that was signed up but never confirmed is not an account.
--
-- Supabase keeps unconfirmed sign-ups forever, which meant an abandoned customer
-- sign-up blocked that email from ever applying as a painter. Now only
-- CONFIRMED accounts count as "already exists", and when a painter confirms
-- their email, any stale unconfirmed account for that address is cleared first.

CREATE OR REPLACE FUNCTION auth_email_exists(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE lower(email) = lower(p_email) AND email_confirmed_at IS NOT NULL
  );
$$;

-- Removes a never-confirmed auth user (and its cascade: profile etc.) so the
-- address can be used again. Refuses to touch a confirmed account.
CREATE OR REPLACE FUNCTION drop_unconfirmed_auth_user(p_email TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM auth.users
  WHERE lower(email) = lower(p_email) AND email_confirmed_at IS NULL;
$$;

REVOKE ALL ON FUNCTION drop_unconfirmed_auth_user(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION drop_unconfirmed_auth_user(TEXT) TO service_role;
