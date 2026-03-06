import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@undo': path.resolve(__dirname, '../undo/dist'),
      '@sync': path.resolve(__dirname, '../sync/dist'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    port: 3000,
    headers: {
      'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: http://localhost:* https://localhost:* ws://localhost:* wss://localhost:*; connect-src 'self' http://localhost:* https://localhost:* ws://localhost:* wss://localhost:*"
    }
  },
  optimizeDeps: {
    exclude: ['better-sqlite3', 'D:/WEB DEVELOPMENT/Personal Operating System/database'],
  },
});
