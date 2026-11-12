import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, proxy API + WebSocket traffic to the Express server so there are no CORS headaches.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
      '/socket.io': { target: 'http://localhost:5000', ws: true },
    },
  },
});
