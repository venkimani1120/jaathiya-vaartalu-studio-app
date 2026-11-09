# Jaathiya Vaartalu – API server

The one backend behind every Jaathiya Vaartalu app: the Reporter, Admin and Studio mobile apps, the web app, the e-paper layout studio and the public e-paper reader. All of them use the same MongoDB database through this server.

- REST API under `/api`: sign-in with roles, news cards and their review, photo uploads, e-paper editions, imported e-papers with news extraction, team accounts.
- `/studio`: the drag-and-drop e-paper layout studio (`public/epaper-studio.html`), used by the web app and inside the JV Studio app.
- `/e/<link>`: the public reader for published editions.
- `/app/`: the web app, when it has been built (`npm run build:web`).

Live server: `https://jaathiya-vaartalu-studio-app.onrender.com`

**Tech:** Node.js 18+, Express, MongoDB (Mongoose), JWT, Multer, Cloudinary, sharp, pdf.js, Gemini API.

## Run it locally

```bash
cp .env.development.example .env.development   # fill in MONGODB_URI and the two JWT secrets at least
npm install
npm run create-admin     # the first admin, from ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD
npm run dev              # http://localhost:4000 (restarts on file changes)
```

Open `http://localhost:4000/studio` for the layout studio. To try the web app on the same address, run `npm run build:web` once and open `http://localhost:4000/app/`.

Test data: `npm run seed` adds test users, sample photos and news cards in every status. It is safe to re-run, as it first removes the earlier test users (emails ending `@test.local`) and their news. Every test account uses the password `Test@1234`:

| Email | Role |
|---|---|
| `editor@test.local` | Editor |
| `reporter1@test.local`, `reporter2@test.local`, `reporter3@test.local` | Reporter |
| `pending@test.local` | Reporter, waiting for admin approval |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server with `.env.development`, restarts on changes |
| `npm run start:local` | Development settings, no restart on changes |
| `npm start` | Production server with `.env.production` (or the Render dashboard values) |
| `npm run create-admin` / `create-admin:prod` | Creates the first admin in the development / production database |
| `npm run seed` | Loads test data (development) |
| `npm run build:web` | Builds `../jaathiya-vaartalu-web` so this server serves it at `/app/` |
| `node scripts/make-app-icons.js` | Remakes the three mobile apps' launcher icons from `scripts/brand/mark-1024.png` |

## Environments

`npm run dev` loads `.env.development`. `npm start`, and any run where `RENDER` is set, loads `.env.production`. Values already set in the shell or on Render win over the files. The real `.env.*` files hold secrets and are not committed; copy the `.example` files.

| Variable | What it is for |
|---|---|
| `MONGODB_URI` | MongoDB connection string (a free MongoDB Atlas M0 cluster is enough) |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Long random strings that sign the tokens |
| `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL` | Token lifetimes (default `15m` and `30d`) |
| `SESSION_IDLE_MINUTES` | Sign-out after this many minutes without a request (default 15) |
| `CLOUDINARY_URL` | Photo and page storage. Empty: files are saved in `uploads/` and served at `/uploads`. PDF imports need it. |
| `PUBLIC_BASE_URL` | This server's public address, used in share links |
| `CORS_ORIGINS` | Web addresses allowed to call the API, comma-separated. The mobile apps don't need an entry. |
| `DAILY_NEWS_LIMIT` | News cards a reporter can upload per day (default 50) |
| `TZ_OFFSET_MINUTES` | When a reporter's day resets (330 = IST) |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | The first admin, for `create-admin` |
| `IMPORT_DPI`, `IMPORT_MAX_MB` | Imported PDFs: page render resolution and largest upload |
| `GEMINI_API_KEY` | Turns on news extraction from imported e-papers (a free key from Google AI Studio). Empty: off. |
| `GEMINI_MODEL`, `GEMINI_FALLBACK_MODELS` | Model used to read pages, and the ones tried when it is busy |
| `EXTRACT_GAP_SECONDS`, `EXTRACT_IMAGE_WIDTH`, `EXTRACT_PHOTO_WIDTH` | Extraction pacing and image sizes |

## Accounts and sessions

Roles are `reporter`, `editor` and `admin`. New reporters sign up and wait for an admin to approve them. Every rule (who may edit, approve or publish what) is checked here, whatever the app shows.

Each sign-in opens one session: a 15-minute access token plus a refresh token, both tied to it. **One signed-in device per user:** signing in anywhere ends the earlier session. This includes the Admin and Studio apps and the web app, which share editor and admin accounts. A session also ends after `SESSION_IDLE_MINUTES` idle, on sign-out, or when the password, role or active state changes.

## API

```
POST /api/auth/signup | /login | /refresh | /logout | /password     GET|PATCH /api/auth/me
GET  /api/news?status=&source=&paper=&page=&state=&district=&constituency=&section=&author=me&q=
POST /api/news   GET|PATCH|DELETE /api/news/:id   POST /api/news/bulk-delete {ids}   (editor, admin)
GET  /api/news/counts?<same filters>   POST /api/news/:id/review {action: approve|reject, note}   GET /api/news/quota/today
POST /api/uploads   multipart "images", up to 10  -> { urls }
GET|POST /api/epapers   GET|PUT|DELETE /api/epapers/:id   POST /api/epapers/:id/publish | /unpublish (admin)
GET|POST /api/imports   GET|DELETE /api/imports/:id   POST /api/imports/:id/extract[?page=N] | /news {ids, action: add|delete} | /recrop
GET  /api/imports/publishers | /status      (imports: editor, admin; POST is multipart "file" = one PDF, or "pages" = page images)
GET  /api/users?pending=true   PATCH /api/users/:id {role, active}   (admin)
GET  /api/public/meta | /epapers | /epapers/:slug | /news?days=30&page=1   (no sign-in)
GET  /studio   GET /e/:slug   GET /app/
```

The [root README](../README.md) has the news flow (`draft → submitted → approved → published`), the e-paper studio and how imported e-papers are read.

## Code layout

```
src/index.js        Express app: security headers, CORS, routes, /studio, /e/:slug, /app/
src/config/         environment loading, MongoDB connection, constants, states/districts/constituencies
src/middleware/     authenticate / authorize (roles)
src/models/         User, News, Epaper, SourcePaper (imported e-papers), DailyQuota
src/routes/         auth, users, news, uploads, epapers, imports, public
src/services/       importer, pageStore (Cloudinary/local), extractor + gemini (news extraction), pdfPhotos, snap
src/utils/          HTTP errors, tokens, data backfills
public/             epaper-studio.html (layout studio and public reader)
scripts/            create-admin, seed-test-data, make-app-icons
```

`src/config/locations.json` is a copy of `shared/locations.json`. Edit the shared file and run `python3 shared/sync_locations.py`.

## Deploying

The server runs on a free Render web service. Set Root Directory to `jaathiya-vaartalu-backend`, the build command to `npm install && npm run build:web` and the start command to `npm start`, then add the production variables in the Render dashboard. [`render.md`](../render.md) explains how the web app is built and served from this service.
