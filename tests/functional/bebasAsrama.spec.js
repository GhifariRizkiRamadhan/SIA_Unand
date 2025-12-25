const { test, expect } = require('@playwright/test');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

const prisma = new PrismaClient();

const MAHASISWA_CRED = { email: 'mahasiswa@example.com', password: 'mahasiswa123' };
const PENGELOLA_CRED = { email: 'adminpengelola@example.com', password: 'pengelola123' };

test.describe('Bebas Asrama & Pembayaran Functional Tests', () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async () => {
        try {
            // Ensure database is in a clean state for the test user
            const user = await prisma.user.findUnique({ where: { email: MAHASISWA_CRED.email } });
            if (!user) {
                throw new Error(`Test user ${MAHASISWA_CRED.email} not found. Please run 'npm run seed'.`);
            }

            const mahasiswa = await prisma.mahasiswa.findFirst({ where: { user_id: user.user_id } });
            if (mahasiswa) {
                await prisma.suratbebasasrama.deleteMany({ where: { mahasiswa_id: mahasiswa.mahasiswa_id } });
                console.log('Cleaned up existing submissions for test user.');
            } else {
                console.warn('Mahasiswa profile not found for test user.');
            }
        } catch (error) {
            console.error('Setup failed:', error);
            throw error;
        }
    });

    test.afterAll(async () => {
        await prisma.$disconnect();
    });

    async function login(page, email, password) {
        await page.goto('/login');
        await page.fill('#email', email);
        await page.fill('#password', password);
        await page.click('button[type="submit"]');
        // Wait for navigation or dashboard element
        await expect(page).toHaveURL(/dashboard/);
    }

    async function setKipkStatus(isKipk) {
        const user = await prisma.user.findUnique({ where: { email: MAHASISWA_CRED.email } });
        await prisma.mahasiswa.updateMany({
            where: { user_id: user.user_id },
            data: { kipk: isKipk ? 'ya' : 'tidak' }
        });
    }

    async function logout(page) {
        await page.click('#profile-dropdown');
        await expect(page.locator('#dropdown-menu')).toBeVisible();
        await page.click('a[href="/logout"]');
        await expect(page).toHaveURL(/login/);
    }

    test.beforeEach(async () => {
        try {
            const user = await prisma.user.findUnique({ where: { email: MAHASISWA_CRED.email } });
            if (user) {
                const mahasiswa = await prisma.mahasiswa.findFirst({ where: { user_id: user.user_id } });
                if (mahasiswa) {
                    await prisma.suratbebasasrama.deleteMany({ where: { mahasiswa_id: mahasiswa.mahasiswa_id } });
                    console.log('Cleaned up existing submissions before test.');
                }
            }
        } catch (error) {
            console.error('Cleanup failed:', error);
        }
    });

    // --- Helper Functions ---
    async function submitApplication(page) {
        await page.goto('/mahasiswa/bebas-asrama');
        const createBtn = page.locator('button:has(.fa-plus)');
        await expect(createBtn).toBeVisible();
        await createBtn.click();
        await page.click('#confirmCreate');
        await expect(page.locator('#riwayatTable')).toContainText('Verifikasi Fasilitas');
    }

    async function deleteApplication(page) {
        await page.goto('/mahasiswa/bebas-asrama');
        // Wait for table to load
        await page.waitForResponse(response => response.url().includes('/api/bebas-asrama/mahasiswa') && response.status() === 200);

        const deleteBtn = page.locator('.hapus-btn').first();
        if (await deleteBtn.isVisible()) {
            await deleteBtn.click();
            await expect(page.locator('#deleteModal')).toBeVisible();
            await page.click('#confirmDelete');
            await expect(page.locator('text=Pengajuan berhasil dihapus')).toBeVisible();
            // Wait for the delete button to disappear or table to update
            await expect(page.locator('.hapus-btn')).not.toBeVisible();
        } else {
            console.log('Delete button not found (maybe no active submission)');
        }
    }


    async function verifyFacilities(page, isComplete, damageCost = 0) {
        await page.goto('/pengelola/pengelola-bebas-asrama');
        await page.reload();
        const verifyBtn = page.locator('button:has-text("Verifikasi Fasilitas")').first();
        await verifyBtn.click();
        await expect(page.locator('#facilityVerificationModal')).toBeVisible();

        if (isComplete) {
            await page.check('#complete');
        } else {
            await page.check('#incomplete');
            await page.click('button:has-text("Tambah Fasilitas")');
            await page.fill('#facilityList input[type="text"]', 'Kerusakan Test');
            await page.fill('#facilityList input[type="number"]', damageCost.toString());
        }
        await page.click('#submitFacilityBtn');
        await expect(page.locator('text=Verifikasi fasilitas berhasil disimpan')).toBeVisible();
    }

    async function payBill(page, isReupload = false) {
        await page.goto('/mahasiswa/bebas-asrama');
        await page.click('.bayar-btn');
        await expect(page).toHaveURL(/pembayaran/);

        // Setup dialog listener for potential alerts
        page.once('dialog', dialog => {
            console.log(`Dialog message: ${dialog.message()}`);
            dialog.dismiss().catch(() => { });
        });

        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(path.join(__dirname, '../fixtures/proof.jpg'));

        // Wait for submit button to be enabled
        const submitBtn = page.locator('#submit-btn');
        await expect(submitBtn).toBeEnabled();

        await submitBtn.click();

        // Wait for success modal or handle failure
        try {
            await expect(page.locator('#success-modal')).toBeVisible({ timeout: 10000 });
        } catch (e) {
            console.log('Success modal not visible, checking for error messages...');
            // Check if we are still on the payment page
            if (page.url().includes('/pembayaran')) {
                // Check for any visible error alerts or validation messages if they exist
                // (The view uses window.alert, so the dialog listener above captures it)
                throw new Error('Payment submission failed. Check console for dialog messages.');
            }
            throw e;
        }

        await page.click('#success-modal button');
        await expect(page.locator('#riwayatTable')).toContainText('Verifikasi Pembayaran');
    }

    async function verifyPayment(page, approve) {
        await page.goto('/pengelola/pengelola-bebas-asrama');
        const verifyPayBtn = page.locator('button:has-text("Verifikasi Bayar")').first();
        await verifyPayBtn.click();
        await expect(page.locator('#paymentVerificationModal')).toBeVisible();

        if (approve) {
            await page.click('#approvePaymentBtn');
            await expect(page.locator('text=Pembayaran berhasil diverifikasi')).toBeVisible();
        } else {
            await page.click('#rejectPaymentBtn');
            await expect(page.locator('text=Pembayaran berhasil ditolak')).toBeVisible();
        }
    }

    // --- Tests ---

    test('Test 1: KIPK Clean Flow (Complete Facilities + Delete + Download)', async ({ page }) => {
        page.on('console', msg => console.log(`BROWSER LOG: ${msg.text()}`));
        await setKipkStatus(true);

        // 1. Login & Submit
        await test.step('Submit Application', async () => {
            await login(page, MAHASISWA_CRED.email, MAHASISWA_CRED.password);
            await submitApplication(page);
            await logout(page);
        });

        // 2. Delete Application
        await test.step('Delete Application', async () => {
            await login(page, MAHASISWA_CRED.email, MAHASISWA_CRED.password);
            await deleteApplication(page);
            await logout(page);
        });

        // 3. Submit Again
        await test.step('Submit Again', async () => {
            await login(page, MAHASISWA_CRED.email, MAHASISWA_CRED.password);
            await submitApplication(page);
            await logout(page);
        });

        // 4. Admin Verify Complete
        await test.step('Admin Verify Complete', async () => {
            await login(page, PENGELOLA_CRED.email, PENGELOLA_CRED.password);
            await verifyFacilities(page, true);
            await expect(page.locator('table')).toContainText('Selesai');
            await logout(page);
        });

        // 5. Download Letter
        await test.step('Download Letter', async () => {
            await login(page, MAHASISWA_CRED.email, MAHASISWA_CRED.password);
            await page.goto('/mahasiswa/bebas-asrama');
            await expect(page.locator('#riwayatTable')).toContainText('Selesai');

            const downloadPromise = page.waitForEvent('download');
            await page.click('.unduh-btn');
            const download = await downloadPromise;
            expect(download.suggestedFilename()).toContain('.pdf');
            await logout(page);
        });
    });

    test('Test 2: KIPK Complex Flow (Incomplete + Payment Rejection + Reupload)', async ({ page }) => {
        await setKipkStatus(true);

        // 1. Submit
        await test.step('Submit', async () => {
            await login(page, MAHASISWA_CRED.email, MAHASISWA_CRED.password);
            await submitApplication(page);
            await logout(page);
        });

        // 2. Admin Verify Incomplete
        await test.step('Admin Verify Incomplete', async () => {
            await login(page, PENGELOLA_CRED.email, PENGELOLA_CRED.password);
            await verifyFacilities(page, false, 50000);
            await expect(page.locator('table')).toContainText('Menunggu Pembayaran');
            await logout(page);
        });

        // 3. Student Pay
        await test.step('Student Pay', async () => {
            await login(page, MAHASISWA_CRED.email, MAHASISWA_CRED.password);
            await payBill(page);
            await logout(page);
        });

        // 4. Admin Reject
        await test.step('Admin Reject Payment', async () => {
            await login(page, PENGELOLA_CRED.email, PENGELOLA_CRED.password);
            await verifyPayment(page, false);
            await logout(page);
        });

        // 5. Student Reupload
        await test.step('Student Reupload', async () => {
            await login(page, MAHASISWA_CRED.email, MAHASISWA_CRED.password);
            await page.goto('/mahasiswa/bebas-asrama');
            await expect(page.locator('#riwayatTable')).toContainText('Menunggu Pembayaran');
            await payBill(page, true);
            await logout(page);
        });

        // 6. Admin Approve
        await test.step('Admin Approve', async () => {
            await login(page, PENGELOLA_CRED.email, PENGELOLA_CRED.password);
            await verifyPayment(page, true);
            await expect(page.locator('table')).toContainText('Selesai');
            await logout(page);
        });
    });

    test('Test 3: Non-KIPK Clean Flow (Complete + Payment + Delete + Download)', async ({ page }) => {
        await setKipkStatus(false);

        // 1. Submit
        await test.step('Submit', async () => {
            await login(page, MAHASISWA_CRED.email, MAHASISWA_CRED.password);
            await submitApplication(page);
            await logout(page);
        });

        // 2. Delete Application
        await test.step('Delete Application', async () => {
            await login(page, MAHASISWA_CRED.email, MAHASISWA_CRED.password);
            await deleteApplication(page);
            await logout(page);
        });

        // 3. Submit Again
        await test.step('Submit Again', async () => {
            await login(page, MAHASISWA_CRED.email, MAHASISWA_CRED.password);
            await submitApplication(page);
            await logout(page);
        });

        // 4. Admin Verify Complete
        await test.step('Admin Verify Complete', async () => {
            await login(page, PENGELOLA_CRED.email, PENGELOLA_CRED.password);
            await verifyFacilities(page, true);
            await expect(page.locator('table')).toContainText('Menunggu Pembayaran'); // Non-KIPK pays base cost
            await logout(page);
        });

        // 5. Student Pay
        await test.step('Student Pay', async () => {
            await login(page, MAHASISWA_CRED.email, MAHASISWA_CRED.password);
            await payBill(page);
            await logout(page);
        });

        // 6. Admin Approve
        await test.step('Admin Approve', async () => {
            await login(page, PENGELOLA_CRED.email, PENGELOLA_CRED.password);
            await verifyPayment(page, true);
            await expect(page.locator('table')).toContainText('Selesai');
            await logout(page);
        });

        // 7. Download
        await test.step('Download', async () => {
            await login(page, MAHASISWA_CRED.email, MAHASISWA_CRED.password);
            await page.goto('/mahasiswa/bebas-asrama');
            const downloadPromise = page.waitForEvent('download');
            await page.click('.unduh-btn');
            const download = await downloadPromise;
            expect(download.suggestedFilename()).toContain('.pdf');
            await logout(page);
        });
    });

    test('Test 4: Non-KIPK Complex Flow (Incomplete + Payment Rejection + Reupload)', async ({ page }) => {
        await setKipkStatus(false);

        // 1. Submit
        await test.step('Submit', async () => {
            await login(page, MAHASISWA_CRED.email, MAHASISWA_CRED.password);
            await submitApplication(page);
            await logout(page);
        });

        // 2. Admin Verify Incomplete
        await test.step('Admin Verify Incomplete', async () => {
            await login(page, PENGELOLA_CRED.email, PENGELOLA_CRED.password);
            await verifyFacilities(page, false, 50000);
            await expect(page.locator('table')).toContainText('Menunggu Pembayaran');
            await logout(page);
        });

        // 3. Student Pay
        await test.step('Student Pay', async () => {
            await login(page, MAHASISWA_CRED.email, MAHASISWA_CRED.password);
            await payBill(page);
            await logout(page);
        });

        // 4. Admin Reject
        await test.step('Admin Reject', async () => {
            await login(page, PENGELOLA_CRED.email, PENGELOLA_CRED.password);
            await verifyPayment(page, false);
            await logout(page);
        });

        // 5. Student Reupload
        await test.step('Student Reupload', async () => {
            await login(page, MAHASISWA_CRED.email, MAHASISWA_CRED.password);
            await page.goto('/mahasiswa/bebas-asrama');
            await expect(page.locator('#riwayatTable')).toContainText('Menunggu Pembayaran');
            await payBill(page, true);
            await logout(page);
        });

        // 6. Admin Approve
        await test.step('Admin Approve', async () => {
            await login(page, PENGELOLA_CRED.email, PENGELOLA_CRED.password);
            await verifyPayment(page, true);
            await expect(page.locator('table')).toContainText('Selesai');
            await logout(page);
        });
    });

});
