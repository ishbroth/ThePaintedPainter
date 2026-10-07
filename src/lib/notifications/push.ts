import { supabase } from '../supabase';
import { isNativeApp } from '../platform';

// Public half of the VAPID key pair; the private half is a Supabase secret
// used by the send side (supabase/functions/_shared/notify.ts).
export const VAPID_PUBLIC_KEY = 'BEkZ1gISddFRAyOkSh9F0_0dGe0LnwjFJeXm2RpIy_QB4NTXECjG1JmPV3kDDu-KWYifW6eN9v8fXcm3fAfdPUw';

export type PushState = 'unsupported' | 'needs-install' | 'default' | 'granted' | 'denied';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

export function registerServiceWorker(): void {
  // The service worker is only for web push; the native apps will use native push (not set up yet).
  if (!isNativeApp() && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => console.error('SW registration failed:', err));
    });
  }
}

export function getPushState(): PushState {
  // Web push doesn't apply inside the iOS/Android app. Hiding the card avoids a wrong "Add to Home Screen" prompt.
  if (isNativeApp()) return 'unsupported';
  // iOS only exposes web push to sites installed to the Home Screen.
  if (isIos() && !isStandalone()) return 'needs-install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  return Notification.permission as PushState;
}

async function saveSubscription(userId: string, sub: PushSubscription): Promise<void> {
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;
  await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent.slice(0, 200),
    },
    { onConflict: 'endpoint' },
  );
}

/** Must be called from a user gesture (a button tap) — iOS and most browsers require it. */
export async function enablePush(userId: string): Promise<PushState> {
  const state = getPushState();
  if (state === 'unsupported' || state === 'needs-install') return state;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission as PushState;

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const sub =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    }));
  await saveSubscription(userId, sub);
  return 'granted';
}

/** If the user already allowed push, make sure this device's subscription is on the server (covers new logins / rotated endpoints). */
export async function syncPushSubscription(userId: string): Promise<void> {
  if (getPushState() !== 'granted') return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    if (sub) await saveSubscription(userId, sub);
  } catch (err) {
    console.error('push sync failed:', err);
  }
}
