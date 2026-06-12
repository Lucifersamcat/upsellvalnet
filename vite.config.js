import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the SPA into dist/. In dev, proxies /api to the Express backend
// so the frontend and API share an origin just like in production.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4321',
    },
  },
});
