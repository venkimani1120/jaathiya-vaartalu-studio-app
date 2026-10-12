# Jaathiya Vaarthalu – News Desk app + E-paper Studio

Three parts, one backend:

| Part | What it does | Tech |
|---|---|---|
| `mobile/` | Reporter / Editor / Admin app: sign up, log in, upload news cards (multiple photos + news text), review, approve, manage team | React Native (Expo) |
| `server/` | REST API, JWT auth with roles, 50-cards-per-day limit, review workflow, e-paper storage and publishing | Node.js, Express, MongoDB |
| `server/public/epaper-studio.html` | Drag-and-drop page layout (matches the printed paper), merge pages, publish, share link, save as PDF. Also the public reader at `/e/<link>` | Plain HTML/JS, served by the API |

## Roles and rules (enforced on the server)

| Action | Reporter | Editor | Admin |
|---|---|---|---|
| Sign up | Yes (starts inactive) | – | – |
| Upload news card | Yes, max **50 per day** (resets at midnight IST) | Yes, no limit | Yes, no limit |
| Edit / delete a card | **Only own cards**, only before approval | Any card | Any card |
| See news | Own cards only | All, filter by constituency / district / section | Same |
| Approve / send back | – | Yes | Yes |
| Build, merge, publish e-paper | – | Yes | Yes |
| Approve accounts, change roles | – | – | Yes |

Flow: `draft → submitted → approved` (or `rejected` with a note → reporter fixes → resubmits) `→ published` when placed in a published edition.

The limit uses an atomic per-day counter (`DailyQuota` with a unique index), so two uploads at the same moment can't sneak past 50.

JWT: 15-minute access token + 30-day refresh token. Changing a user's role or deactivating them bumps `tokenVersion`, which signs them out on every device.

## API summary

```
POST /api/auth/signup | /login | /refresh | /logout     GET /api/auth/me
GET  /api/news?status=&constituency=&district=&section=&q=   POST /api/news   PATCH|DELETE /api/news/:id
POST /api/news/:id/review {action: approve|reject, note}      GET /api/news/quota/today
POST /api/uploads  (multipart "images", up to 10)  -> { urls }
GET|POST /api/epapers   GET|PUT /api/epapers/:id   POST /api/epapers/:id/publish   (editor, admin)
GET  /api/users?pending=true   PATCH /api/users/:id {role, active}   (admin)
GET  /api/public/epapers/:slug   GET /api/public/meta              (no login)
GET  /studio  (layout studio)    GET /e/:slug  (public reader)
```

## E-paper layouts

The studio reproduces the sample: red masthead with photo box and "విలేఖరులు కావలెను" box, red "Published from…" band, సంపుటి / సంచిక / date / ఎడిటర్ / ప్రచురణ / పేజీలు / వెల strip, inner-page header with the red page number and blue date bar, and the printer's imprint on the last page.

Edition types: **State, District, Constituency, Sports, Business**. Page layouts: Front page, Constituency/local, District, Sports, Business, Merged. Each story can use the red, blue-banner or boxed headline style (tap **Aa**). Highlights show as the pink deck.

Editors can drag cards onto boxes (or tap a card, then tap a box on phones), drag stories between boxes to swap, drag page thumbnails to reorder, **Merge with next** to combine two pages, change a page's layout, and Auto-fill from the filtered news.

To change masthead text, the "Published from" line or the imprint, edit `BRAND` near the top of the studio script.

## States, districts and constituencies

`shared/locations.json` holds every assembly constituency in both states, grouped by district:

- **Andhra Pradesh:** 28 districts, 175 constituencies (current map from 1 Jan 2026, including Polavaram and Markapuram districts, Addanki and Kandukur moved to Prakasam, Gudur to Nellore, Railway Kodur to Tirupati, Rajampet to Kadapa).
- **Telangana:** 33 districts, 119 constituencies.

A few constituencies cross district lines (e.g. Pendurthi, Venkatagiri, Punganur, Raptadu, Manthani, Wardhannapet); each is listed under the district that holds most of it. Two names repeat across districts, so they carry the district in brackets: ప్రత్తిపాడు (కాకినాడ) and పోలవరం (ఏలూరు).

To change anything, edit `shared/build_locations.py`, run it, then run `python3 shared/sync_locations.py` to copy the data into the server, the app and the studio.

The app uses a State → District → Constituency picker for sign-up, news cards and the review filter. The server fills in `state` automatically from the district, and `GET /api/news?state=` filters by it.

## Run locally

```bash
# 1. API
cd server
cp .env.example .env          # fill in MONGODB_URI, JWT secrets, CLOUDINARY_URL
npm install
npm run create-admin          # creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD
npm run dev                   # http://localhost:4000/studio

# 2. Mobile app
cd ../mobile
./setup.sh                    # creates jv-mobile/ with matching Expo versions
# edit jv-mobile/src/config.js -> API_BASE
cd jv-mobile && npx expo start   # scan the QR with Expo Go on Android
```

## Getting an APK for testing

**Fastest:** run `./publish-to-github.sh` (optionally with your API URL). It creates the private repo `jaathiya-vaartalu-epaper-studio`, commits everything to `feature/news-desk-epaper`, waits for the free GitHub build and saves the APK to `apk/app-release.apk`. Every later push that changes `mobile/` builds a new APK automatically.

Or pick one of these. All three are free.

**A. GitHub Actions (no tools on your PC).** Push this folder to a GitHub repo. Open **Actions → Build Android APK → Run workflow**, enter your API URL, and wait about 15–25 minutes. Download **jaathiya-vaarthalu-apk** from the finished run, unzip it, and install `app-release.apk` on the phone (allow "Install unknown apps"). Public repos build free; private repos use the free monthly minutes.

**B. Expo EAS cloud build.** Needs a free Expo account.
```bash
cd mobile && ./setup.sh && cd jv-mobile
npm install -g eas-cli && eas login
eas build -p android --profile preview      # prints a download link / QR for the APK
```

**C. Build on your own PC.** Needs Android Studio (SDK) and JDK 17.
```bash
cd mobile && ./setup.sh && cd jv-mobile
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

The test APK is signed with the debug key: fine for sharing with your team, not for the Play Store. For a local server, use your PC's Wi-Fi IP (e.g. `http://192.168.1.10:4000`) as the API URL; plain `http` is allowed for this reason. The phone and PC must be on the same Wi-Fi.

## Free build, deployment and hosting

Free tiers change often, so confirm the current limits on each provider's pricing page before you commit.

| Need | Free option | Notes |
|---|---|---|
| Database | **MongoDB Atlas M0** | 512 MB shared cluster; plenty for text. Keep photos out of the DB. |
| Photos | **Cloudinary free plan** | Auto-resizes and compresses; the API already uploads there when `CLOUDINARY_URL` is set. Alternatives: Supabase Storage, Cloudflare R2 free tier. |
| API + studio + reader | **Render free web service** | Deploy from GitHub, root dir `server`, start `npm start`. Sleeps after ~15 min idle; first request then takes ~30–60 s. Alternatives: Google Cloud Run free tier (no sleep cost issues, needs billing card), Fly.io/Railway (paid now). |
| Android build | **Expo EAS Build free tier** | `npx eas build -p android --profile preview` gives an APK you can share directly with reporters. Free builds are queued and limited per month; or build locally with `npx expo run:android`. |
| Distribution | APK link / WhatsApp | Free. Google Play needs a one-time US$25 developer fee; Apple App Store needs US$99/year. |
| Public e-paper site | Served by the API at `/e/<link>` | Optional: put a custom domain in front with Cloudflare (free). |
| Code & CI | GitHub (free) | Render auto-deploys on each push. |
| Push notifications (later) | Expo Push | Free. |

Tips for the free tier: set up a free uptime ping (e.g. cron-job.org every 10 min during working hours) so the API is awake when the desk starts, and keep phone photos at quality 0.6 (already set) to save storage.

## Next steps worth adding

Server-side PDF of each edition (Puppeteer) for WhatsApp sharing, an ads slot type, page-level comments between editors, and push notifications to reporters when news is sent back.
