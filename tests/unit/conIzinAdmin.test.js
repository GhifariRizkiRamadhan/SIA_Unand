const request = require('supertest');
let app;

// Define mock inside factory to avoid hoisting issues
jest.mock('../../config/database', () => ({
  prisma: {
    izinkeluar: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    // Add other models if needed to avoid crashes
    user: { findUnique: jest.fn() },
    mahasiswa: { findUnique: jest.fn() },
    pengelolaasrama: { findMany: jest.fn() },
    notification: { create: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
  },
  connectToDatabase: jest.fn()
}));

jest.mock('../../controller/notification', () => ({
  createIzinKeluarNotification: jest.fn().mockResolvedValue({}),
  getNotifications: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
  createNotification: jest.fn(),
}));

jest.mock('../../middlewares/authMiddleware', () => ({
  authMiddleware: (req, res, next) => { req.user = { user_id: 'peng-1', role: 'pengelola', name: 'Admin', pengelola_id: 99 }; next(); },
  redirectIfAuthenticated: (req, res, next) => next(),
  requireMahasiswa: (req, res, next) => next(),
  requirePengelola: (req, res, next) => next(),
}));

jest.mock('../../middlewares/uploadMiddleware', () => ({
  upload: jest.fn(),
  uploadImage: jest.fn(),
  uploadBukti: jest.fn(),
  uploadIzinDokumen: jest.fn((req, res, next) => next()),
  uploadFotoKerusakan: jest.fn(),
}));

jest.mock('../../middlewares/validateEmail', () => jest.fn((req, res, next) => next()));
jest.mock('../../middlewares/rateLimiter', () => jest.fn((req, res, next) => next()));
jest.mock('../../config/multerConfig', () => ({ uploadMahasiswaFoto: { single: jest.fn(() => (req, res, next) => next()) } }));

beforeAll(() => {
  try {
    ({ app } = require('../../app'));
  } catch (e) {
    console.error('FAILED TO LOAD APP:', e);
    throw e;
  }
});

beforeEach(() => { jest.clearAllMocks(); });

test('approve izin pending berhasil', async () => {
  const { prisma } = require('../../config/database');
  prisma.izinkeluar.findUnique.mockResolvedValue({ izin_id: 1, status: 'pending', mahasiswa_id: 1 });
  prisma.izinkeluar.update.mockResolvedValue({ izin_id: 1, status: 'approved' });

  const res = await request(app).put('/api/pengelola/izin/1/approve').set('Accept', 'application/json');
  expect(res.statusCode).toBe(200);
  expect(res.body.success).toBe(true);
  expect(prisma.izinkeluar.update).toHaveBeenCalled();
});

test('reject izin pending dengan catatan berhasil', async () => {
  const { prisma } = require('../../config/database');
  prisma.izinkeluar.findUnique.mockResolvedValue({ izin_id: 2, status: 'pending', mahasiswa_id: 1 });
  prisma.izinkeluar.update.mockResolvedValue({ izin_id: 2, status: 'rejected' });

  const res = await request(app).put('/api/pengelola/izin/2/reject').send({ notes: 'Tidak sesuai kebijakan' }).set('Accept', 'application/json');
  expect(res.statusCode).toBe(200);
  expect(res.body.success).toBe(true);
});

test('approve gagal untuk ID tidak valid', async () => {
  const res = await request(app).put('/api/pengelola/izin/abc/approve').set('Accept', 'application/json');
  expect(res.statusCode).toBe(400);
});
