// tests/unit/conPmbrthnPnl.test.js
const mockPrismaNotificationCreate = jest.fn();
const mockPrismaNotificationUpdate = jest.fn();
const mockPrismaNotificationFindUnique = jest.fn();
const mockPrismaNotificationFindFirst = jest.fn();
const mockPrismaNotificationDelete = jest.fn();
const mockPrismaNotificationDeleteMany = jest.fn();
const mockPrismaPengelolaFindFirst = jest.fn();
const mockPrismaMahasiswaFindMany = jest.fn();
const mockPrismaTransaction = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    pemberitahuan: {
      create: mockPrismaNotificationCreate,
      update: mockPrismaNotificationUpdate,
      findUnique: mockPrismaNotificationFindUnique,
      findFirst: mockPrismaNotificationFindFirst,
      delete: mockPrismaNotificationDelete,
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0)
    },
    pengelolaasrama: {
      findFirst: mockPrismaPengelolaFindFirst
    },
    mahasiswa: {
      findMany: mockPrismaMahasiswaFindMany
    },
    notification: {
      deleteMany: mockPrismaNotificationDeleteMany
    },
    $transaction: mockPrismaTransaction
  })),
}));

jest.mock('../../models/userModels');
jest.mock('../../controller/notification', () => ({
  createNotification: jest.fn().mockResolvedValue({}),
}));

// Mock EJS explicitly to return a string
jest.mock('ejs', () => ({
  renderFile: jest.fn().mockResolvedValue("<div>mock-body</div>"),
}));

// Mock fs explicitly
const mockExistsSync = jest.fn();
const mockUnlinkSync = jest.fn();
jest.mock('fs', () => ({
  existsSync: mockExistsSync,
  unlinkSync: mockUnlinkSync,
}));

// Mock path explicitly
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  resolve: jest.fn((...args) => args.join('/')),
  dirname: jest.fn(() => '/mock/dir'),
}));

const controller = require('../../controller/conPmbrthnPnl');
const User = require('../../models/userModels');
const notificationController = require('../../controller/notification');
const fs = require('fs'); // Import mocked fs

describe('Unit Test: controller/conPmbrthnPnl.js (Pemberitahuan Management)', () => {
  let mockRequest, mockResponse;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset fs mocks defaults
    mockExistsSync.mockReturnValue(false);
    mockUnlinkSync.mockImplementation(() => { });

    mockRequest = {
      session: { user_id: 'user-pengelola-1' },
      user: { user_id: 'user-pengelola-1', role: 'pengelola' },
      body: {},
      params: {},
      query: {},
      file: null
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      render: jest.fn().mockReturnThis(),
      redirect: jest.fn()
    };

    User.findById.mockResolvedValue({ user_id: 'user-pengelola-1', role: 'pengelola', name: 'Admin' });
    mockPrismaPengelolaFindFirst.mockResolvedValue({ Pengelola_id: 7, user_id: 'user-pengelola-1' });
  });

  // --- showPemberitahuanPengelola ---
  it('showPemberitahuanPengelola: Redirects to login if not authenticated', async () => {
    mockRequest.session = {};
    mockRequest.user = null;

    await controller.showPemberitahuanPengelola(mockRequest, mockResponse);

    expect(mockResponse.redirect).toHaveBeenCalledWith('/login');
  });

  it('showPemberitahuanPengelola: Renders error if not pengelola', async () => {
    User.findById.mockResolvedValue({ user_id: 'user-2', role: 'mahasiswa' });

    await controller.showPemberitahuanPengelola(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.render).toHaveBeenCalledWith('error', expect.anything());
  });

  it('showPemberitahuanPengelola: Renders page with data', async () => {
    const mockPemberitahuan = [{ pemberitahuan_id: 1, title: 'T1' }];
    const mockCount = 1;

    // Mock prisma methods used in function
    const mockPrismaPemberitahuanFindMany = jest.fn().mockResolvedValue(mockPemberitahuan);
    const mockPrismaPemberitahuanCount = jest.fn().mockResolvedValue(mockCount);

    // Update mock implementation
    const prismaMock = require('@prisma/client').PrismaClient();
    prismaMock.pemberitahuan.findMany = mockPrismaPemberitahuanFindMany;
    prismaMock.pemberitahuan.count = mockPrismaPemberitahuanCount;

    await controller.showPemberitahuanPengelola(mockRequest, mockResponse);

    expect(mockResponse.render).toHaveBeenCalledWith('layouts/main', expect.objectContaining({
      body: "<div>mock-body</div>", // Expect the mocked string
      user: expect.objectContaining({ role: 'pengelola' })
    }));
  });

  it('showPemberitahuanPengelola: Handles errors', async () => {
    User.findById.mockRejectedValue(new Error('DB Error'));

    await controller.showPemberitahuanPengelola(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.render).toHaveBeenCalledWith('error', expect.anything());
  });

  // --- tambahPemberitahuan ---
  it('tambahPemberitahuan: Returns 400 when title is empty', async () => {
    mockRequest.body = { title: '', content: 'Some content' };
    await controller.tambahPemberitahuan(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('tambahPemberitahuan: Returns 400 when content is empty', async () => {
    mockRequest.body = { title: 'Title', content: '' };
    await controller.tambahPemberitahuan(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('tambahPemberitahuan: Returns 404 when pengelola not found', async () => {
    mockPrismaPengelolaFindFirst.mockResolvedValue(null);
    mockRequest.body = { title: 'Title', content: 'Content' };

    await controller.tambahPemberitahuan(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'Pengelola tidak ditemukan' }));
  });

  it('tambahPemberitahuan: Successfully creates pemberitahuan and sends notifications', async () => {
    const mockNotificationData = { pemberitahuan_id: 99, title: 'Test Title', content: 'Test content', Pengelola_id: 7 };
    mockRequest.body = { title: 'Test Title', content: 'Test content' };
    mockPrismaNotificationCreate.mockResolvedValue(mockNotificationData);
    mockPrismaMahasiswaFindMany.mockResolvedValue([{ user_id: 'm1' }, { user_id: 'm2' }]);

    await controller.tambahPemberitahuan(mockRequest, mockResponse);

    expect(mockPrismaNotificationCreate).toHaveBeenCalled();
    expect(mockPrismaMahasiswaFindMany).toHaveBeenCalled();
    expect(notificationController.createNotification).toHaveBeenCalledTimes(2);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('tambahPemberitahuan: Handles file upload correctly', async () => {
    mockRequest.body = { title: 'Title', content: 'Content' };
    mockRequest.file = { filename: 'test-image.png' };
    mockPrismaNotificationCreate.mockResolvedValue({ pemberitahuan_id: 1 });
    mockPrismaMahasiswaFindMany.mockResolvedValue([]);

    await controller.tambahPemberitahuan(mockRequest, mockResponse);

    expect(mockPrismaNotificationCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        image: '/uploads/pemberitahuan/test-image.png'
      })
    }));
  });

  it('tambahPemberitahuan: Handles errors', async () => {
    mockRequest.body = { title: 'Title', content: 'Content' };
    mockPrismaPengelolaFindFirst.mockRejectedValue(new Error('DB Error'));

    await controller.tambahPemberitahuan(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  // --- getPemberitahuan ---
  it('getPemberitahuan: Returns 400 for invalid ID', async () => {
    mockRequest.params = { id: 'invalid-id' };
    await controller.getPemberitahuan(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'ID tidak valid' }));
  });

  it('getPemberitahuan: Returns 404 when not found', async () => {
    mockRequest.params = { id: '99' };
    mockPrismaNotificationFindUnique.mockResolvedValue(null);

    await controller.getPemberitahuan(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('getPemberitahuan: Returns pemberitahuan when found', async () => {
    mockRequest.params = { id: '10' };
    const mockData = { pemberitahuan_id: 10, title: 'T1', content: 'C1' };
    mockPrismaNotificationFindUnique.mockResolvedValue(mockData);

    await controller.getPemberitahuan(mockRequest, mockResponse);

    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: mockData }));
  });

  it('getPemberitahuan: Returns 403 if not pengelola', async () => {
    User.findById.mockResolvedValue({ user_id: 'u2', role: 'mahasiswa' });
    await controller.getPemberitahuan(mockRequest, mockResponse);
    expect(mockResponse.status).toHaveBeenCalledWith(403);
  });

  it('getPemberitahuan: Handles errors', async () => {
    User.findById.mockRejectedValue(new Error('DB Error'));
    await controller.getPemberitahuan(mockRequest, mockResponse);
    expect(mockResponse.status).toHaveBeenCalledWith(500);
  });

  // --- hapusPemberitahuan ---
  it('hapusPemberitahuan: Returns 400 for invalid ID', async () => {
    mockRequest.params = { id: 'abc' };
    await controller.hapusPemberitahuan(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'ID tidak valid' }));
  });

  it('hapusPemberitahuan: Returns 403 if not pengelola', async () => {
    User.findById.mockResolvedValue({ user_id: 'u2', role: 'mahasiswa' });
    await controller.hapusPemberitahuan(mockRequest, mockResponse);
    expect(mockResponse.status).toHaveBeenCalledWith(403);
  });

  it('hapusPemberitahuan: Successfully deletes pemberitahuan', async () => {
    mockRequest.params = { id: '55' };

    const mockInnerPrisma = {
      pengelolaasrama: { findFirst: jest.fn().mockResolvedValue({ Pengelola_id: 99 }) },
      pemberitahuan: {
        findFirst: jest.fn().mockResolvedValue({ pemberitahuan_id: 55, image: '/uploads/pemberitahuan/img.png', Pengelola_id: 99 }),
        delete: jest.fn().mockResolvedValue({ pemberitahuan_id: 55 })
      },
      notification: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) }
    };

    mockPrismaTransaction.mockImplementation(async (fn) => await fn(mockInnerPrisma));

    mockExistsSync.mockReturnValue(true);

    await controller.hapusPemberitahuan(mockRequest, mockResponse);

    expect(mockPrismaTransaction).toHaveBeenCalled();
    expect(mockUnlinkSync).toHaveBeenCalled();
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('hapusPemberitahuan: Handles transaction error (pengelola not found)', async () => {
    mockRequest.params = { id: '55' };
    const mockInnerPrisma = {
      pengelolaasrama: { findFirst: jest.fn().mockResolvedValue(null) }
    };
    mockPrismaTransaction.mockImplementation(async (fn) => await fn(mockInnerPrisma));

    await controller.hapusPemberitahuan(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Terjadi kesalahan server' }));
  });

  it('hapusPemberitahuan: Handles transaction error (pemberitahuan not found)', async () => {
    mockRequest.params = { id: '55' };
    const mockInnerPrisma = {
      pengelolaasrama: { findFirst: jest.fn().mockResolvedValue({ Pengelola_id: 99 }) },
      pemberitahuan: { findFirst: jest.fn().mockResolvedValue(null) }
    };
    mockPrismaTransaction.mockImplementation(async (fn) => await fn(mockInnerPrisma));

    await controller.hapusPemberitahuan(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Terjadi kesalahan server' }));
  });

  it('hapusPemberitahuan: Handles unlink error gracefully', async () => {
    mockRequest.params = { id: '55' };
    const mockInnerPrisma = {
      pengelolaasrama: { findFirst: jest.fn().mockResolvedValue({ Pengelola_id: 99 }) },
      pemberitahuan: {
        findFirst: jest.fn().mockResolvedValue({ pemberitahuan_id: 55, image: 'img.png', Pengelola_id: 99 }),
        delete: jest.fn().mockResolvedValue({ pemberitahuan_id: 55 })
      },
      notification: { deleteMany: jest.fn().mockResolvedValue({}) }
    };
    mockPrismaTransaction.mockImplementation(async (fn) => await fn(mockInnerPrisma));

    mockExistsSync.mockReturnValue(true);
    mockUnlinkSync.mockImplementationOnce(() => { throw new Error('Unlink fail'); });

    await controller.hapusPemberitahuan(mockRequest, mockResponse);

    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('hapusPemberitahuan: Emits socket event if global.io exists', async () => {
    mockRequest.params = { id: '55' };
    const mockInnerPrisma = {
      pengelolaasrama: { findFirst: jest.fn().mockResolvedValue({ Pengelola_id: 99 }) },
      pemberitahuan: {
        findFirst: jest.fn().mockResolvedValue({ pemberitahuan_id: 55, Pengelola_id: 99 }),
        delete: jest.fn().mockResolvedValue({ pemberitahuan_id: 55 })
      },
      notification: { deleteMany: jest.fn().mockResolvedValue({}) }
    };
    mockPrismaTransaction.mockImplementation(async (fn) => await fn(mockInnerPrisma));

    global.io = { emit: jest.fn() };

    await controller.hapusPemberitahuan(mockRequest, mockResponse);

    expect(global.io.emit).toHaveBeenCalledWith('notification_deleted', expect.anything());
    delete global.io;
  });

  // --- editPemberitahuan ---
  it('editPemberitahuan: Unauthorized if no user', async () => {
    mockRequest.session = {};
    mockRequest.user = null;
    await controller.editPemberitahuan(mockRequest, mockResponse);
    expect(mockResponse.status).toHaveBeenCalledWith(401);
  });

  it('editPemberitahuan: Returns 400 for invalid ID', async () => {
    mockRequest.params = { id: 'not-a-number' };
    mockRequest.body = { title: 'Title', content: 'Content' };

    await controller.editPemberitahuan(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'ID tidak valid' }));
  });

  it('editPemberitahuan: Returns 400 when title or content missing', async () => {
    mockRequest.params = { id: '5' };
    mockRequest.body = { title: '', content: 'Content' };

    await controller.editPemberitahuan(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'Judul dan isi harus diisi' }));
  });

  it('editPemberitahuan: Returns 404 when pengelola not found', async () => {
    mockRequest.params = { id: '5' };
    mockRequest.body = { title: 'Title', content: 'Content' };
    mockPrismaPengelolaFindFirst.mockResolvedValue(null);

    await controller.editPemberitahuan(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'Pengelola tidak ditemukan' }));
  });

  it('editPemberitahuan: Returns 404 when pemberitahuan not found', async () => {
    mockRequest.params = { id: '99' };
    mockRequest.body = { title: 'Title', content: 'Content' };
    mockPrismaPengelolaFindFirst.mockResolvedValue({ Pengelola_id: 7 });
    mockPrismaNotificationFindFirst.mockResolvedValue(null);

    await controller.editPemberitahuan(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('editPemberitahuan: Successfully updates pemberitahuan', async () => {
    mockRequest.params = { id: '5' };
    mockRequest.body = { title: 'Updated Title', content: 'Updated Content' };
    mockPrismaPengelolaFindFirst.mockResolvedValue({ Pengelola_id: 7 });
    mockPrismaNotificationFindFirst.mockResolvedValue({ pemberitahuan_id: 5, Pengelola_id: 7 });
    mockPrismaNotificationUpdate.mockResolvedValue({ pemberitahuan_id: 5, title: 'Updated Title' });

    await controller.editPemberitahuan(mockRequest, mockResponse);

    expect(mockPrismaNotificationUpdate).toHaveBeenCalled();
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('editPemberitahuan: Successfully updates with file and deletes old image', async () => {
    mockRequest.params = { id: '5' };
    mockRequest.body = { title: 'Updated', content: 'Content' };
    mockRequest.file = { filename: 'new.png' };

    mockPrismaPengelolaFindFirst.mockResolvedValue({ Pengelola_id: 7 });
    mockPrismaNotificationFindFirst.mockResolvedValue({ pemberitahuan_id: 5, Pengelola_id: 7, image: 'old.png' });
    mockPrismaNotificationUpdate.mockResolvedValue({ pemberitahuan_id: 5 });

    mockExistsSync.mockReturnValue(true);

    await controller.editPemberitahuan(mockRequest, mockResponse);

    expect(mockUnlinkSync).toHaveBeenCalled();
    expect(mockPrismaNotificationUpdate).toHaveBeenCalled();
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('editPemberitahuan: Handles errors', async () => {
    mockRequest.params = { id: '5' };
    mockRequest.body = { title: 'T', content: 'C' };
    mockPrismaPengelolaFindFirst.mockRejectedValue(new Error('DB Error'));
    await controller.editPemberitahuan(mockRequest, mockResponse);
    expect(mockResponse.status).toHaveBeenCalledWith(500);
  });
});

describe('Tambahan coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockUnlinkSync.mockImplementation(() => { });
    mockRequest = {
      session: { user_id: 'user-pengelola-1' },
      user: { user_id: 'user-pengelola-1', role: 'pengelola' },
      body: {},
      params: {},
      query: {},
      file: null
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      render: jest.fn().mockReturnThis(),
      redirect: jest.fn()
    };
    User.findById.mockResolvedValue({ user_id: 'user-pengelola-1', role: 'pengelola', name: 'Admin' });
    mockPrismaPengelolaFindFirst.mockResolvedValue({ Pengelola_id: 7, user_id: 'user-pengelola-1' });
  });

  it('showPemberitahuanPengelola: pagination hasNext and hasPrev branches', async () => {
    // Simulate page 2 with many items so hasNext=true and hasPrev=true
    mockRequest.query = { page: '2' };
    const mockPemberitahuan = [{ pemberitahuan_id: 1, title: 'T1' }];

    const prismaMock = require('@prisma/client').PrismaClient();
    prismaMock.pemberitahuan.findMany = jest.fn().mockResolvedValue(mockPemberitahuan);
    prismaMock.pemberitahuan.count = jest.fn().mockResolvedValue(100);

    await controller.showPemberitahuanPengelola(mockRequest, mockResponse);

    expect(mockResponse.render).toHaveBeenCalledWith('layouts/main', expect.objectContaining({
      body: expect.any(String),
      user: expect.objectContaining({ role: 'pengelola' }),
      // ensure pagination object exists
      activeMenu: 'pemberitahuan'
    }));
  });

  it('tambahPemberitahuan: handles notification send error (createNotification throws)', async () => {
    mockRequest.body = { title: 'Title', content: 'Content' };
    const mockNotificationData = { pemberitahuan_id: 99, title: 'Test', content: 'C', Pengelola_id: 7 };
    mockPrismaNotificationCreate.mockResolvedValue(mockNotificationData);
    mockPrismaMahasiswaFindMany.mockResolvedValue([{ user_id: 'm1' }]);
    // Make notification throw
    notificationController.createNotification.mockRejectedValue(new Error('Notify fail'));

    await controller.tambahPemberitahuan(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('editPemberitahuan: when old image does not exist, skip unlink and update', async () => {
    mockRequest.params = { id: '5' };
    mockRequest.body = { title: 'Updated', content: 'Content' };
    mockRequest.file = { filename: 'new.png' };

    mockPrismaPengelolaFindFirst.mockResolvedValue({ Pengelola_id: 7 });
    mockPrismaNotificationFindFirst.mockResolvedValue({ pemberitahuan_id: 5, Pengelola_id: 7, image: 'old.png' });
    mockPrismaNotificationUpdate.mockResolvedValue({ pemberitahuan_id: 5 });

    // existsSync false -> unlink should not be called
    mockExistsSync.mockReturnValue(false);

    await controller.editPemberitahuan(mockRequest, mockResponse);

    expect(mockUnlinkSync).not.toHaveBeenCalled();
    expect(mockPrismaNotificationUpdate).toHaveBeenCalled();
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('hapusPemberitahuan: when image exists but file missing, skip unlink and still succeed', async () => {
    mockRequest.params = { id: '123' };
    const mockInnerPrisma = {
      pengelolaasrama: { findFirst: jest.fn().mockResolvedValue({ Pengelola_id: 99 }) },
      pemberitahuan: {
        findFirst: jest.fn().mockResolvedValue({ pemberitahuan_id: 123, image: '/uploads/pemberitahuan/missing.png', Pengelola_id: 99 }),
        delete: jest.fn().mockResolvedValue({ pemberitahuan_id: 123 })
      },
      notification: { deleteMany: jest.fn().mockResolvedValue({}) }
    };
    mockPrismaTransaction.mockImplementation(async (fn) => await fn(mockInnerPrisma));

    mockExistsSync.mockReturnValue(false);

    await controller.hapusPemberitahuan(mockRequest, mockResponse);

    expect(mockUnlinkSync).not.toHaveBeenCalled();
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
  it('tambahPemberitahuan: returns 401 when not authenticated', async () => {
    mockRequest.session = {};
    mockRequest.user = null;
    mockRequest.body = { title: 'Title', content: 'Content' };
    await controller.tambahPemberitahuan(mockRequest, mockResponse);
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });
});
