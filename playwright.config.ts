import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e/playwright',
  timeout: 60_000,
  use: {
    baseURL: process.env.API_BASE_URL ?? 'http://localhost:3000',
  },
});
