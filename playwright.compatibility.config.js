// playwright.compatibility.config.js
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/compatibility',
  timeout: 60_000,
  workers: 1,
  reporter: 'html',

  use: {
    baseURL: 'https://hosting-tash-pop-186188422008.asia-southeast1.run.app',
    trace: 'off',
    screenshot: 'off', 
    video: 'on',       // sreen record
  },

  projects: [
    { name: 'Chrome', use: { browserName: 'chromium', channel: 'chrome' } },
    { name: 'Edge', use: { browserName: 'chromium', channel: 'msedge' } },
    { name: 'Firefox', use: { browserName: 'firefox' } },
    {
      name: 'Brave',
      use: {
        browserName: 'chromium',
        executablePath:
          'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
      },
    },
    {
      name: 'Opera',
      use: {
        browserName: 'chromium',
        executablePath:
          'C:\\Users\\ASUS\\AppData\\Local\\Programs\\Opera\\opera.exe',
      },
    },
    {
      name: 'Vivaldi',
      use: {
        browserName: 'chromium',
        executablePath:
          'C:\\Users\\ASUS\\AppData\\Local\\Vivaldi\\Application\\vivaldi.exe',
      },
    },
    {
      name: 'Comet',
      use: {
        browserName: 'chromium',
        executablePath:
          'C:\\Users\\ASUS\\AppData\\Local\\Perplexity\\Comet\\Application\\comet.exe',
        args: ['--profile-directory=Default'],
      },
    },
  ],
});