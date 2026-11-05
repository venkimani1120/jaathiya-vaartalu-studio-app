import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Environment values come from .env.development (npm run dev) or .env.production (npm run build).
// In development, API calls (and the layout studio) go to the local server (cd jaathiya-vaartalu-backend && npm run dev).
export default defineConfig(({ mode }) => {
  const server = loadEnv(mode, process.cwd(), '').DEV_API_TARGET || 'http://localhost:4000';
  return {
    plugins: [react()],
    base: './',   // works at any path: /app/ on the API server, GitHub Pages, Netlify, ...
    server: { port: 5173, proxy: { '/api': server, '/uploads': server, '/studio': server, '/e/': server } },
  };
});
