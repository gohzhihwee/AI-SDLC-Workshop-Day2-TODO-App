import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3000',
    timezoneId: 'Asia/Singapore',
    trace: 'retain-on-failure',
    launchOptions: {
      args: ['--enable-experimental-web-platform-features'],
    },
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'npm run seed-holidays && npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
