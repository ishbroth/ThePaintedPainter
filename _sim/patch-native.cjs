const fs = require('fs');
const rd = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const crlfOf = (p) => fs.readFileSync(p, 'utf8').includes('\r\n');
const wr = (p, s) => fs.writeFileSync(p, crlfOf(p) ? s.replace(/\n/g, '\r\n') : s);
const rep = (s, a, b, label) => { if (!s.includes(a)) throw new Error('missing: ' + label); return s.replace(a, () => b); };

// native.ts: tidy the custom-address route
let p = 'src/lib/native.ts';
let s = rd(p);
s = rep(s, "    if (u.protocol === `${APP_SCHEME}:`) return `/${u.host}${u.pathname}`.replace(/\\/+$/, '').replace(/^\\/\\//, '/') + u.search + u.hash || '/';", "    if (u.protocol === `${APP_SCHEME}:`) {\n      const path = `/${u.host}${u.pathname}`.replace(/\\/+$/, '');\n      return `${path || '/'}${u.search}${u.hash}`;\n    }", 'route');
wr(p, s);

// ThemeProvider: the status bar follows the theme
p = 'src/lib/theme/ThemeProvider.tsx';
s = rd(p);
s = rep(s, "import { ThemeContext, type Theme } from './ThemeContext';", "import { ThemeContext, type Theme } from './ThemeContext';\nimport { syncStatusBar } from '../native';", 'theme imp');
s = rep(s, "    document.documentElement.setAttribute('data-theme', theme);\n", "    document.documentElement.setAttribute('data-theme', theme);\n    void syncStatusBar(theme);\n", 'theme effect');
wr(p, s);

// main.tsx
p = 'src/main.tsx';
s = rd(p);
s = rep(s, "import { registerServiceWorker } from './lib/notifications/push'\n", "import { registerServiceWorker } from './lib/notifications/push'\nimport { startNative } from './lib/native'\n", 'main imp');
s = rep(s, "registerServiceWorker()\n", "registerServiceWorker()\nvoid startNative()\n", 'main start');
wr(p, s);

// App.tsx: links that open the app, the privacy page
p = 'src/App.tsx';
s = rd(p);
s = rep(s, "import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';", "import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';\nimport { useEffect } from 'react';\nimport { onAppUrl, routeFromUrl } from './lib/native.ts';\nimport Privacy from './pages/Privacy.tsx';", 'app imp');
s = rep(s, "          <ThemeAccountSync />\n", "          <ThemeAccountSync />\n          <NativeLinks />\n", 'app mount');
s = rep(s, '                <Route path="/support" element={<Support />} />', '                <Route path="/support" element={<Support />} />\n                <Route path="/privacy" element={<Privacy />} />', 'route');
// the component, before the first "function App" / "const App"
const idx = s.search(/\n(function|const) App\b/);
if (idx < 0) throw new Error('App marker');
s = s.slice(0, idx) + `
/** In the iOS / Android app, a link that opens the app (an emailed link on the site) goes to the matching page inside it. */
function NativeLinks() {
  const navigate = useNavigate();
  useEffect(() => onAppUrl((url) => { const path = routeFromUrl(url); if (path) navigate(path); }), [navigate]);
  return null;
}
` + s.slice(idx);
wr(p, s);

// Footer: privacy link
p = 'src/components/Footer.tsx';
s = rd(p);
s = rep(s, '        <Link to="/support">Support</Link>', '        <Link to="/support">Support</Link>\n        <Link to="/privacy">Privacy</Link>', 'footer');
wr(p, s);

// checkout and documents leave the app through the browser sheet
p = 'src/pages/ConfirmJob.tsx';
s = rd(p);
s = rep(s, "      window.location.href = url;", "      await goToCheckout(url);", 'checkout');
s = rep(s, "import { createDepositCheckout } from '../lib/payments/stripe';", "import { createDepositCheckout } from '../lib/payments/stripe';\nimport { goToCheckout, onResume } from '../lib/native';", 'cj imp');
s = rep(s, "  useEffect(() => { load(); }, [load]);", "  useEffect(() => { load(); }, [load]);\n  // back from paying in the browser sheet (the app): show the booking as it now stands\n  useEffect(() => onResume(() => { void load(); }), [load]);", 'resume');
wr(p, s);
p = 'src/lib/contracts.ts';
s = rd(p);
s = rep(s, "  window.open(url, '_blank', 'noopener');", "  await openExternal(url);", 'contract open');
const ci = s.indexOf('import ');
s = s.slice(0, ci) + "import { openExternal } from './native';\n" + s.slice(ci);
wr(p, s);

// capacitor.config.ts
p = 'capacitor.config.ts';
s = rd(p);
s = rep(s, "  android: {\n    backgroundColor: '#fdf9f2',\n  },\n};", "  android: {\n    backgroundColor: '#fdf9f2',\n  },\n  plugins: {\n    // the launch screen stays until the page is up (src/lib/native.ts hides it)\n    SplashScreen: { launchAutoHide: false, backgroundColor: '#fdf9f2', showSpinner: false },\n    StatusBar: { style: 'LIGHT', backgroundColor: '#ffffff' },\n  },\n};", 'config');
wr(p, s);

// Android: links that open the app
p = 'android/app/src/main/AndroidManifest.xml';
s = rd(p);
s = rep(s, '                <category android:name="android.intent.category.LAUNCHER" />\n            </intent-filter>\n', `                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

            <!-- links on the website open the app (verified through https://thepaintedpainter.com/.well-known/assetlinks.json) -->
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="thepaintedpainter.com" />
                <data android:scheme="https" android:host="www.thepaintedpainter.com" />
            </intent-filter>
            <!-- the app's own address -->
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="com.thepaintedpainter.app" />
            </intent-filter>
`, 'android intent');
wr(p, s);

// iOS: the app's own address, Associated Domains (links on the website open the app), and the privacy manifest
p = 'ios/App/App/Info.plist';
s = rd(p);
if (!s.includes('CFBundleURLTypes')) s = rep(s, '\t<key>ITSAppUsesNonExemptEncryption</key>', '\t<key>CFBundleURLTypes</key>\n\t<array>\n\t\t<dict>\n\t\t\t<key>CFBundleURLName</key>\n\t\t\t<string>com.thepaintedpainter.app</string>\n\t\t\t<key>CFBundleURLSchemes</key>\n\t\t\t<array>\n\t\t\t\t<string>com.thepaintedpainter.app</string>\n\t\t\t</array>\n\t\t</dict>\n\t</array>\n\t<key>ITSAppUsesNonExemptEncryption</key>', 'plist');
wr(p, s);
fs.writeFileSync('ios/App/App/App.entitlements', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>com.apple.developer.associated-domains</key>
\t<array>
\t\t<string>applinks:thepaintedpainter.com</string>
\t\t<string>applinks:www.thepaintedpainter.com</string>
\t</array>
</dict>
</plist>
`);
const dataType = (type) => `\t\t<dict>\n\t\t\t<key>NSPrivacyCollectedDataType</key>\n\t\t\t<string>${type}</string>\n\t\t\t<key>NSPrivacyCollectedDataTypeLinked</key>\n\t\t\t<true/>\n\t\t\t<key>NSPrivacyCollectedDataTypeTracking</key>\n\t\t\t<false/>\n\t\t\t<key>NSPrivacyCollectedDataTypePurposes</key>\n\t\t\t<array>\n\t\t\t\t<string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>\n\t\t\t</array>\n\t\t</dict>`;
const api = (type, reason) => `\t\t<dict>\n\t\t\t<key>NSPrivacyAccessedAPIType</key>\n\t\t\t<string>${type}</string>\n\t\t\t<key>NSPrivacyAccessedAPITypeReasons</key>\n\t\t\t<array>\n\t\t\t\t<string>${reason}</string>\n\t\t\t</array>\n\t\t</dict>`;
fs.writeFileSync('ios/App/App/PrivacyInfo.xcprivacy', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>NSPrivacyTracking</key>
\t<false/>
\t<key>NSPrivacyTrackingDomains</key>
\t<array/>
\t<key>NSPrivacyCollectedDataTypes</key>
\t<array>
${['NSPrivacyCollectedDataTypeName', 'NSPrivacyCollectedDataTypeEmailAddress', 'NSPrivacyCollectedDataTypePhoneNumber', 'NSPrivacyCollectedDataTypePhysicalAddress', 'NSPrivacyCollectedDataTypePhotosorVideos', 'NSPrivacyCollectedDataTypeUserID', 'NSPrivacyCollectedDataTypePurchaseHistory'].map(dataType).join('\n')}
\t</array>
\t<key>NSPrivacyAccessedAPITypes</key>
\t<array>
${api('NSPrivacyAccessedAPICategoryUserDefaults', 'CA92.1')}
${api('NSPrivacyAccessedAPICategoryFileTimestamp', 'C617.1')}
${api('NSPrivacyAccessedAPICategoryDiskSpace', 'E174.1')}
\t</array>
</dict>
</plist>
`);
p = 'ios/App/App.xcodeproj/project.pbxproj';
s = rd(p);
if (!s.includes('PrivacyInfo.xcprivacy')) {
  s = rep(s, '\t\t2FAD9763203C412B000D30F8 /* config.xml in Resources */ = {', '\t\tAA00000000000000000000A1 /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = AA00000000000000000000A2 /* PrivacyInfo.xcprivacy */; };\n\t\t2FAD9763203C412B000D30F8 /* config.xml in Resources */ = {', 'pbx build file');
  s = rep(s, '\t\t504EC30E1FED79650016851F /* Assets.xcassets */ = {isa = PBXFileReference;', '\t\tAA00000000000000000000A2 /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };\n\t\tAA00000000000000000000A4 /* App.entitlements */ = {isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = App.entitlements; sourceTree = "<group>"; };\n\t\t504EC30E1FED79650016851F /* Assets.xcassets */ = {isa = PBXFileReference;', 'pbx file ref');
  s = rep(s, '\t\t\t\t504EC30E1FED79650016851F /* Assets.xcassets */,\n', '\t\t\t\t504EC30E1FED79650016851F /* Assets.xcassets */,\n\t\t\t\tAA00000000000000000000A2 /* PrivacyInfo.xcprivacy */,\n\t\t\t\tAA00000000000000000000A4 /* App.entitlements */,\n', 'pbx group');
  s = rep(s, '\t\t\t\t504EC30F1FED79650016851F /* Assets.xcassets in Resources */,\n', '\t\t\t\t504EC30F1FED79650016851F /* Assets.xcassets in Resources */,\n\t\t\t\tAA00000000000000000000A1 /* PrivacyInfo.xcprivacy in Resources */,\n', 'pbx resources');
  // both build configurations (Debug, Release) of the App target
  s = s.split('\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com.thepaintedpainter.app;').join('\t\t\t\tCODE_SIGN_ENTITLEMENTS = App/App.entitlements;\n\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com.thepaintedpainter.app;');
  wr(p, s);
}

// the website's side of "links open the app"
fs.mkdirSync('public/.well-known', { recursive: true });
fs.writeFileSync('public/.well-known/apple-app-site-association', JSON.stringify({
  applinks: { apps: [], details: [{ appIDs: ['REPLACE_WITH_TEAM_ID.com.thepaintedpainter.app'], components: [{ '/': '/confirm-job', '?': { token: '*' } }, { '/': '/choose-painter' }, { '/': '/painter/accept-job' }, { '/': '/leave-review' }, { '/': '/cancel-claim' }, { '/': '/cancel-request' }, { '/': '/resume-search' }, { '/': '/painter/*' }, { '/': '/customer/*' }, { '/': '/auth/*' }] }] },
}, null, 2) + '\n');
fs.writeFileSync('public/.well-known/assetlinks.json', JSON.stringify([{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: 'com.thepaintedpainter.app', sha256_cert_fingerprints: ['REPLACE_WITH_SHA256_OF_THE_PLAY_SIGNING_KEY'] } }], null, 2) + '\n');
console.log('ok');
