// tests/functional/login.spec.js
const { test, expect } = require('@playwright/test');

const MAHASISWA = { email: 'mahasiswa@example.com', password: 'mahasiswa123' };
const PENGELOLA  = { email: 'adminpengelola@example.com', password: 'pengelola123' };

test.describe('Login Functional Tests', () => {
  test('Mahasiswa: login success -> redirect to /mahasiswa/dashboard and profile visible', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);

    await page.fill('#email', MAHASISWA.email);
    await page.fill('#password', MAHASISWA.password);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('button[type="submit"]'),
    ]);

    // Pastikan redirect sesuai role (controller redirectByRole)
    await expect(page).toHaveURL(/\/mahasiswa\/dashboard/);

    // Cek keberadaan elemen yang menandakan user sudah login
    // project kamu sebelumnya memakai '#profile-dropdown' untuk logout; cek juga itu ada
    const profile = page.locator('#profile-dropdown');
    await expect(profile).toBeVisible();

    // optional: simpan screenshot bukti
    await page.screenshot({ path: 'tmp/login-mahasiswa-success.png', fullPage: true });
  });

  test('Pengelola: login success -> redirect to /pengelola/dashboard and profile visible', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);

    await page.fill('#email', PENGELOLA.email);
    await page.fill('#password', PENGELOLA.password);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('button[type="submit"]'),
    ]);

    await expect(page).toHaveURL(/\/pengelola\/dashboard/);

    const profile = page.locator('#profile-dropdown');
    await expect(profile).toBeVisible();

    await page.screenshot({ path: 'tmp/login-pengelola-success.png', fullPage: true });
  });

  test('Login failed with wrong credentials -> shows error message', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'unknown@example.com');
    await page.fill('#password', 'wrongpassword');

    // Submit and expect to stay on login page with error rendered
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForLoadState('networkidle')
    ]);

    // Controller renders "Email atau password salah" on failed login
    await expect(page.locator('text=Email atau password salah')).toBeVisible();

    // And still on /login
    await expect(page).toHaveURL(/\/login/);
  });
});
