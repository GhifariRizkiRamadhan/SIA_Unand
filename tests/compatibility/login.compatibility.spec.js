const { test, expect } = require('@playwright/test');

/**
 * Compatibility Test - Login Pengelola
 * Target: Hosting (bukan localhost)
 * Browser coverage:
 * - Chromium  -> Chrome, Edge, Brave, Opera, Vivaldi
 * - Firefox   -> Firefox
 * - WebKit    -> Safari
 */

const BASE_URL = 'https://hosting-tash-pop-186188422008.asia-southeast1.run.app';

const PENGELOLA = {
  email: 'adminpengelola@example.com',
  password: 'pengelola123',
};

test.describe('Compatibility Test - Login Pengelola (Hosting)', () => {

  test('Login berhasil di berbagai browser', async ({ page, browserName }) => {
    // Buka halaman login di hosting
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });

    // Pastikan halaman login tampil
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('input#email')).toBeVisible();
    await expect(page.locator('input#password')).toBeVisible();

    // Isi form login
    await page.fill('#email', PENGELOLA.email);
    await page.fill('#password', PENGELOLA.password);

    // Submit login
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
      page.click('button[type="submit"]'),
    ]);

    // Validasi login berhasil (redirect dashboard pengelola)
    await expect(page).toHaveURL(/\/pengelola/);

    // Elemen yang menandakan user login
    const profile = page.locator('#profile-dropdown');
    await expect(profile).toBeVisible({ timeout: 10000 });

    // Screenshot bukti compatibility test
    await page.screenshot({
      path: `test-results/compatibility-login-${browserName}.png`,
      fullPage: true,
    });
  });

});
