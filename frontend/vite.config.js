import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8787' },
    fs: { allow: ['..'] }, // lets mock mode import ../shared/fixtures
  },
});
