import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/* Ports 5182 and 4182: the sibling MIS demo holds 5180 and 4180 on the same box. */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: '127.0.0.1', port: 5182, strictPort: true },
  preview: {
    host: '127.0.0.1', port: 4182, strictPort: true,
    // Loopback only by default. To review the build over a private network, name the host at run
    // time: PREVIEW_ALLOWED_HOSTS=my.host.example bun run preview --host <address>
    allowedHosts: (process.env.PREVIEW_ALLOWED_HOSTS ?? '').split(',').map(h => h.trim()).filter(Boolean),
  },
  build: { target: 'es2022', sourcemap: false },
});
