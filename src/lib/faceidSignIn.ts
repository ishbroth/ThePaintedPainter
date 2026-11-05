import { useCallback } from 'react';
import { useAuth } from './auth';
import { forgetFaceId, readFaceId, type SavedAccount } from './faceid';

export interface FaceIdResult { ok: boolean; /** The person backed out, or the check did not match: say nothing. */ cancelled?: boolean; message?: string }

/** Signs in to one saved account: the phone checks the person, and what was saved for that account is used to sign in. */
export function useFaceIdSignIn(): (account: SavedAccount) => Promise<FaceIdResult> {
  const { signIn } = useAuth();
  return useCallback(async (account: SavedAccount) => {
    const saved = await readFaceId(account.email);
    if (saved === 'cancelled') return { ok: false, cancelled: true };
    if (!saved) return { ok: false, message: 'No sign-in is saved for that account on this phone. Sign in with your email and password.' };
    const { error } = await signIn(saved.email, saved.password);
    if (error) {
      await forgetFaceId(account.email); // what was saved no longer works (the password changed): do not keep offering it
      return { ok: false, message: 'That saved sign-in no longer works (the password may have changed). Sign in with your email and password.' };
    }
    return { ok: true };
  }, [signIn]);
}
