import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/* Ports 5182 and 4182: the sibling MIS demo holds 5180 and 4180 on the same box. */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: '127.0.0.1', port: 5182, strictPort: true },
  preview: { host: '127.0.0.1', port: 4182, strictPort: true },
  build: { target: 'es2022', sourcemap: false },
});
