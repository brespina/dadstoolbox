import { defineConfig, devices } from '@playwright/test';

const port = 4321;

export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    // The trailing slash matters: page paths in tests are relative to the Site.
    baseURL: `http://localhost:${port}/dadstoolbox/`,
    trace: 'retain-on-failure',
  },
  // Phone-sized windows only: phones are first-class.
  projects: [
    { name: 'webkit-phone', use: { ...devices['iPhone 13'] } },
    { name: 'chromium-phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // The browser lock is only written by a real build, so test the built Site.
    command: `npm run build && npx astro preview --port ${port}`,
    url: `http://localhost:${port}/dadstoolbox/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
