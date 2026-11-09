# Jaathiya Vaartalu – Studio app (e-paper)

The e-paper app for **editors and admins**: lay out and publish the e-paper, upload other newspapers, and add small news cuts. It runs on **Android and iOS** and uses the same [API server](../jaathiya-vaartalu-backend/README.md) and MongoDB data as the other apps.

| | |
|---|---|
| App name | JV Studio |
| Android package / iOS bundle id | `com.jaathiyavaartalu.studio` |
| Who can sign in | Editors and admins, with the same accounts as JV Admin and the web app. Reporters are asked to use JV Reporter. |
| API | `https://jaathiya-vaartalu-studio-app.onrender.com` in release builds |

**Tech:** React Native with Expo (SDK 58), React Navigation, axios, Expo SecureStore (sign-in tokens), Expo Image Picker, Expo Document Picker, react-native-webview.

## Features

- **Layout studio:** the same drag-and-drop studio as the web app (served by the API at `/studio`), shown inside the app. Arrange approved news on pages, merge pages and publish. The open edition is saved before you leave the studio. It works best on a tablet or with the phone turned sideways.
- **Editions:** drafts and published editions, with a **Share** link for published ones.
- **Upload newspaper:** another paper's e-paper as **one PDF** or **up to 40 page photos** (gallery or camera, reordered with arrows), with the paper, edition, date, edition type and an optional district. Names already used are suggested.
- **Imported paper:** its pages, and the news the server read from each page. Tick news to **add to the feed** (it then waits for review) or **delete** it. You can read a page or the whole paper again, or delete the import.
- **Upload news cut:** photograph or pick a small news cutting and crop it, type its headline and text, and choose section and place. It is saved as an approved news card, so it is ready to place in the studio right away.

**One device at a time:** an account can be signed in on one device. Signing in to this app signs the same account out of JV Admin and the web app.

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
| Android | `.github/workflows/jaathiya-vaartalu-studio-mobile-android.yml` ("Studio (E-paper) mobile – Android") | `jv-studio-apk`: `app-release.apk`, signed with the debug key, for testing |
| iOS Simulator | `.github/workflows/jaathiya-vaartalu-studio-mobile-ios.yml` ("Studio (E-paper) mobile – iOS") | `jv-studio-ios-simulator`: unzip and drag onto the iOS Simulator in Xcode |
| iPhone | the same iOS workflow, run by hand with **iOS device build** = `preview` or `testflight` | `jv-studio-ios-device`: `.ipa`, signed on Expo EAS |

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

The launcher icon is the brand mark with a red badge with a layout grid, so the three apps are easy to tell apart. `assets/` holds:

- `icon.png`: opaque, for iOS
- `adaptive-icon.png` and `monochrome-icon.png`: Android, including themed icons
- `splash-icon.png`: start-up screen
- `logo.png`: sign-in page
- `mark.png`: header

To remake the icons, run `node scripts/make-app-icons.js` in `jaathiya-vaartalu-backend`.

## Code layout

```
App.js               navigation: sign-in screens, then the app's screens
src/screens/         LoginScreen, HomeScreen (studio, uploads, editions), StudioScreen (WebView), ImportsScreen, ImportPaperScreen, NewsCutScreen
src/LoginView.js     sign-in page shared by the three mobile apps
src/api.js           axios client with token refresh, photo uploads
src/auth.js          signed-in user, which roles may use this app
src/config.js        which API server to call
src/ui.js            colours and shared components (buttons, fields, chips, cards, banners)
src/constants.js     sections, statuses, sources, edition types
src/PlacePicker.js   State → District → Constituency picker (data in src/locations.json)
```

`src/locations.json` is a copy of `shared/locations.json`. Edit the shared file and run `python3 shared/sync_locations.py`.
