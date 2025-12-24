// tests/functional/dataPenghuni.spec.js
const { test, expect } = require('@playwright/test');

const PENGELOLA = {
  email: 'gipadmin@admin.com',
  password: 'gipa123'
};

// Login
async function loginAsPengelola(page) {
  await page.goto('/login');
  await page.fill('#email', PENGELOLA.email);
  await page.fill('#password', PENGELOLA.password);

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.click('button[type="submit"]')
  ]);

  await expect(page).toHaveURL(/pengelola/);
}

// Generate NIM unik
function generateTestNIM(testInfo) {
  return `PW_TEST_${testInfo.workerIndex}_${Date.now()}`;
}

// Search via DataTables
async function searchInTable(page, tableId, keyword) {
  const searchInput = page.locator(
    `#${tableId}_filter input[type="search"]`
  );

  await expect(searchInput).toBeVisible();
  await searchInput.fill(keyword);
  await page.waitForTimeout(500);

  const rows = page.locator(`#${tableId} tbody tr`);
  await expect(rows.first()).toBeVisible({ timeout: 10000 });

  return rows;
}


//TEST SUITE
test.describe('Data Penghuni - Functional (Pengelola)', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsPengelola(page);
  });

  test('1. Halaman Data Penghuni bisa diakses', async ({ page }) => {
    await page.goto('/pengelola/dataPenghuni');
    await expect(
      page.getByRole('heading', { name: 'Data Penghuni' })
    ).toBeVisible();
  });

  test('2. Tambah penghuni baru berhasil', async ({ page }, testInfo) => {
    const nim = generateTestNIM(testInfo);
    const nama = `Playwright Penghuni ${nim}`;

    await page.goto('/pengelola/dataPenghuni');
    await page.click('button:has-text("Tambah Penghuni")');

    await page.fill('#formTambah input[name="nama"]', nama);
    await page.fill('#formTambah input[name="nim"]', nim);
    await page.fill('#formTambah input[name="jurusan"]', 'Teknik Informatika');

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('#formTambah button[type="submit"]')
    ]);

    await expect(
      page.locator('text=Data penghuni berhasil ditambahkan')
    ).toBeVisible();

    await searchInTable(page, 'tableAktif', nim);
  });

  test('3. Edit penghuni berhasil', async ({ page }, testInfo) => {
    const nim = generateTestNIM(testInfo);
    const nama = `Playwright Penghuni ${nim}`;
    const namaBaru = `Playwright EDIT ${nim}`;

    // Tambah
    await page.goto('/pengelola/dataPenghuni');
    await page.click('button:has-text("Tambah Penghuni")');
    await page.fill('#formTambah input[name="nama"]', nama);
    await page.fill('#formTambah input[name="nim"]', nim);
    await page.fill('#formTambah input[name="jurusan"]', 'Teknik Informatika');

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('#formTambah button[type="submit"]')
    ]);

    // Cari via search
    const rows = await searchInTable(page, 'tableAktif', nim);
    const row = rows.first();

    await Promise.all([
      page.waitForResponse(r =>
        r.url().includes('/pengelola/dataPenghuni/get/') && r.status() === 200
      ),
      row.locator('button[title="Edit"]').click()
    ]);

    await expect(page.locator('#modalEdit')).toBeVisible();
    await page.fill('#edit_nama', namaBaru);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('#formEdit button[type="submit"]')
    ]);

    await expect(
      page.locator('text=Data penghuni berhasil diupdate')
    ).toBeVisible();

    await searchInTable(page, 'tableAktif', namaBaru);
  });

  test('4a. Toggle status penghuni - Nonaktifkan berhasil', async ({ page }, testInfo) => {
    const nim = generateTestNIM(testInfo);
    const nama = `Playwright Penghuni ${nim}`;

    // Tambah
    await page.goto('/pengelola/dataPenghuni');
    await page.click('button:has-text("Tambah Penghuni")');
    await page.fill('#formTambah input[name="nama"]', nama);
    await page.fill('#formTambah input[name="nim"]', nim);
    await page.fill('#formTambah input[name="jurusan"]', 'Teknik Informatika');

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('#formTambah button[type="submit"]')
    ]);

    const rows = await searchInTable(page, 'tableAktif', nim);
    const row = rows.first();

    page.once('dialog', d => d.accept());

    await Promise.all([
      page.waitForResponse(r =>
        r.url().includes('/pengelola/dataPenghuni/toggle/') && r.status() < 400
      ),
      row.locator('button[title="Nonaktifkan"]').click()
    ]);

    await expect(
      page.locator('text=Status penghuni berhasil diubah')
    ).toBeVisible();

    await searchInTable(page, 'tableTidakAktif', nim);
  });

  test('4b. Toggle status penghuni - Aktifkan kembali berhasil', async ({ page }, testInfo) => {
    const nim = generateTestNIM(testInfo);
    const nama = `Playwright Penghuni ${nim}`;

    // Tambah
    await page.goto('/pengelola/dataPenghuni');
    await page.click('button:has-text("Tambah Penghuni")');
    await page.fill('#formTambah input[name="nama"]', nama);
    await page.fill('#formTambah input[name="nim"]', nim);
    await page.fill('#formTambah input[name="jurusan"]', 'Teknik Informatika');

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('#formTambah button[type="submit"]')
    ]);

    // Nonaktifkan
    let rows = await searchInTable(page, 'tableAktif', nim);
    let row = rows.first();

    page.once('dialog', d => d.accept());
    await Promise.all([
      page.waitForResponse(r =>
        r.url().includes('/pengelola/dataPenghuni/toggle/') && r.status() < 400
      ),
      row.locator('button[title="Nonaktifkan"]').click()
    ]);

    // Aktifkan kembali
    rows = await searchInTable(page, 'tableTidakAktif', nim);
    row = rows.first();

    page.once('dialog', d => d.accept());
    await Promise.all([
      page.waitForResponse(r =>
        r.url().includes('/pengelola/dataPenghuni/toggle/') && r.status() < 400
      ),
      row.locator('button[title="Aktifkan"]').click()
    ]);

    await expect(
      page.locator('text=Status penghuni berhasil diubah')
    ).toBeVisible();

    await searchInTable(page, 'tableAktif', nim);
  });

  test('5. Show entries (page length) pada DataTables berfungsi', async ({ page }) => {
    await page.goto('/pengelola/dataPenghuni');

    await page.evaluate(() => {
      if (window.$ && $.fn.dataTable.isDataTable('#tableAktif')) {
        $('#tableAktif').DataTable().page.len(1).draw();
      }
    });

    await page.waitForTimeout(500);

    const visibleRows = await page
      .locator('#tableAktif tbody tr')
      .evaluateAll(rows => rows.filter(r => r.offsetParent !== null).length);

    expect(visibleRows).toBeLessThanOrEqual(1);
  });

  test('6. Search box DataTables mencari row berdasarkan NIM atau Nama', async ({ page }, testInfo) => {
    const nim = generateTestNIM(testInfo);
    const nama = `Playwright Search ${nim}`;

    await page.goto('/pengelola/dataPenghuni');
    await page.click('button:has-text("Tambah Penghuni")');
    await page.fill('#formTambah input[name="nama"]', nama);
    await page.fill('#formTambah input[name="nim"]', nim);
    await page.fill('#formTambah input[name="jurusan"]', 'Teknik Informatika');

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('#formTambah button[type="submit"]')
    ]);

    await searchInTable(page, 'tableAktif', nim);
    await searchInTable(page, 'tableAktif', 'Playwright Search');
  });

});
