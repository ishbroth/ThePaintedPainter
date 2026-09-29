-- =============================================
-- Account-level theme preference
-- =============================================
-- Light/dark mode was localStorage-only (per browser). Adding this so a
-- signed-in user's choice follows them across devices — applied once on
-- sign-in, and updated whenever they toggle while signed in. Logged-out /
-- guest visitors keep the existing localStorage-only behavior.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS theme_preference TEXT CHECK (theme_preference IN ('light', 'dark'));

COMMENT ON COLUMN profiles.theme_preference IS
  'Signed-in user''s light/dark mode choice, applied on sign-in across devices. NULL = no preference saved yet (falls back to localStorage/default).';
