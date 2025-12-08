// Functional tests for Notification Controller using Playwright
// Requirements:
// - The application server must be running at http://localhost:3000
// - The database should have seeded users (see prisma/seeder/userSeed.js)
// - Dev dependency: @playwright/test
// To run: `npx playwright test tests/functional/notification.spec.js`

const { test, expect } = require('@playwright/test');

// User credentials dari seeder (prisma/seeder/userSeed.js)
const MAHASISWA = { email: 'mahasiswa@example.com', password: 'mahasiswa123' };

test.describe('Functional: Notification Controller', () => {
  test.beforeEach(async ({ page, context }) => {
    // Use a real JWT with actual database user
    // First, we need to get a real user ID from the database
    
    const { PrismaClient } = require('@prisma/client');
    const jwt = require('jsonwebtoken');
    const prisma = new PrismaClient();
    
    const JWT_SECRET = 'gipa123';
    
    // Find or create a test mahasiswa user
    let user = await prisma.user.findFirst({
      where: { email: MAHASISWA.email }
    });
    
    if (!user) {
      console.log(`[beforeEach] User ${MAHASISWA.email} not found, creating...`);
      const bcrypt = require('bcryptjs');
      const { v4: uuidv4 } = await import('uuid');
      
      const userId = uuidv4();
      const hashedPassword = bcrypt.hashSync(MAHASISWA.password, 10);
      
      user = await prisma.user.create({
        data: {
          user_id: userId,
          name: 'Mahasiswa A',
          email: MAHASISWA.email,
          password: hashedPassword,
          role: 'mahasiswa',
          mahasiswa: {
            create: {
              nim: '20250001',
              nama: 'Mahasiswa A'
            }
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
    
    // Create some test notifications for this user
    await prisma.notification.createMany({
      data: [
        {
          user_id: user.user_id,
          title: 'Notifikasi Test 1',
          message: 'Ini adalah notifikasi test 1',
          type: 'info',
          is_read: false
        },
        {
          user_id: user.user_id,
          title: 'Notifikasi Test 2',
          message: 'Ini adalah notifikasi test 2',
          type: 'success',
          is_read: false
        },
        {
          user_id: user.user_id,
          title: 'Notifikasi Test 3 (sudah dibaca)',
          message: 'Ini adalah notifikasi test 3 yang sudah dibaca',
          type: 'warning',
          is_read: true
        }
      ]
    });
    
    console.log(`[beforeEach] Created test notifications`);
    
    // Disconnect Prisma
    await prisma.$disconnect();
    
    // Navigate to dashboard so we have a starting page
    await page.goto('/mahasiswa/dashboard', { waitUntil: 'domcontentloaded', timeout: 10000 });
    console.log(`[beforeEach] Navigated to: ${page.url()}`);
    
    // Check if authentication failed
    if (page.url().includes('/login')) {
      console.log('[beforeEach] Authentication failed, redirected to login');
      throw new Error('Authentication failed');
    }
  });

  test('Get notifications - menampilkan list notifikasi dengan status read dan unread', async ({ page }) => {
    console.log('[Test 1] Starting: Get notifications');
    
    // Make API request to get notifications
    const response = await page.request.get('/api/notifications');
    const data = await response.json();
    
    console.log(`[Test 1] Response status: ${response.status()}`);
    console.log(`[Test 1] Response data: ${JSON.stringify(data, null, 2).substring(0, 200)}`);
    
    // Verify response is successful
    expect(response.status()).toBe(200);
    expect(data.success).toBe(true);
    
    // Verify data structure
    expect(data.data).toBeDefined();
    expect(data.data.unread).toBeDefined();
    expect(data.data.read).toBeDefined();
    expect(data.data.unreadCount).toBeDefined();
    
    console.log(`[Test 1] Unread count: ${data.data.unreadCount}`);
    console.log(`[Test 1] Read count: ${data.data.read.length}`);
    
    // Verify we have the test notifications
    expect(data.data.unreadCount).toBeGreaterThanOrEqual(2);
    expect(data.data.unread.length).toBeGreaterThanOrEqual(2);
    expect(data.data.read.length).toBeGreaterThanOrEqual(1);
    
    // Verify notification structure
    const unreadNotif = data.data.unread[0];
    expect(unreadNotif).toHaveProperty('notification_id');
    expect(unreadNotif).toHaveProperty('title');
    expect(unreadNotif).toHaveProperty('message');
    expect(unreadNotif).toHaveProperty('type');
    expect(unreadNotif).toHaveProperty('is_read');
    expect(unreadNotif.is_read).toBe(false);
    
    console.log('[Test 1] PASSED: Notifications retrieved successfully');
  });

  test('Mark single notification as read', async ({ page }) => {
    console.log('[Test 2] Starting: Mark single notification as read');
    
    // First get notifications
    const getResponse = await page.request.get('/api/notifications');
    const getData = await getResponse.json();
    
    expect(getData.success).toBe(true);
    expect(getData.data.unread.length).toBeGreaterThan(0);
    
    const notificationToMark = getData.data.unread[0];
    const notifId = notificationToMark.notification_id;
    
    console.log(`[Test 2] Marking notification ID ${notifId} as read`);
    
    // Mark the first unread notification as read
    const markResponse = await page.request.put(`/api/notifications/${notifId}/read`);
    const markData = await markResponse.json();
    
    console.log(`[Test 2] Mark response status: ${markResponse.status()}`);
    console.log(`[Test 2] Mark response: ${JSON.stringify(markData, null, 2).substring(0, 200)}`);
    
    expect(markResponse.status()).toBe(200);
    expect(markData.success).toBe(true);
    
    // Verify by getting notifications again
    const verifyResponse = await page.request.get('/api/notifications');
    const verifyData = await verifyResponse.json();
    
    expect(verifyData.success).toBe(true);
    
    // The unread count should have decreased
    const beforeUnreadCount = getData.data.unreadCount;
    const afterUnreadCount = verifyData.data.unreadCount;
    
    console.log(`[Test 2] Before: ${beforeUnreadCount} unread, After: ${afterUnreadCount} unread`);
    
    expect(afterUnreadCount).toBe(beforeUnreadCount - 1);
    
    // Verify the notification is now in the read list
    const readNotificationIds = verifyData.data.read.map(n => n.notification_id);
    expect(readNotificationIds).toContain(notifId);
    
    console.log('[Test 2] PASSED: Single notification marked as read');
  });

  test('Mark all notifications as read', async ({ page }) => {
    console.log('[Test 3] Starting: Mark all notifications as read');
    
    // Get notifications before marking all as read
    const beforeResponse = await page.request.get('/api/notifications');
    const beforeData = await beforeResponse.json();
    
    expect(beforeData.success).toBe(true);
    const beforeUnreadCount = beforeData.data.unreadCount;
    
    console.log(`[Test 3] Before marking all: ${beforeUnreadCount} unread notifications`);
    
    // Skip test if there are no unread notifications
    if (beforeUnreadCount === 0) {
      console.log('[Test 3] Skipping: No unread notifications');
      test.skip();
      return;
    }
    
    // Mark all as read
    const markAllResponse = await page.request.put('/api/notifications/read-all');
    const markAllData = await markAllResponse.json();
    
    console.log(`[Test 3] Mark all response status: ${markAllResponse.status()}`);
    console.log(`[Test 3] Mark all response: ${JSON.stringify(markAllData, null, 2).substring(0, 200)}`);
    
    expect(markAllResponse.status()).toBe(200);
    expect(markAllData.success).toBe(true);
    
    // Verify by getting notifications again
    const afterResponse = await page.request.get('/api/notifications');
    const afterData = await afterResponse.json();
    
    expect(afterResponse.status()).toBe(200);
    expect(afterData.data.unreadCount).toBe(0);
    
    console.log(`[Test 3] After marking all: ${afterData.data.unreadCount} unread notifications`);
    console.log(`[Test 3] Total read notifications: ${afterData.data.read.length}`);
    
    // All notifications should be in the read list
    expect(afterData.data.unread.length).toBe(0);
    expect(afterData.data.read.length).toBeGreaterThan(0);
    
    console.log('[Test 3] PASSED: All notifications marked as read');
  });

  test('Unauthorized access - no token provided', async ({ page }) => {
    console.log('[Test 4] Starting: Unauthorized access test');
    
    // Try to access notifications without token by setting an empty cookie
    const response = await page.request.get('http://localhost:3000/api/notifications', {
      headers: {
        'Cookie': '' // No token cookie
      }
    });
    
    console.log(`[Test 4] Response status: ${response.status()}`);
    
    expect(response.status()).toBe(401);
    
    const data = await response.json();
    console.log(`[Test 4] Response: ${JSON.stringify(data)}`);
    
    expect(data.success).toBe(false);
    expect(data.message).toContain('Unauthorized');
    
    console.log('[Test 4] PASSED: Unauthorized request properly rejected');
  });
});
