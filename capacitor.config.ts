import type { CapacitorConfig } from '@capacitor/cli';

// Native iOS / Android shells around the web app. The built site (dist/) is bundled inside the app and
// served from https://localhost, so the app works offline-first and API calls (Supabase) go out over HTTPS.
// Rebuild + copy into the native projects with:  npm run mobile:sync
const config: CapacitorConfig = {
  appId: 'com.paintedpainter.app',
  appName: 'The Painted Painter',
  webDir: 'dist',
  server: {
    // Use https for the in-app origin so cookies/storage and mixed-content rules behave like the real site.
    androidScheme: 'https',
  },
  ios: {
    // Let the web layout handle the notch / home indicator (the site already uses viewport-fit=cover).
    contentInset: 'never',
    backgroundColor: '#fdf9f2',
  },
  android: {
    backgroundColor: '#fdf9f2',
  },
  plugins: {
    // the launch screen stays until the page is up (src/lib/native.ts hides it)
    SplashScreen: { launchAutoHide: false, backgroundColor: '#d9e0f3', showSpinner: false },
    StatusBar: { style: 'LIGHT', backgroundColor: '#ffffff' },
  },
};

export default config;
