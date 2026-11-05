// Signing in with the phone's Face ID (or Touch ID, or the fingerprint or face unlock on Android). The app never sees anyone's face and cannot tell who a face
// belongs to: the phone only says "the person holding me passed". So a sign-in is saved in the phone's secure storage, locked behind that check, after a normal
// sign-in the person agreed to; next time the check unlocks it. Only accounts that were signed in on this phone with this switched on can be offered, and a person
// with both a customer and a painter account here is asked which one.

import { AccessControl, BiometricAuthError, BiometryType, NativeBiometric } from '@capgo/capacitor-native-biometric';
import { isNativeApp } from './platform';

export type SavedRole = 'painter' | 'customer' | 'admin';
export interface SavedAccount { email: string; role: SavedRole }

const LIST = 'thepaintedpainter:faceid:accounts';
const serverFor = (email: string): string => `thepaintedpainter.com/${email.trim().toLowerCase()}`;

/** What to call the check on this phone ("FACE ID", "TOUCH ID"), or null when the phone has none set up (or this is a browser). */
export async function faceIdName(): Promise<string | null> {
  if (!isNativeApp()) return null;
  try {
    const r = await NativeBiometric.isAvailable({ useFallback: false });
    if (!r.isAvailable) return null;
    return r.biometryType === BiometryType.FACE_ID ? 'Face ID' : r.biometryType === BiometryType.TOUCH_ID ? 'Touch ID' : 'fingerprint or face unlock';
  } catch {
    return null;
  }
}

/** The accounts that have a sign-in saved behind the phone's check (this list is not secret; the passwords are in the phone's secure storage). */
export function savedFaceIds(): SavedAccount[] {
  try {
    const list = JSON.parse(localStorage.getItem(LIST) ?? '[]') as unknown;
    return Array.isArray(list) ? list.filter((a): a is SavedAccount => !!a && typeof (a as SavedAccount).email === 'string' && typeof (a as SavedAccount).role === 'string') : [];
  } catch {
    return [];
  }
}
const remember = (accounts: SavedAccount[]) => {
  const seen = new Set<string>();
  const unique = accounts.filter((a) => (seen.has(a.email) ? false : (seen.add(a.email), true)));
  try { localStorage.setItem(LIST, JSON.stringify(unique)); } catch { /* not remembered */ }
};

/** Saves a sign-in behind the phone's check. True if it was saved. */
export async function saveFaceId(email: string, password: string, role: SavedRole): Promise<boolean> {
  const who = email.trim().toLowerCase();
  try {
    await NativeBiometric.setCredentials({ username: who, password, server: serverFor(who), accessControl: AccessControl.BIOMETRY_ANY });
    remember([...savedFaceIds().filter((a) => a.email !== who), { email: who, role }]);
    return true;
  } catch {
    return false;
  }
}

/** Asks the phone to check the person and gives back what was saved: 'cancelled' if they backed out or it did not match, null if nothing usable is saved. */
export async function readFaceId(email: string): Promise<{ email: string; password: string } | 'cancelled' | null> {
  try {
    const c = await NativeBiometric.getSecureCredentials({ server: serverFor(email), reason: 'Sign in to The Painted Painter', title: 'Sign in to The Painted Painter' });
    return { email: c.username, password: c.password };
  } catch (e) {
    const code = Number((e as { code?: string | number }).code);
    if (code === BiometricAuthError.NO_PROTECTED_CREDENTIALS_FOUND) { remember(savedFaceIds().filter((a) => a.email !== email.trim().toLowerCase())); return null; }
    return 'cancelled';
  }
}

/** Forgets the saved sign-in of one email, or of every account on this phone. */
export async function forgetFaceId(email?: string): Promise<void> {
  const targets = email ? [email.trim().toLowerCase()] : savedFaceIds().map((a) => a.email);
  for (const e of targets) {
    try { await NativeBiometric.deleteCredentials({ server: serverFor(e) }); } catch { /* it was already gone */ }
  }
  remember(savedFaceIds().filter((a) => !targets.includes(a.email)));
}

// ---- offering it after a sign-in ----

const OFFER = 'thepaintedpainter:faceid-offer';
export interface FaceIdOffer { email: string; password: string; role: SavedRole }
/** Called after a sign-in with a password worked: if the phone can do it, the app asks whether to use it next time. */
export function offerFaceId(offer: FaceIdOffer): void {
  if (isNativeApp()) window.dispatchEvent(new CustomEvent(OFFER, { detail: offer }));
}
export function onFaceIdOffer(callback: (offer: FaceIdOffer) => void): () => void {
  const handler = (e: Event) => callback((e as CustomEvent<FaceIdOffer>).detail);
  window.addEventListener(OFFER, handler);
  return () => window.removeEventListener(OFFER, handler);
}
