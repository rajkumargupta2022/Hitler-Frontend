import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Values come from client/.env (see .env.example). Only VITE_* variables reach the browser code.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: Number(env.VITE_PORT) || 5173,
      // During development, calls to /api are forwarded to the Node server.
      proxy: { '/api': env.VITE_PROXY_TARGET || 'http://localhost:5000' },
    },
  };
});
