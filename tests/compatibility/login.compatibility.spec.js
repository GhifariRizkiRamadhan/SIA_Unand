const { test, expect } = require('@playwright/test');

const PENGELOLA = {
  email: 'adminpengelola@example.com',
  password: 'pengelola123',
};

test.describe('Compatibility Test - Login Pengelola (Hosting)', () => {
  test('Login di berbagai browser', async ({ page }) => {
    await page.goto('/login');

    await page.fill('#email', PENGELOLA.email);
    await page.fill('#password', PENGELOLA.password);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('button[type="submit"]'),
    ]);

    await expect(page).toHaveURL(/pengelola/);

    const profile = page.locator('#profile-dropdown');
    await expect(profile).toBeVisible();

    await page.screenshot({
      path: `test-results/compatibility-login-${test.info().project.name}.png`,
      fullPage: true,
    });
  });
});
