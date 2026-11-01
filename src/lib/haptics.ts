/**
 * Haptic feedback for a native-like feel. In the iOS / Android app it is the phone's haptic engine (Taptic Engine on iPhones); in a browser it falls
 * back to the Vibration API where it exists (Android Chrome), and stays silent elsewhere (iOS Safari, desktop).
 */

import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNativeApp } from './platform';

const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;

const impact = (style: ImpactStyle) => { void Haptics.impact({ style }).catch(() => {}); };
const notify = (type: NotificationType) => { void Haptics.notification({ type }).catch(() => {}); };
const vibrate = (pattern: number | number[]) => { if (canVibrate) navigator.vibrate(pattern); };

/** Light tap: button presses, toggles, tab switches. */
export function hapticLight() {
  if (isNativeApp()) impact(ImpactStyle.Light);
  else vibrate(10);
}

/** Medium tap: form submissions, successful actions, navigation. */
export function hapticMedium() {
  if (isNativeApp()) impact(ImpactStyle.Medium);
  else vibrate(25);
}

/** Heavy tap: important confirmations, errors, destructive actions. */
export function hapticHeavy() {
  if (isNativeApp()) impact(ImpactStyle.Heavy);
  else vibrate(50);
}

/** Success pattern: completed actions. */
export function hapticSuccess() {
  if (isNativeApp()) notify(NotificationType.Success);
  else vibrate([15, 50, 15]);
}

/** Error pattern: errors and failures. */
export function hapticError() {
  if (isNativeApp()) notify(NotificationType.Error);
  else vibrate([80, 30, 80]);
}

/** Notification pattern: attention-grabbing. */
export function hapticNotification() {
  if (isNativeApp()) notify(NotificationType.Warning);
  else vibrate([10, 40, 10, 40, 10]);
}

/** Selection changed: a very subtle tick. */
export function hapticTick() {
  if (isNativeApp()) void Haptics.selectionChanged().catch(() => {});
  else vibrate(5);
}
