# Jaathiya Vaartalu – Reporter app

The mobile app for **reporters**: sign up, send news cards with photos, and follow them through review. It runs on **Android and iOS** and uses the same [API server](../jaathiya-vaartalu-backend/README.md) and MongoDB data as the other apps.

| | |
|---|---|
| App name | JV Reporter |
| Android package / iOS bundle id | `com.jaathiyavaartalu.reporter` |
| Who can sign in | Reporters only. An editor or admin who signs in is asked to use JV Admin or JV Studio instead. |
| API | `https://jaathiya-vaartalu-studio-app.onrender.com` in release builds |

**Tech:** React Native with Expo (SDK 58), React Navigation, axios, Expo SecureStore (sign-in tokens), Expo Image Picker.

## Features

- **Sign up** with name, email, phone and place (State → District → Constituency). The account starts inactive until an admin approves it.
- **My news:** every card you have sent, with its status (draft, waiting for review, sent back, approved, published) and the editor's note when one is sent back.
- **Today's quota:** how many of the day's 50 news cards you have used. The count resets at midnight IST.
- **New news card:** headline, up to 5 highlights, the news text, section, place and dateline, and up to 10 photos from the gallery or camera. Save as a draft or submit for review.
- **Edit** your own cards until they are approved.

## How this folder works

This folder holds only the app's own files: `App.js`, `app.json`, `eas.json`, `assets/` and `src/`. `./setup.sh` creates a matching Expo project in `jv-mobile/` (not committed), installs the libraries and copies these files in. **Edit the files here, not in `jv-mobile/`**, and run `./setup.sh` again to copy changes across.

## Run it on a phone (development)

Start the API on your computer first (`cd ../jaathiya-vaartalu-backend && npm run dev`), then:

```bash
./setup.sh
cd jv-mobile && npx expo start
```

Scan the QR code with **Expo Go** (Android) or the iPhone camera. The phone must be on the same Wi-Fi as the computer.

## Which server it calls

`src/config.js` picks the API in this order:

1. `EXPO_PUBLIC_API_URL`, if it was set when the app was built. The CI builds always set it.
2. Release builds: `PROD_API` (`https://jaathiya-vaartalu-studio-app.onrender.com`).
3. Development (`npx expo start`): port 4000 on the computer running Expo, found automatically. The Android emulator uses `10.0.2.2`.

Plain `http` to a computer on the local network is allowed on both platforms (Android cleartext traffic, iOS local networking), so a phone can reach a dev server such as `http://192.168.1.10:4000`.

## Builds

| Platform | GitHub workflow | Artifact |
|---|---|---|
| Android | `.github/workflows/jaathiya-vaartalu-reporter-mobile-android.yml` ("Reporter mobile – Android") | `jv-reporter-apk`: `app-release.apk`, signed with the debug key, for testing |
| iOS Simulator | `.github/workflows/jaathiya-vaartalu-reporter-mobile-ios.yml` ("Reporter mobile – iOS") | `jv-reporter-ios-simulator`: unzip and drag onto the iOS Simulator in Xcode |
| iPhone | the same iOS workflow, run by hand with **iOS device build** = `preview` or `testflight` | `jv-reporter-ios-device`: `.ipa`, signed on Expo EAS |

The builds run on every push to `main` or `feature/**` that changes this folder. The iPhone build is the exception: it runs only by hand, because each build uses Expo EAS credits. A manual run can also take an API URL.

The iPhone build needs some one-time setup: an Apple Developer account, the repository secret `EXPO_TOKEN`, and, from `jv-mobile/` after `./setup.sh`, running `npx eas-cli init` and `npx eas-cli credentials -p ios` once. The full steps are at the top of the iOS workflow.

**Build without GitHub:**

```bash
./setup.sh && cd jv-mobile
npx eas-cli build -p android --profile preview     # APK on Expo EAS
npx eas-cli build -p ios --profile preview         # iPhone build for registered devices (needs Apple signing)
npx expo run:android                               # or build on this computer (Android Studio + JDK 17)
npx expo run:ios                                   # or build on this Mac (Xcode)
```

EAS profiles (`eas.json`): `preview` (APK / ad hoc iPhone build), `simulator` (iOS Simulator), `production` (Play Store bundle / App Store build, with the build number raised each time).

## App icon

The launcher icon is the brand mark with a saffron badge with a microphone, so the three apps are easy to tell apart. `assets/` holds:

- `icon.png`: opaque, for iOS
- `adaptive-icon.png` and `monochrome-icon.png`: Android, including themed icons
- `splash-icon.png`: start-up screen
- `logo.png`: sign-in page
- `mark.png`: header

To remake the icons, run `node scripts/make-app-icons.js` in `jaathiya-vaartalu-backend`.

## Code layout

```
App.js               navigation: sign-in screens, then the app's screens
src/screens/         LoginScreen, SignupScreen, HomeScreen (my news + quota), NewsEditorScreen
src/LoginView.js     sign-in page shared by the three mobile apps
src/api.js           axios client with token refresh, photo uploads
src/auth.js          signed-in user, which roles may use this app
src/config.js        which API server to call
src/ui.js            colours and shared components (buttons, fields, chips, cards, banners)
src/constants.js     sections, statuses, sources
src/PlacePicker.js   State → District → Constituency picker (data in src/locations.json)
```

`src/locations.json` is a copy of `shared/locations.json`. Edit the shared file and run `python3 shared/sync_locations.py`.
