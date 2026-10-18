import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, API calls (and the layout studio) go to the local server (cd server && npm run dev).
const server = 'http://localhost:4000';
export default defineConfig({
  plugins: [react()],
  base: './',   // works at any path: /app/ on the API server, GitHub Pages, Netlify, ...
  server: { port: 5173, proxy: { '/api': server, '/uploads': server, '/studio': server, '/e/': server } },
});
