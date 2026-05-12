import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Base path:
//   - Dev (vite dev server)       → '/' (default)
//   - Prod (di belakang nginx)    → '/wso2-admin/' (matching location di prod.conf)
// Set VITE_BASE=/wso2-admin/ saat build prod:
//   VITE_BASE=/wso2-admin/ npm run build
const base = process.env.VITE_BASE || '/';

export default defineConfig({
  plugins: [react()],
  base,
  build: {
    outDir: path.resolve(__dirname, '../public/dist'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/login': 'http://localhost:3000',
    },
  },
});
