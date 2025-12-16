import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/playwright',
  timeout: 60_000,
  outputDir: 'tests/playwright/test-results',
  use: {
    baseURL: process.env.API_BASE_URL ?? 'http://localhost:3000',
  },
});
