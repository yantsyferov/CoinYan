import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/graphql': 'http://web-bff:8001',
      '/bff': { target: 'http://web-bff:8001', rewrite: (path) => path.replace(/^\/bff/, '') },
    },
  },
});
