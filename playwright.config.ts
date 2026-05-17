import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './gather/app',
  testMatch: '**/*.spec.ts',
  timeout: 30000,
  retries: 1,
  reporter: 'list',
  use: {
    headless: true,
    baseURL: 'https://gather.ehrenberg.us',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
