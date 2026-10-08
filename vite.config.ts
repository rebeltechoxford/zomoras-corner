import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GoDaddy's preview runs `npm run dev` and supplies its own listening port.
const assignedPort = process.env.PORT ? Number(process.env.PORT) : undefined;
if (assignedPort !== undefined && (!Number.isInteger(assignedPort) || assignedPort < 1 || assignedPort > 65535)) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? '/zomoras-corner/' : '/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: assignedPort ?? 5173,
    strictPort: true,
    allowedHosts: ['r62r4t1f6i.preview.c37.airoapp.ai'],
    fs: {
      // Preserve Vite's default secret exclusions and protect local writer files.
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/writer-setup.txt', '**/story-draft.json', '**/supabase/**'],
    },
  },
  preview: {
    host: '0.0.0.0',
    port: assignedPort ?? 4173,
    strictPort: true,
  },
}));
