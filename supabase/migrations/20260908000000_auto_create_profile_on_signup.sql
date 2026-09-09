-- =============================================
-- Auto-create profile row on signup
-- =============================================
-- Bug: the client called supabase.auth.signUp() and then immediately
-- inserted into public.profiles from the browser. That insert is subject to
-- RLS ("Users can insert own profile" requires auth.uid() = id), which only
-- passes if the client already has an active session. But this project (like
-- any default Supabase project) requires email confirmation before a session
-- exists — signUp() sends a confirmation email and returns a user with NO
-- session, so the very next insert ran with auth.uid() = null and was
-- rejected: "new row violates row-level security policy for table profiles".
--
-- Fix: create the profile row server-side, in a trigger on auth.users,
-- running as SECURITY DEFINER (bypasses RLS entirely, and doesn't depend on
-- the client ever having a session). This is the standard Supabase pattern
-- for this exact situation. role/display_name now travel in via
-- auth.signUp()'s options.data (raw_user_meta_data) instead of a follow-up
-- client-side insert — see AuthProvider.tsx.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer'),
    NEW.raw_user_meta_data->>'display_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
