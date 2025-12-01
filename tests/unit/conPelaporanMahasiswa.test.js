const { submitPelaporan } = require('../../controller/conPelaporan');
jest.mock('../../config/database', () => ({
  prisma: {
    pelaporankerusakan: { create: jest.fn() },
  }
}));
jest.mock('../../controller/notification', () => ({
  createKerusakanNotification: jest.fn().mockResolvedValue({}),
  getNotifications: jest.fn().mockResolvedValue({ success: true, data: [] }),
  markAsRead: jest.fn().mockResolvedValue({}),
  markAllAsRead: jest.fn().mockResolvedValue({}),
  createNotification: jest.fn().mockResolvedValue({}),
}));
beforeAll(() => {
  jest.isolateModules(() => {
// No need to require app for direct controller testing
  });
});
beforeEach(() => { jest.clearAllMocks(); });
test('pelaporan kerusakan berhasil', async () => {
  const { prisma } = require('../../config/database');
  prisma.pelaporankerusakan.create.mockResolvedValue({ laporan_id: 7, jenis: 'Pintu', description: 'Pintu rusak parah', location: 'Kamar 101', mahasiswa_id: 1 });
  const req = {
    user: { mahasiswa_id: 1 },
    body: { jenis: 'Pintu', description: 'Pintu rusak parah', location: 'Kamar 101' },
    file: { path: 'public/uploads/kerusakan.jpg' }
  };
  const res = {
    status: jest.fn(function (code) { this.statusCode = code; return this; }),
    json: jest.fn(function (obj) { this.body = obj; return this; }),
  };
  await submitPelaporan(req, res);
  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.body.success).toBe(true);
  const { prisma: prisma2 } = require('../../config/database');
  expect(prisma2.pelaporankerusakan.create).toHaveBeenCalled();
});
test('pelaporan kerusakan gagal jika deskripsi terlalu pendek', async () => {
  const req = {
    user: { mahasiswa_id: 1 },
    body: { jenis: 'AC', description: 'Rusak', location: 'Kamar 102' },
    file: { path: 'public/uploads/kerusakan.jpg' }
  };
  const res = {
    status: jest.fn(function (code) { this.statusCode = code; return this; }),
    json: jest.fn(function (obj) { this.body = obj; return this; }),
  };
  await submitPelaporan(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.body.success).toBe(false);
});
