## Native touches (all wired and synced)

- **Haptics:** buttons, successes and errors use the phone's haptic engine (`src/lib/haptics.ts`); browsers keep the vibration fallback.
- **Status bar and launch screen** match the site (light or dark theme); the launch screen goes away once the page is up (`src/lib/native.ts`).
- **Payments and documents** open in the phone's browser sheet, not inside the app window (`goToCheckout`, `openExternal`). After paying, closing the sheet returns to the app and the booking page refreshes itself.
- **Links from emails opening the app** (confirm job, choose painter, accept offer, review, sign-in...). The app side is done: Android App Links (intent filters in the manifest), iOS Associated Domains (`ios/App/App/App.entitlements`), the app's own address `com.thepaintedpainter.app://`, and routing of a received link to the right page (`NativeLinks` in `src/App.tsx`). The website side needs two real values in `public/.well-known/`:
  - `apple-app-site-association`: replace `REPLACE_WITH_TEAM_ID` with your Apple Team ID (developer.apple.com > Membership).
  - `assetlinks.json`: replace `REPLACE_WITH_SHA256_OF_THE_PLAY_SIGNING_KEY` with the SHA-256 fingerprint of the app signing key (Play Console > Setup > App signing).

  Both files must be served at `https://thepaintedpainter.com/.well-known/...` with no redirect. Until they are filled in, emailed links simply open in the browser as before. Associated Domains needs a paid Apple Developer team (a free personal team cannot build with it: remove the entitlement for free-team test builds).
- **iOS privacy manifest** (`ios/App/App/PrivacyInfo.xcprivacy`, already added to the Xcode project) and a **privacy policy page** at `/privacy` (linked in the footer; edit the text if your practices differ). Use `https://thepaintedpainter.com/privacy` as the store listings' privacy URL.

## Still needs accounts or decisions

- **Native push notifications.** Inside the apps the web-push card is hidden. Real phone push needs a Firebase project
  (`google-services.json`, Android) and an Apple push key (APNs, iOS) plus the `@capacitor/push-notifications` plugin and
  a small server change to send to those tokens. (Emails and in-app notices still work.)
- **Store listings.** Both stores need screenshots and a description. In-app account deletion (Apple requires it) exists under Settings.
- **Reviewer login.** Give the store reviewers a customer test account and a painter test account in the review notes.
- **Google Maps key.** Inside the app the pages come from `https://localhost` / `capacitor://localhost`. If the Maps key is restricted to the website, add those two as allowed referrers (or use an app key restricted by API only).
