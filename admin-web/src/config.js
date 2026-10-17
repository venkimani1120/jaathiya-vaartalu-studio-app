// The API server. Empty = same site as this page (when the API server hosts it at /desk/,
// or in development through the Vite proxy). Set VITE_API_BASE at build time to use another server,
// e.g. VITE_API_BASE=https://jaathiya-api.onrender.com npm run build
export const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');
export const SITE_BASE = API_BASE || window.location.origin;
