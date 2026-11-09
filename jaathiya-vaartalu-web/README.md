# Jaathiya Vaartalu – Web app

One website for everyone at Jaathiya Vaartalu. After sign-in it shows each person the pages for their role. It talks to the [API server](../jaathiya-vaartalu-backend/README.md), so it shares accounts and data with the mobile apps.

Live: `https://jaathiya-vaartalu-studio-app.onrender.com/app/`

**Tech:** React 19 and Vite, built as a static site with no server code of its own.

## What each role sees

| Role | Pages |
|---|---|
| Reporter | **My news**, **Approved · 30 days**, **New news card** (headline, highlights, text, section and place, photos from files or camera, cropping) |
| Editor | **News** (review queue and all news, with filters, paging and deleting several at once), **E-paper** (editions), **Imports** (upload other papers' e-papers and pick their news for the feed), **Layout studio**, **New news card** |
| Admin | Everything an editor sees, plus **Team accounts** (approve sign-ups, change roles, turn accounts off) |

Everyone also gets **My profile** (photo, name, phone) and **Change password**. New reporters can sign up here; an admin then approves them.

The layout studio is a page served by the API at `/studio`. When this site is on the same address as the API (served at `/app/`, or through the dev proxy), the studio opens inside the app and is already signed in. On another address it opens in a new tab and asks for the sign-in again.

## Run it locally

Start the API first (`cd ../jaathiya-vaartalu-backend && npm run dev`), then:

```bash
npm install
npm run dev        # http://localhost:5173
```

In development the page calls its own address, and Vite forwards `/api`, `/uploads`, `/studio` and `/e/` to `DEV_API_TARGET` (`http://localhost:4000` by default). That way there is no CORS setup, and the studio opens signed in.

## Build

```bash
npm run build      # static site in dist/
npm run preview    # serve dist/ locally to check it
```

`base: './'` in `vite.config.js` makes the build work at any path: `/app/` on the API server, GitHub Pages, Netlify, and so on.

## Which API it calls

| File / variable | Used by | Value |
|---|---|---|
| `.env.development` | `npm run dev` | `VITE_API_BASE` empty (same address, through the proxy); `DEV_API_TARGET=http://localhost:4000` |
| `.env.production` | `npm run build` | `VITE_API_BASE` empty: the API server that hosts the page |
| `VITE_API_BASE` in the shell | either | Wins over the files, e.g. `VITE_API_BASE=https://jaathiya-vaartalu-studio-app.onrender.com npm run build` |

Set `VITE_API_BASE` only when the site is hosted somewhere other than the API server. Then also add the site's address to `CORS_ORIGINS` on the API server.

## Hosting

- **On the API server (recommended):** Render's build command `npm install && npm run build:web` in the backend builds this site, and the API serves it at `/app/`. See [`render.md`](../render.md).
- **Anywhere else** (Netlify, Cloudflare Pages, GitHub Pages): build with `VITE_API_BASE` set, upload `dist/`, and add the site's address to the API's `CORS_ORIGINS`.

## CI

`.github/workflows/jaathiya-vaartalu-web.yml` builds the site on pushes to `main` or `feature/**` and on pull requests that change this folder. A manual run (**Actions → Web app – build → Run workflow**) can take an API URL. Download the site from the run's **jv-web** artifact.

## Code layout

```
src/main.jsx, App.jsx    start-up, sign-in gate, navigation per role
src/router.js            hash routes (#/news/new, #/imports/<id>, …)
src/api.js, auth.jsx     API calls with token refresh; signed-in user and roles
src/config.js            API_BASE / SITE_BASE
src/pages/               Login, Signup, MyNews, Approved, NewsEditor, DeskNews, Review, Epapers, Imports,
                         ImportPaper, Studio, Users, Profile, ChangePassword
src/ui.jsx, styles.css   shared components and styles
src/Cropper.jsx          photo cropping in the news editor
src/PlacePicker.jsx      State → District → Constituency picker (data in src/locations.json)
```

`src/locations.json` is a copy of `shared/locations.json`. Edit the shared file and run `python3 shared/sync_locations.py`.
