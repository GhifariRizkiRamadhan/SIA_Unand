// tests/functional/dataPenghuni.spec.js
const { test, expect } = require('@playwright/test');

const PENGELOLA = {email: 'adminpengelola@example.com', password: 'pengelola123' };

test.describe('Data Penghuni - Functional (Pengelola)', () => {

  test.beforeEach(async ({ page }) => {
    // Login sebagai pengelola sebelum tiap test
    await page.goto('/login');
    await page.fill('#email', PENGELOLA.email);
    await page.fill('#password', PENGELOLA.password);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('button[type="submit"]')
    ]);
    await expect(page).toHaveURL(/pengelola/);
  });

  test('1. Halaman Data Penghuni bisa diakses', async ({ page }) => {
    await page.goto('/pengelola/dataPenghuni');
    await expect(page.locator('h1', { hasText: 'Data Penghuni' })).toBeVisible();
  });

  test('2. Tambah penghuni baru berhasil', async ({ page }) => {
    const timestamp = Date.now();
    const nama = `Test Penghuni ${timestamp}`;
    const nim = `TST${timestamp}`;
    const jurusan = 'Teknik Informatika';

    await page.goto('/pengelola/dataPenghuni');
    await page.click('button:has-text("Tambah Penghuni")');

    await page.fill('form#formTambah input[name="nama"]', nama);
    await page.fill('form#formTambah input[name="nim"]', nim);
    await page.fill('form#formTambah input[name="jurusan"]', jurusan);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('form#formTambah button[type="submit"]')
    ]);

    await expect(page.locator('text=Data penghuni berhasil ditambahkan')).toBeVisible();
    await expect(page.locator(`xpath=//td[text()="${nim}"]`)).toBeVisible();
  });

  test('3. Edit penghuni berhasil', async ({ page }) => {
    const timestamp = Date.now();
    const nim = `TST${timestamp}`;
    const nama = `Test Penghuni ${timestamp}`;
    const namaBaru = `Test Penghuni EDIT ${timestamp}`;

    // Tambah data
    await page.goto('/pengelola/dataPenghuni');
    await page.click('button:has-text("Tambah Penghuni")');
    await page.fill('form#formTambah input[name="nama"]', nama);
    await page.fill('form#formTambah input[name="nim"]', nim);
    await page.fill('form#formTambah input[name="jurusan"]', 'Teknik Informatika');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('form#formTambah button[type="submit"]')
    ]);

    // Edit
    const editBtn = page.locator(`xpath=//td[text()="${nim}"]/ancestor::tr//button[@title="Edit"]`);
    await expect(editBtn).toBeVisible();

    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/pengelola/dataPenghuni/get/') && resp.status() === 200),
      editBtn.click()
    ]);

    await expect(page.locator('#modalEdit')).toBeVisible();
    await page.fill('#edit_nama', namaBaru);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('form#formEdit button[type="submit"]')
    ]);

    await expect(page.locator('text=Data penghuni berhasil diupdate')).toBeVisible();

    // ===== FIX: cek kolom Nama spesifik pada baris NIM =====
    // struktur kolom: No (1), Foto (2), Nama (3), NIM (4), ...
    // jadi nama ada di td[3] (1-based). Kita cek dengan XPath yang memilih td[3].
    const nameCell = page.locator(`xpath=//td[text()="${nim}"]/ancestor::tr/td[3]`);
    await expect(nameCell).toHaveText(new RegExp(namaBaru), { timeout: 10000 });
  });

  test('4a. Toggle status penghuni - Nonaktifkan berhasil', async ({ page }) => {
    const timestamp = Date.now();
    const nim = `TST${timestamp}`;
    const nama = `Test Penghuni ${timestamp}`;

    // Tambah data
    await page.goto('/pengelola/dataPenghuni');
    await page.click('button:has-text("Tambah Penghuni")');
    await page.fill('form#formTambah input[name="nama"]', nama);
    await page.fill('form#formTambah input[name="nim"]', nim);
    await page.fill('form#formTambah input[name="jurusan"]', 'Teknik Informatika');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('form#formTambah button[type="submit"]')
    ]);

    // Dapatkan tombol Nonaktifkan pada row baru
    const row = page.locator(`xpath=//td[text()="${nim}"]/ancestor::tr`);
    await expect(row).toBeVisible();
    const nonaktifBtn = row.locator('button[title="Nonaktifkan"]');
    await expect(nonaktifBtn).toBeVisible();

    // Accept confirm
    page.once('dialog', async dialog => { await dialog.accept(); });

    // Klik dan tunggu response ke endpoint toggle
    const toggleResponse = page.waitForResponse(resp =>
      resp.url().includes('/pengelola/dataPenghuni/toggle/') && resp.status() < 400
    );
    await nonaktifBtn.click();
    await toggleResponse;

    await expect(page.locator('text=Status penghuni berhasil diubah')).toBeVisible();
    // Pastikan sekarang berada pada tableTidakAktif
    const moved = page.locator(`xpath=//table[@id="tableTidakAktif"]//td[text()="${nim}"]`);
    await expect(moved).toBeVisible({ timeout: 5000 });
  });

  test('4b. Toggle status penghuni - Aktifkan kembali berhasil', async ({ page }) => {
    const timestamp = Date.now();
    const nim = `TST${timestamp}`;
    const nama = `Test Penghuni ${timestamp}`;

    // Tambah data & nonaktifkan langsung via UI to reach "tidak aktif" state
    await page.goto('/pengelola/dataPenghuni');
    await page.click('button:has-text("Tambah Penghuni")');
    await page.fill('form#formTambah input[name="nama"]', nama);
    await page.fill('form#formTambah input[name="nim"]', nim);
    await page.fill('form#formTambah input[name="jurusan"]', 'Teknik Informatika');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('form#formTambah button[type="submit"]')
    ]);

    // Nonaktifkan
    let row = page.locator(`xpath=//td[text()="${nim}"]/ancestor::tr`);
    await expect(row).toBeVisible();
    page.once('dialog', async dialog => { await dialog.accept(); });
    let nonaktifBtn = row.locator('button[title="Nonaktifkan"]');
    const resp1 = page.waitForResponse(resp => resp.url().includes('/pengelola/dataPenghuni/toggle/') && resp.status() < 400);
    await nonaktifBtn.click();
    await resp1;
    await expect(page.locator('text=Status penghuni berhasil diubah')).toBeVisible();

    // Sekarang cari row di tableTidakAktif lalu klik Aktifkan
    const notActiveRow = page.locator(`xpath=//table[@id="tableTidakAktif"]//td[text()="${nim}"]/ancestor::tr`);
    await expect(notActiveRow).toBeVisible({ timeout: 5000 });
    const activateBtn = notActiveRow.locator('button[title="Aktifkan"]');
    await expect(activateBtn).toBeVisible();

    page.once('dialog', async dialog => { await dialog.accept(); });
    const resp2 = page.waitForResponse(resp => resp.url().includes('/pengelola/dataPenghuni/toggle/') && resp.status() < 400);
    await activateBtn.click();
    await resp2;

    await expect(page.locator('text=Status penghuni berhasil diubah')).toBeVisible();
    // Pastikan kembali di tableAktif
    const movedBack = page.locator(`xpath=//table[@id="tableAktif"]//td[text()="${nim}"]`);
    await expect(movedBack).toBeVisible({ timeout: 5000 });
  });

  test('5. Show entries (page length) pada DataTables berfungsi', async ({ page }) => {
    // Buat 3 data supaya kita bisa tes pagination/length
    const base = Date.now();
    const items = [
      { nim: `S${base}1`, nama: `Show Test 1 ${base}` },
      { nim: `S${base}2`, nama: `Show Test 2 ${base}` },
      { nim: `S${base}3`, nama: `Show Test 3 ${base}` }
    ];

    await page.goto('/pengelola/dataPenghuni');

    for (const it of items) {
      await page.click('button:has-text("Tambah Penghuni")');
      await page.fill('form#formTambah input[name="nama"]', it.nama);
      await page.fill('form#formTambah input[name="nim"]', it.nim);
      await page.fill('form#formTambah input[name="jurusan"]', 'Teknik Informatika');
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle' }),
        page.click('form#formTambah button[type="submit"]')
      ]);
      await expect(page.locator('text=Data penghuni berhasil ditambahkan')).toBeVisible();
    }

    // Pastikan lebih dari 1 row ada
    const totalRows = await page.locator('#tableAktif tbody tr').count();
    expect(totalRows).toBeGreaterThanOrEqual(3);

    // Gunakan DataTables API untuk set page length ke 1 (memastikan plugin tersedia di halaman)
    await page.evaluate(() => {
      // eslint-disable-next-line no-undef
      if (window.$ && $.fn.dataTable && $.fn.dataTable.isDataTable('#tableAktif')) {
        $('#tableAktif').DataTable().page.len(1).draw();
      } else {
        // fallback: try multiple selects if DataTables not initialized yet
        const sel = document.querySelector('#tableAktif_length select');
        if (sel) sel.value = '1', sel.dispatchEvent(new Event('change'));
      }
    });

    // Tunggu redraw + pastikan hanya 1 row yang terlihat di tbody
    await page.waitForTimeout(500); // beri waktu redraw
    const visibleRows = await page.locator('#tableAktif tbody tr').evaluateAll(rows =>
      rows.filter(r => r.offsetParent !== null).length
    );
    expect(visibleRows).toBeLessThanOrEqual(1);
  });

  test('6. Search box DataTables mencari row berdasarkan NIM atau Nama', async ({ page }) => {
    const timestamp = Date.now();
    const nim = `Q${timestamp}`;
    const nama = `Search Test ${timestamp}`;

    await page.goto('/pengelola/dataPenghuni');
    // Tambah data target
    await page.click('button:has-text("Tambah Penghuni")');
    await page.fill('form#formTambah input[name="nama"]', nama);
    await page.fill('form#formTambah input[name="nim"]', nim);
    await page.fill('form#formTambah input[name="jurusan"]', 'Teknik Informatika');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('form#formTambah button[type="submit"]')
    ]);
    await expect(page.locator('text=Data penghuni berhasil ditambahkan')).toBeVisible();

    // Pilih search input yang mengontrol tableAktif (hindari ambiguitas)
    const searchInput = page.locator('input[aria-controls="tableAktif"], #tableAktif_filter input[type="search"]');
    await expect(searchInput.first()).toBeVisible();

    // Ketik NIM dan tunggu filter
    await searchInput.first().fill(nim);
    await page.waitForTimeout(400);

    // Pastikan ada row yang mengandung NIM pada tableAktif
    const found = await page.locator(`xpath=//table[@id="tableAktif"]//td[text()="${nim}"]`).count();
    expect(found).toBeGreaterThanOrEqual(1);

    // Bersihkan search, coba cari by nama (partial)
    await searchInput.first().fill('');
    await page.waitForTimeout(200);
    await searchInput.first().fill('Search Test');
    await page.waitForTimeout(400);
    const foundName = await page.locator(`xpath=//table[@id="tableAktif"]//td[contains(text(),"Search Test")]`).count();
    expect(foundName).toBeGreaterThanOrEqual(1);
  });

});
