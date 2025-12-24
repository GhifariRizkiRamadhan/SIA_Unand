// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const isHostingTest = !!process.env.HOSTING_TEST;

module.exports = defineConfig({
  testDir: './tests',

  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',

  use: {
    baseURL: isHostingTest
      ? 'https://hosting-tash-pop-186188422008.asia-southeast1.run.app'
      : 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    // FUNCTIONAL TEST → CHROMIUM SAJA
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // COMPATIBILITY TEST → FIREFOX
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: /compatibility\/.*\.spec\.js/,
    },

    // COMPATIBILITY TEST → SAFARI (WEBKIT)
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testMatch: /compatibility\/.*\.spec\.js/,
    },
  ],

  ...(isHostingTest
    ? {}
    : {
        webServer: {
          command: 'npm start',
          url: 'http://localhost:3000',
          reuseExistingServer: !process.env.CI,
          timeout: 120 * 1000,
          env: { JWT_SECRET: 'test_secret', NODE_ENV: 'test' },
        },
      }),
});
