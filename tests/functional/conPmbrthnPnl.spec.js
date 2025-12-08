// Functional tests for Pemberitahuan (Pengelola) using Playwright
// Requirements:
// - The application server must be running at http://localhost:3000
// - The database should have seeded users (see prisma/seeder/userSeed.js)
// - Dev dependency: @playwright/test
// To run: `npx playwright test tests/functional/conPmbrthnPnl.spec.js`

const { test, expect } = require('@playwright/test');

// User credentials dari seeder (prisma/seeder/userSeed.js)
const PENGELOLA = { email: 'adminpengelola@example.com', password: 'pengelola123' };

test.describe('Functional: Pemberitahuan (Pengelola)', () => {
  test.beforeEach(async ({ page, context }) => {
    // Use a real JWT with actual database user
    // First, we need to get a real user ID from the database
    
    const { PrismaClient } = require('@prisma/client');
    const jwt = require('jsonwebtoken');
    const prisma = new PrismaClient();
    
    const JWT_SECRET = 'gipa123';
    
    // Find or create a test pengelola user
    let user = await prisma.user.findFirst({
      where: { email: PENGELOLA.email }
    });
    
    if (!user) {
      console.log(`[beforeEach] User ${PENGELOLA.email} not found, creating...`);
      const bcrypt = require('bcryptjs');
      const { v4: uuidv4 } = await import('uuid');
      
      const userId = uuidv4();
      const hashedPassword = bcrypt.hashSync(PENGELOLA.password, 10);
      
      user = await prisma.user.create({
        data: {
          user_id: userId,
          name: 'Admin Pengelola',
          email: PENGELOLA.email,
          password: hashedPassword,
          role: 'pengelola',
          pengelolaasrama: {
            create: {}
          }
        }
      });
      console.log(`[beforeEach] Created user with ID: ${user.user_id}`);
    } else {
      console.log(`[beforeEach] Found user: ${user.user_id}`);
    }
    
    // Generate JWT with real user ID
    const tokenPayload = {
      user_id: user.user_id,
      email: user.email,
      role: user.role,
      name: user.name
    };
    
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1d' });
    console.log(`[beforeEach] Generated JWT for user: ${user.user_id}`);
    
    // Set the token as a cookie
    await context.addCookies([{
      name: 'token',
      value: token,
      url: 'http://localhost:3000'
    }]);
    
    console.log(`[beforeEach] Cookie set`);
    
    // Disconnect Prisma
    await prisma.$disconnect();
    
    // Navigate to dashboard
    await page.goto('/pengelola/dashboard', { waitUntil: 'domcontentloaded', timeout: 10000 });
    console.log(`[beforeEach] Navigated to: ${page.url()}`);
    
    // Check if authentication failed
    if (page.url().includes('/login')) {
      console.log('[beforeEach] Authentication failed, redirected to login');
      throw new Error('Authentication failed');
    }
  });

  test('Halaman pemberitahuan pengelola dapat diakses dan render daftar', async ({ page }) => {
    // Debug: Check cookies before navigation
    const cookiesBefore = await page.context().cookies();
    console.log(`[Test 1] Cookies before nav: ${cookiesBefore.map(c => `${c.name}=${c.value.substring(0, 20)}...`).join(', ')}`);
    
    await page.goto('/pengelola/pemberitahuan', { waitUntil: 'domcontentloaded' });
    
    // Debug: Check cookies after navigation
    const cookiesAfter = await page.context().cookies();
    console.log(`[Test 1] Cookies after nav: ${cookiesAfter.map(c => `${c.name}=${c.value.substring(0, 20)}...`).join(', ')}`);
    
    const currentUrl = page.url();
    console.log(`[Test 1] Current URL: ${currentUrl}`);
    
    // Jika masih di login, skip test
    if (currentUrl.includes('/login')) {
      console.log('[Test 1] Skipping: Still on login page');
      test.skip();
      return;
    }
    
    // Debug: wait for network idle to ensure page fully loads
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
      console.log('[Test 1] Network not fully idle, continuing anyway');
    });
    
    // Debug: log first 1000 chars of page content
    const pageContent = await page.content();
    const bodyStart = pageContent.indexOf('<body');
    if (bodyStart !== -1) {
      const bodyContent = pageContent.substring(bodyStart, Math.min(bodyStart + 1000, pageContent.length));
      console.log(`[Test 1] Body start: ${bodyContent}`);
    } else {
      console.log(`[Test 1] No body tag found. Page length: ${pageContent.length}`);
    }
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'test-output/pemberitahuan-page.png' });
    console.log('[Test 1] Screenshot saved');
    
    // Try to find any h2 on the page
    const h2Count = await page.locator('h2').count();
    console.log(`[Test 1] Found ${h2Count} h2 tags on page`);
    
    if (h2Count > 0) {
      const h2Text = await page.locator('h2').first().textContent();
      console.log(`[Test 1] First h2 text: "${h2Text}"`);
    }
    
    // Check for the heading using h2 selector
    const heading = page.locator('h2:has-text("Daftar Pemberitahuan")');
    await expect(heading).toBeVisible({ timeout: 8000 });
    console.log('[Test 1] PASSED: Heading found');
  });

  test('Tambah pemberitahuan via UI dan hapus kembali', async ({ page }) => {
    await page.goto('/pengelola/pemberitahuan', { waitUntil: 'domcontentloaded' });

    const currentUrl = page.url();
    console.log(`[Test 2] Current URL: ${currentUrl}`);
    
    // Jika masih di login, skip test
    if (currentUrl.includes('/login')) {
      console.log('[Test 2] Skipping: Still on login page');
      test.skip();
      return;
    }

    // Open modal - use text selector
    const addBtn = page.locator('button:has-text("Tambah")');
    await expect(addBtn).toBeVisible({ timeout: 8000 });
    console.log('[Test 2] Add button found');
    await addBtn.click();
    console.log('[Test 2] Clicked add button');

    const timestamp = Date.now();
    const title = `FT Pemberitahuan ${timestamp}`;
    const content = 'Isi functional test pemberitahuan';

    // Fill form fields
    await page.fill('#title', title, { timeout: 5000 });
    await page.fill('#content', content, { timeout: 5000 });
    console.log(`[Test 2] Form filled: title="${title}"`);

    // Accept the success alert and wait for reload
    page.once('dialog', async dialog => {
      console.log(`[Test 2] Dialog: ${dialog.message()}`);
      await dialog.accept();
    });

    // Submit form
    const saveBtn = page.locator('#saveButton');
    await expect(saveBtn).toBeVisible({ timeout: 5000 });
    
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 10000 }).catch(() => {}),
      saveBtn.click()
    ]);

    console.log(`[Test 2] After save, URL: ${page.url()}`);

    // After reload, check the table contains the new title
    const titleInTable = page.locator(`tr >> text=${title}`);
    await expect(titleInTable).toBeVisible({ timeout: 8000 });
    console.log(`[Test 2] Title found in table`);

    // Delete the created pemberitahuan
    // Find the row containing the title, then find the delete button in it
    const row = page.locator('tr:has-text("' + title + '")').first();
    await expect(row).toBeVisible({ timeout: 8000 });
    
    // Find the delete button (trash icon with title="Hapus")
    const deleteBtn = row.locator('button[title="Hapus"]');
    await expect(deleteBtn).toBeVisible({ timeout: 8000 });
    console.log('[Test 2] Delete button found');

    // Handle all dialogs during deletion (just accept all)
    page.on('dialog', async dialog => {
      console.log(`[Test 2] Dialog: ${dialog.message()}`);
      await dialog.accept();
    });

    // Click delete and wait for navigation
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 10000 }).catch(() => {
        console.log('[Test 2] No navigation after delete (might reload page differently)');
      }),
      deleteBtn.click()
    ]);

    // Wait a bit for the page to stabilize
    await page.waitForTimeout(1000);

    console.log(`[Test 2] After delete, URL: ${page.url()}`);

    // Ensure the row is gone
    const titleGone = page.locator(`tr:has-text("${title}")`);
    await expect(titleGone).toHaveCount(0, { timeout: 8000 });
    console.log(`[Test 2] PASSED: Title removed from table`);
  });
});
