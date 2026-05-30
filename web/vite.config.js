import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// API_BASE comes from env (VITE_API_URL). During local dev we proxy /api to the
// backend so the browser never needs a hardcoded IP. In production set VITE_API_URL.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
