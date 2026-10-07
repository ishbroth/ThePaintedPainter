# The Painted Painter: iOS and Android apps

The apps are the website wrapped in a native shell with [Capacitor](https://capacitorjs.com). The built site
(`dist/`) is bundled inside each app, so there is one codebase. Change the website, re-sync, rebuild the apps.

| Thing | Where |
|---|---|
| App id (both platforms) | `com.thepaintedpainter.app` (in `capacitor.config.ts`) |
| Android project | `android/` |
| iOS project | `ios/` (opens in Xcode, no CocoaPods needed: it uses Swift Package Manager) |
| Icon + splash sources | `resources/` |

## After you change the website

```
npm run mobile:sync        # builds the site and copies it into android/ and ios/
```

## Android (works on Windows)

You need Android Studio (already installed). Capacitor 8 needs **Java 21**; Android Studio bundles it
(`C:\Program Files\Android\Android Studio\jbr`). The machine's default Java is 17, so either build from Android
Studio (it uses its own) or set `JAVA_HOME` to that folder for command-line builds.

**Run / debug:** `npm run mobile:android` (opens Android Studio), pick a device or emulator, press Run.

**Debug APK from the command line** (installable on a phone with "install unknown apps" turned on):

```
cd android
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
gradlew.bat assembleDebug
```

The APK ends up in `android/app/build/outputs/apk/debug/app-debug.apk`.

**Play Store release:** the Play Store needs a signed `.aab` (Android App Bundle).
1. Make a signing key ONCE and back it up somewhere safe. If you lose it you can never update the app:
   `keytool -genkey -v -keystore thepaintedpainter-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias release`
2. In Android Studio: Build > Generate Signed App Bundle, choose that key. (Or add a `signingConfigs` block to
   `android/app/build.gradle` and run `gradlew.bat bundleRelease`.)
3. Raise `versionCode` (a whole number, must go up with every upload) and `versionName` in `android/app/build.gradle`.
4. Upload the `.aab` in the Play Console (a $25 one-time developer account is required).

## iOS (needs a Mac with Xcode 16 or newer)

Apple only lets you build iOS apps on a Mac. The `ios/` project is ready:

1. Pull this repo on the Mac, then `npm install` and `npm run mobile:sync`.
2. `npm run mobile:ios` (or open `ios/App/App.xcodeproj` in Xcode). Xcode downloads the Capacitor package on first open.
   You do **not** need CocoaPods for this project.
3. Select the **App** target > Signing & Capabilities > pick your Team (a paid Apple Developer account, $99/year, is
   needed to put it on the App Store; a free one can run it on your own phone).
4. Run on a simulator or phone. To publish: Product > Archive > Distribute App > App Store Connect.
5. Raise the **Build** number in Xcode for every upload; **Version** is what users see.

Already set: camera and photo-library permission text (the photo uploads need it), bundle id, icons, splash.

## Icon and splash

`resources/` holds a **temporary** icon (a paint roller on brand blue). To use your real logo, replace
`resources/icon-only.png` (1024x1024), `icon-foreground.png`, `icon-background.png`, `splash.png` and
`splash-dark.png` (2732x2732), then run `npm run mobile:icons` and `npm run mobile:sync`.

The photo in `public/IMG_7201.PNG` (the website's current icon) is a collage with a license number and a hero
costume that closely resembles a Superman costume. Apple and Google both reject icons and screenshots that look like
someone else's trademark, so it's best not to use it as the store icon.

## Not done yet (needs accounts or decisions)

- **Native push notifications.** Inside the apps the web-push card is hidden. Real phone push needs a Firebase project
  (`google-services.json`, Android) and an Apple push key (APNs, iOS) plus the `@capacitor/push-notifications` plugin and
  a small server change to send to those tokens.
- **Opening email links in the app.** Links in emails (confirm job, accept offer, etc.) open in the browser. Opening
  them in the app needs Android App Links (`assetlinks.json` on the website) and iOS Universal Links
  (`apple-app-site-association`), plus the matching app settings.
- **Payment return.** Stripe Checkout opens in the phone's browser; after paying, the customer returns to the website,
  and the job shows as confirmed when they reopen the app.
- **Store listings.** Both stores need a privacy-policy URL, screenshots, and a description. In-app account deletion
  (Apple requires it) already exists under Settings.
