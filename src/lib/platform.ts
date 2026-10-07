import { Capacitor } from '@capacitor/core';

/** True inside the iOS / Android app (the Capacitor shell), false in a normal browser. */
export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

/**
 * The public address of the website. Inside the app the page is served from an internal address
 * (https://localhost), which is useless in an emailed link, so links that leave the app (password
 * reset, etc.) must use the real site instead.
 */
export const publicSiteUrl = (): string => (isNativeApp() ? 'https://thepaintedpainter.com' : window.location.origin);
