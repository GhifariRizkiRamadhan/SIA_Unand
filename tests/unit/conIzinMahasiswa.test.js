const request = require('supertest');
let app;

jest.mock('../../config/database', () => ({
  prisma: {
    izinkeluar: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    mahasiswa: {
      findUnique: jest.fn(),
    },
    // Add other models to prevent crashes
    user: { findUnique: jest.fn() },
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
  authMiddleware: (req, res, next) => {
    req.user = { user_id: 'mhs-1', role: 'mahasiswa', name: 'Mahasiswa A', mahasiswa_id: 1 };
    next();
  },
  redirectIfAuthenticated: (req, res, next) => next(),
  requireMahasiswa: (req, res, next) => next(),
  requirePengelola: (req, res, next) => next(),
}));

jest.mock('../../middlewares/uploadMiddleware', () => ({
  upload: jest.fn(),
  uploadImage: jest.fn(),
  uploadBukti: jest.fn(),
  uploadIzinDokumen: jest.fn((req, res, next) => { req.file = { path: 'public/uploads/izin.pdf' }; next(); }),
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

beforeEach(() => {
  jest.clearAllMocks();
});

test('pengajuan izin berhasil dengan data valid', async () => {
  const { prisma } = require('../../config/database');
  prisma.izinkeluar.create.mockResolvedValue({ izin_id: 10, reason: 'Keperluan akademik', mahasiswa_id: 1, status: 'pending' });

  const res = await request(app)
    .post('/api/izin')
    .send({
      reason: 'Keperluan akademik',
      date_out: '2025-12-01',
      time_out: '08:00',
      date_return: '2025-12-02',
      time_return: '17:00'
    })
    .set('Accept', 'application/json');
  expect(res.statusCode).toBe(201);
  expect(res.body.success).toBe(true);
  expect(prisma.izinkeluar.create).toHaveBeenCalled();
});

test('pengajuan izin gagal jika field wajib kosong', async () => {
  const res = await request(app)
    .post('/api/izin')
    .send({ reason: '', date_out: '', time_out: '', date_return: '', time_return: '' })
    .set('Accept', 'application/json');
  expect(res.statusCode).toBe(400);
  expect(res.body.success).toBe(false);
});
