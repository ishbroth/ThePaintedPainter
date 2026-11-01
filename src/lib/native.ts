// Everything that differs between the website and the iOS / Android app (Capacitor): opening links and checkout in the phone's browser sheet, links from
// emails opening inside the app, coming back to the app, the status bar and the launch screen. Each does the web thing in a browser and the native thing in the app.

import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { isNativeApp } from './platform';

/** The custom address that also opens the app (the website's links open it too, once the app's link settings are verified; see docs/mobile-apps.md). */
export const APP_SCHEME = 'com.thepaintedpainter.app';
const SITE_HOSTS = ['thepaintedpainter.com', 'www.thepaintedpainter.com'];

/**
 * Opens a link outside the app: a browser sheet over the app on a phone, a new tab on the web. Returns false if the browser blocked it.
 * Leaving the app itself for a web page (a card checkout, say) would strand the person on a page with no way back, so the app never does that.
 */
export async function openExternal(url: string): Promise<boolean> {
  if (isNativeApp()) {
    try {
      await Browser.open({ url });
      return true;
    } catch {
      return false;
    }
  }
  return !!window.open(url, '_blank', 'noopener');
}

/** Sends the person to a payment page: a browser sheet in the app (they come back to the app when they close it), the same window on the web. */
export async function goToCheckout(url: string): Promise<void> {
  if (isNativeApp()) await Browser.open({ url });
  else window.location.href = url;
}

/** The page inside the app for a link that opened it (an emailed link on the site, or the app's own address), or null if it is not ours. */
export function routeFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol === `${APP_SCHEME}:`) {
      const path = `/${u.host}${u.pathname}`.replace(/\/+$/, '');
      return `${path || '/'}${u.search}${u.hash}`;
    }
    if ((u.protocol === 'https:' || u.protocol === 'http:') && SITE_HOSTS.includes(u.hostname)) return `${u.pathname}${u.search}${u.hash}` || '/';
  } catch { /* not a link */ }
  return null;
}

/** Calls back with a link that opened the app. Returns the way to stop listening. */
export function onAppUrl(callback: (url: string) => void): () => void {
  if (!isNativeApp()) return () => {};
  const handle = App.addListener('appUrlOpen', (event) => callback(event.url));
  return () => { void handle.then((h) => h.remove()); };
}

/** Calls back when the app returns to the front (from the browser sheet after paying, or from the home screen). Returns the way to stop listening. */
export function onResume(callback: () => void): () => void {
  if (isNativeApp()) {
    const handle = App.addListener('appStateChange', (state) => { if (state.isActive) callback(); });
    return () => { void handle.then((h) => h.remove()); };
  }
  const visible = () => { if (!document.hidden) callback(); };
  document.addEventListener('visibilitychange', visible);
  return () => document.removeEventListener('visibilitychange', visible);
}

/** The status bar follows the site's light or dark theme (dark text on the light site, light text on the dark one). */
export async function syncStatusBar(theme: 'light' | 'dark'): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await StatusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({ color: theme === 'dark' ? '#111111' : '#ffffff' }); // Android only; iOS draws the page under the bar
  } catch { /* a status bar this device cannot change */ }
}

/** Called once the page is up: the launch screen goes away. */
export async function startNative(): Promise<void> {
  if (!isNativeApp()) return;
  try { await SplashScreen.hide({ fadeOutDuration: 250 }); } catch { /* already hidden */ }
}
