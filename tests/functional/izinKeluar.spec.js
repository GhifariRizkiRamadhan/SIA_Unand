const { test, expect } = require('@playwright/test');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const MAHASISWA_CRED = { email: 'mahasiswa@example.com', password: 'mahasiswa123' };
const PENGELOLA_CRED = { email: 'adminpengelola@example.com', password: 'pengelola123' };

test.describe('Izin Keluar Jam Reguler', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async () => {
    try {
      const u = await prisma.user.findUnique({ where: { email: MAHASISWA_CRED.email } });
      if (u) {
        const m = await prisma.mahasiswa.findFirst({ where: { user_id: u.user_id } });
        if (m) await prisma.izinkeluar.deleteMany({ where: { mahasiswa_id: m.mahasiswa_id } });
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

  function ymd(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  test('Mahasiswa ajukan izin reguler lalu admin approve', async ({ page }) => {
    const dateStr = ymd(new Date());

    await login(page, MAHASISWA_CRED.email, MAHASISWA_CRED.password);
    await page.goto('/pengajuan-surat-izin');
    await page.fill('#reason', 'Keperluan akademik reguler');
    await page.fill('#date_out', dateStr);
    await page.fill('#time_out', '08:00');
    await page.fill('#date_return', dateStr);
    await page.fill('#time_return', '17:00');
    await page.locator('input#document').setInputFiles({ name: 'izin.pdf', mimeType: 'application/pdf', buffer: Buffer.from('PDF') });
    await page.click('#izinForm button[type="submit"]');
    await expect(page.locator('#notifyModal')).toBeVisible();
    await page.click('#notifyOkBtn');
    await expect(page.locator('#izinTable')).toContainText('Keperluan akademik reguler');
    await expect(page.locator('#izinTable')).toContainText('pending');
    await logout(page);

    await login(page, PENGELOLA_CRED.email, PENGELOLA_CRED.password);
    await page.goto('/pengelola/perizinan');
    await page.waitForSelector('#tableIzin tbody');
    const row = page.locator('#tableIzin tbody tr', { hasText: 'Keperluan akademik reguler' }).first();
    await expect(row).toBeVisible();
    await row.locator('button[data-action="approve"]').click();
    await expect(page.locator('#notifyModal')).toBeVisible();
    await page.click('#notifyOkBtn');
    await page.waitForSelector('#tableIzin tbody');
    const rowAfter = page.locator('#tableIzin tbody tr', { hasText: 'Keperluan akademik reguler' }).first();
    await expect(rowAfter).toContainText('Approved');
    await logout(page);
  });
});

