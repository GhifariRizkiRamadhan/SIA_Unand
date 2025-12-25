const { test, expect } = require('@playwright/test');

const PENGELOLA = {
  email: 'adminpengelola@example.com',
  password: 'pengelola123',
};

test.describe('Compatibility Test - Login Pengelola (Hosting)', () => {
  test('Login di berbagai browser', async ({ page }, testInfo) => {

    // 1. Buka halaman login 
    await page.goto('/login');

    // 2. Isi kredensial
    await page.fill('#email', PENGELOLA.email);
    await page.fill('#password', PENGELOLA.password);

    // 3. Submit login
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('button[type="submit"]'),
    ]);

    // 4. Validasi login berhasil
    await expect(page).toHaveURL(/pengelola/);
    await expect(page.locator('#profile-dropdown')).toBeVisible();

  });
});