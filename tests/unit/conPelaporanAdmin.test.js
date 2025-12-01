const request = require('supertest');
let app;
const mockPrisma = {
  pelaporankerusakan: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};
jest.mock('../../config/database', () => ({ prisma: mockPrisma }));
jest.mock('../../controller/notification', () => ({
  createKerusakanNotification: jest.fn().mockResolvedValue({}),
  getNotifications: jest.fn().mockResolvedValue({ success: true, data: [] }),
  markAsRead: jest.fn().mockResolvedValue({}),
  markAllAsRead: jest.fn().mockResolvedValue({}),
  createNotification: jest.fn().mockResolvedValue({}),
}));
beforeAll(() => {
  jest.isolateModules(() => {
    jest.mock('../../middlewares/authMiddleware', () => ({
      authMiddleware: (req, res, next) => { req.user = { user_id: 'peng-1', role: 'pengelola', name: 'Admin', pengelola_id: 99 }; next(); },
      redirectIfAuthenticated: (req, res, next) => next(),
      requireMahasiswa: (req, res, next) => next(),
      requirePengelola: (req, res, next) => next(),
    }));
    const { app: testApp } = require('../../app');
    app = testApp;
  });
});
beforeEach(() => { jest.clearAllMocks(); });
test('update status pelaporan berhasil', async () => {
mockPrisma.pelaporankerusakan.findUnique.mockResolvedValue({ laporan_id: 5, mahasiswa_id: 1 });
mockPrisma.pelaporankerusakan.update.mockResolvedValue({ laporan_id: 5, status: 'ditangani' });
  const res = await request(app)
    .put('/api/pengelola/pelaporan/5/status')
    .send({ status: 'ditangani' })
    .set('Accept', 'application/json');
  expect(res.statusCode).toBe(200);
  expect(res.body.success).toBe(true);
});
test('update status gagal jika status tidak valid', async () => {
  const res = await request(app)
    .put('/api/pengelola/pelaporan/5/status')
    .send({ status: 'invalid' })
    .set('Accept', 'application/json');
  expect(res.statusCode).toBe(400);
});
test('update status gagal jika laporan tidak ditemukan', async () => {
  mockPrisma.pelaporankerusakan.findUnique.mockResolvedValue(null);
  const res = await request(app)
    .put('/api/pengelola/pelaporan/99/status')
    .send({ status: 'ditinjau' })
    .set('Accept', 'application/json');
  expect(res.statusCode).toBe(404);
});
