/**
 * Haptic feedback utility for native-like mobile experience.
 * Uses the Vibration API on supported devices (Android Chrome).
 * Falls back silently on unsupported platforms (iOS Safari, desktop).
 */

const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;

/**
 * Light tap — button presses, toggles, tab switches
 */
export function hapticLight() {
  if (canVibrate) navigator.vibrate(10);
}

/**
 * Medium tap — form submissions, successful actions, navigation
 */
export function hapticMedium() {
  if (canVibrate) navigator.vibrate(25);
}

/**
 * Heavy tap — important confirmations, errors, destructive actions
 */
export function hapticHeavy() {
  if (canVibrate) navigator.vibrate(50);
}

/**
 * Success pattern — double pulse for completed actions
 */
export function hapticSuccess() {
  if (canVibrate) navigator.vibrate([15, 50, 15]);
}

/**
 * Error pattern — long buzz for errors/failures
 */
export function hapticError() {
  if (canVibrate) navigator.vibrate([80, 30, 80]);
}

/**
 * Notification pattern — attention-grabbing triple pulse
 */
export function hapticNotification() {
  if (canVibrate) navigator.vibrate([10, 40, 10, 40, 10]);
}

/**
 * Selection changed — very subtle tick
 */
export function hapticTick() {
  if (canVibrate) navigator.vibrate(5);
}
