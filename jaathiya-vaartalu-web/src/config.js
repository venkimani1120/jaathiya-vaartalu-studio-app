// The API server, from .env.development / .env.production (VITE_API_BASE). Empty = same site as this page
// (when the API server hosts it at /app/, or in development through the Vite proxy).
// A VITE_API_BASE set in the shell at build time wins, e.g. VITE_API_BASE=https://jaathiya-vaartalu-studio-app.onrender.com npm run build
export const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');
export const SITE_BASE = API_BASE || window.location.origin;
