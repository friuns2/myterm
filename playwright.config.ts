import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3531',
    headless: true,
    trace: 'on-first-retry',
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'PORT=3531 MYSHELL_ENV_PATH="/tmp/myshell_env.json" MYSHELL_ZSHRC_PATH="/tmp/myshell_zshrc" node server.js',
        port: 3531,
        reuseExistingServer: true,
        timeout: 60_000,
      },
});

