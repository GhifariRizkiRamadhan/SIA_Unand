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
      delete: mockPrismaNotificationDelete
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
jest.mock('fs');
jest.mock('ejs');

const controller = require('../../controller/conPmbrthnPnl');
const User = require('../../models/userModels');
const notificationController = require('../../controller/notification');

describe('Unit Test: controller/conPmbrthnPnl.js (Pemberitahuan Management)', () => {
  let mockRequest, mockResponse;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRequest = {
      session: { user_id: 'user-pengelola-1' },
      user: { user_id: 'user-pengelola-1', role: 'pengelola' },
      body: {},
      params: {},
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

  // --- hapusPemberitahuan ---
  it('hapusPemberitahuan: Returns 400 for invalid ID', async () => {
    mockRequest.params = { id: 'abc' };
    await controller.hapusPemberitahuan(mockRequest, mockResponse);
    
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'ID tidak valid' }));
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
    
    await controller.hapusPemberitahuan(mockRequest, mockResponse);
    
    expect(mockPrismaTransaction).toHaveBeenCalled();
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  // --- editPemberitahuan ---
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
});
