import { useEffect, useRef } from 'react';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { supabase } from '../lib/supabase';

/**
 * Bridges theme (local-only) and auth (account) state: applies a signed-in
 * user's saved theme_preference once per sign-in, and persists any toggle
 * they make afterward back to their profile, so the choice follows them
 * across devices. Logged-out/guest visitors are untouched — they keep the
 * existing localStorage-only behavior in ThemeProvider.
 *
 * Renders nothing; mounted once inside both providers purely to wire them
 * together.
 */
export function ThemeAccountSync() {
  const { user, profile } = useAuth();
  const { theme, setTheme } = useTheme();
  const appliedForUserRef = useRef<string | null>(null);
  const suppressNextPersistRef = useRef(false);

  // Apply the account's saved preference once per sign-in — not on every
  // profile refetch, so it can't fight a toggle made moments later in the
  // same session.
  useEffect(() => {
    if (!user || !profile) {
      appliedForUserRef.current = null;
      return;
    }
    if (appliedForUserRef.current === user.id) return;
    appliedForUserRef.current = user.id;
    if (
      (profile.theme_preference === 'light' || profile.theme_preference === 'dark') &&
      profile.theme_preference !== theme
    ) {
      suppressNextPersistRef.current = true;
      setTheme(profile.theme_preference);
    }
  }, [user, profile, theme, setTheme]);

  // Persist subsequent toggles back to the account — skipped exactly once
  // right after the apply-from-profile above, so that doesn't immediately
  // write the same value straight back.
  useEffect(() => {
    if (!user) return;
    if (suppressNextPersistRef.current) {
      suppressNextPersistRef.current = false;
      return;
    }
    supabase
      .from('profiles')
      .update({ theme_preference: theme })
      .eq('id', user.id)
      .then(({ error }) => {
        if (error) console.error('Failed to save theme preference:', error.message);
      });
  }, [theme, user]);

  return null;
}
