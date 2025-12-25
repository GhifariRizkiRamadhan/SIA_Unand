const { test, expect } = require('@playwright/test');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

const prisma = new PrismaClient();

const MAHASISWA_CRED = { email: 'mahasiswa@example.com', password: 'mahasiswa123' };
const PENGELOLA_CRED = { email: 'adminpengelola@example.com', password: 'pengelola123' };

test.describe('Pelaporan Kerusakan Fasilitas', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async () => {
    try {
      const u = await prisma.user.findUnique({ where: { email: MAHASISWA_CRED.email } });
      if (u) {
        const m = await prisma.mahasiswa.findFirst({ where: { user_id: u.user_id } });
        if (m) await prisma.pelaporankerusakan.deleteMany({ where: { mahasiswa_id: m.mahasiswa_id } });
      }
    } catch (_) {}
  });

  test.afterAll(async () => { await prisma.$disconnect(); });

  async function login(page, email, password) {
    await page.goto('/login');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard/);
  }

  async function logout(page) {
    await page.click('#profile-dropdown');
    await expect(page.locator('#dropdown-menu')).toBeVisible();
    await page.click('a[href="/logout"]');
    await expect(page).toHaveURL(/login/);
  }

  test('Mahasiswa lapor kerusakan lalu admin ubah status ke Ditangani', async ({ page }) => {
    await login(page, MAHASISWA_CRED.email, MAHASISWA_CRED.password);
    await page.goto('/pelaporan');
    await page.fill('#jenis', 'Lampu kamar mati');
    await page.fill('[name="location"]', 'Kamar 101');
    await page.fill('[name="description"]', 'Lampu tidak menyala sejak kemarin, mohon perbaikan segera.');
    await page.locator('input[name="photo"]').setInputFiles(path.join(__dirname, '../fixtures/proof.jpg'));
    await page.click('#laporanForm button[type="submit"]');
    await expect(page.locator('#notifyModal')).toBeVisible();
    await page.click('#notifyOkBtn');
    await page.waitForSelector('#laporanTable tbody tr');
    await expect(page.locator('#laporanTable')).toContainText('Lampu kamar mati');
    await expect(page.locator('#laporanTable')).toContainText('ditinjau');
    await logout(page);

    await login(page, PENGELOLA_CRED.email, PENGELOLA_CRED.password);
    await page.goto('/pengelola/pelaporan');
    await page.waitForSelector('#adminLaporanTable tbody');
    const row = page.locator('#adminLaporanTable tbody tr', { hasText: 'Lampu kamar mati' }).first();
    await expect(row).toBeVisible();
    await row.locator('button[data-action="status"][data-status="ditangani"]').click();
    await expect(page.locator('#confirmModal')).toBeVisible();
    await page.click('#confirmOkBtn');
    await expect(page.locator('#notifyModal')).toBeVisible();
    await page.click('#notifyOkBtn');
    await page.waitForSelector('#adminLaporanTable tbody tr');
    const rowAfter = page.locator('#adminLaporanTable tbody tr', { hasText: 'Lampu kamar mati' }).first();
    await expect(rowAfter).toContainText('ditangani');
    await rowAfter.locator('button[data-action="status"][data-status="selesai"]').click();
    await expect(page.locator('#confirmModal')).toBeVisible();
    await page.click('#confirmOkBtn');
    await expect(page.locator('#notifyModal')).toBeVisible();
    await page.click('#notifyOkBtn');
    await page.waitForSelector('#adminLaporanTable tbody tr');
    const rowDone = page.locator('#adminLaporanTable tbody tr', { hasText: 'Lampu kamar mati' }).first();
    await expect(rowDone).toContainText('selesai');
    await logout(page);
  });
});
