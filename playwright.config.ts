import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', timeout: 30000, workers: 1,
  testMatch: '**/*.spec.ts',
  outputDir: '.test-artifacts/results',
  use: { baseURL: 'http://127.0.0.1:5177', browserName: 'chromium', channel: process.platform === 'win32' ? 'msedge' : undefined },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5177 --strictPort', url: 'http://127.0.0.1:5177', reuseExistingServer: true },
});
