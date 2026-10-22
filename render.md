# How the UI is deployed on Render

Render runs only one service, the backend, but that service also serves the UI. The web app is built during Render's build step and then served as plain files by the Express backend.

## How it works

**1. Render's build command builds the web app too.**
With the build command `npm install && npm run build:web`, Render runs this script from `jaathiya-vaartalu-backend/package.json`:

```json
"build:web": "cd ../jaathiya-vaartalu-web && npm ci && npm run build"
```

The Root Directory setting (`jaathiya-vaartalu-backend`) only chooses where commands start. Render still downloads the whole repo, so `cd ../jaathiya-vaartalu-web` works. Vite compiles the React code into plain HTML, JS and CSS in `jaathiya-vaartalu-web/dist/`.

**2. The backend serves those built files at `/app/`.**
In `jaathiya-vaartalu-backend/src/index.js`:

```js
const webDist = path.join(__dirname, '../../jaathiya-vaartalu-web/dist');
if (fs.existsSync(webDist)) app.use('/app', express.static(webDist));
```

When the backend starts, it serves `dist/` as static files. The web app uses `#/...` addresses for its pages, so only static files are needed.

**3. The e-paper studio is part of the backend itself.**
`/studio` and the public reader `/e/<link>` come from one HTML file, `jaathiya-vaartalu-backend/public/epaper-studio.html`. The backend sends it with the API address added in. It needs no build step.

**4. The mobile apps aren't on Render.**
`jaathiya-vaartalu-reporter-mobile` and `jaathiya-vaartalu-admin-mobile` are built into APKs by the GitHub Actions workflows. They're installed on phones and call the Render API over the internet.

## Diagram

```
GitHub push
   │
   ▼
Render (one web service)
   build:  npm install            → backend dependencies
           npm run build:web      → jaathiya-vaartalu-web/dist/ (React → static files)
   start:  npm start              → Express on one address
                │
                ├── /api/*        REST API  ──► MongoDB Atlas, Cloudinary
                ├── /app/         web app (from dist/)
                ├── /studio       e-paper studio (public/epaper-studio.html)
                └── /e/<link>     public e-paper reader

GitHub Actions ──► APKs (reporter + desk) ──► phones ──► call /api/* on Render
```

The live service at `https://jaathiya-vaartalu-studio-app.onrender.com` is set up this way: `/app/` returns the built page and its `/app/assets/index-….js` and `.css` files, which only exist if `build:web` ran on Render.

Serving everything from one address means no CORS settings are needed. It also means the studio link in the web app opens already signed in, because both share the same site storage.

The cost is that any change, even to the UI only, redeploys and restarts the whole backend. On the free plan, the UI also goes to sleep whenever the backend does.

## Deploying the UI separately (optional)

`jaathiya-vaartalu-web` can be hosted on its own, either as a **Render Static Site** or on Netlify or Cloudflare Pages:

- Root directory: `jaathiya-vaartalu-web`
- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- Environment variable: `VITE_API_BASE=https://jaathiya-vaartalu-studio-app.onrender.com`

Then add the new site's address to `CORS_ORIGINS` on the backend. The studio link would stop opening already signed in, because the two would be on different sites.

Staying with the single-service setup is recommended for now. Switch when you want UI deploys that don't restart the API, or a UI that loads instantly while the API is asleep.
