require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret-rahasia-untuk-tes';

const mockSingletonPrismaMahasiswaFindFirst = jest.fn();
const mockSingletonPrismaPengelolaFindFirst = jest.fn();
const mockSingletonPrismaDisconnect = jest.fn();

jest.mock('../../config/database', () => ({
  prisma: {
    mahasiswa: { findFirst: mockSingletonPrismaMahasiswaFindFirst },
    pengelolaasrama: { findFirst: mockSingletonPrismaPengelolaFindFirst },
    $disconnect: mockSingletonPrismaDisconnect,
  },
}));
jest.mock('@prisma/client');
jest.mock('../../models/userModels');
jest.mock('../../models/pembayaranModel');
jest.mock('../../models/bebasAsramaModel');
jest.mock('../../controller/notification', () => ({
  createNotification: jest.fn().mockResolvedValue({}),
  getNotifications: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
}));

// --- MOCK UPLOAD UNTUK ERROR COVERAGE ---
jest.mock('../../middlewares/uploadMiddleware', () => ({
  // PERBAIKAN: uploadBukti harus mengisi req.file agar controller tidak return 400
  uploadBukti: (req, res, next) => {
    if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
        req.file = { path: 'uploads/mock-bukti.jpg' };
    }
    next();
  },
  upload: (req, res, next) => next(),
  // Custom mock untuk mensimulasikan error upload di ruter.js
  uploadImage: (req, res, next) => {
     // Jika header khusus dikirim, simulasi error
     if (req.headers['x-simulate-upload-error']) {
        return next(new Error('Upload Error Simulation'));
     }
     next();
  },
  uploadIzinDokumen: (req, res, next) => next(),
  uploadFotoKerusakan: (req, res, next) => next(),
}));

const request = require('supertest');
const { app, server } = require('../../app');
const jwt = require('jsonwebtoken');
const { prisma } = require('../../config/database');
const Pembayaran = require('../../models/pembayaranModel');
const BebasAsrama = require('../../models/bebasAsramaModel');

const generateAuthToken = (payload) => {
  const defaultPayload = { user_id: 'u1', email: 't@x.com', role: 'mahasiswa', mahasiswa_id: 1 };
  const tokenPayload = { ...defaultPayload, ...payload };
  if (tokenPayload.role === 'mahasiswa') prisma.mahasiswa.findFirst.mockResolvedValue({ mahasiswa_id: 1 });
  else prisma.mahasiswa.findFirst.mockResolvedValue(null);
  if (tokenPayload.role === 'pengelola') prisma.pengelolaasrama.findFirst.mockResolvedValue({ Pengelola_id: 1 });
  else prisma.pengelolaasrama.findFirst.mockResolvedValue(null);
  return jwt.sign(tokenPayload, process.env.JWT_SECRET);
};

describe('Integration Test: Endpoints Pembayaran', () => {
  let pengelolaToken, mahasiswaToken;
  const mockPembayaran = { pembayaran_id: 10, surat_id: 1 };
  
  beforeAll(() => {
    pengelolaToken = generateAuthToken({ role: 'pengelola' });
    mahasiswaToken = generateAuthToken({ role: 'mahasiswa' });
  });

  afterAll(async () => {
    if (server) await new Promise(r => server.close(r));
    await prisma.$disconnect();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    Pembayaran.findById.mockResolvedValue(mockPembayaran);
    Pembayaran.findByIdAndUpdate.mockResolvedValue(mockPembayaran);
    BebasAsrama.updateStatus.mockResolvedValue({});
    Pembayaran.updateStatusBySuratId.mockResolvedValue({});
    Pembayaran.resetPaymentStatusBySuratId.mockResolvedValue({});
  });

  describe('Keamanan', () => {
    it('Mahasiswa tidak bisa approve', async () => {
      const res = await request(app).post('/api/pengelola/pembayaran/1/approve').set('Cookie', `token=${mahasiswaToken}`);
      expect(res.statusCode).toBe(403);
    });
  });

  describe('Alur Mahasiswa', () => {
    it('Happy Path: Upload', async () => {
      const res = await request(app).post('/api/pembayaran').set('Cookie', `token=${mahasiswaToken}`).field('id', '10');
      expect(res.statusCode).toBe(200);
    });
  });
  
  describe('Alur Pengelola', () => {
    it('Happy Path: Approve', async () => {
      const res = await request(app).post('/api/pengelola/pembayaran/1/approve').set('Cookie', `token=${pengelolaToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  // --- TEST COVERAGE KHUSUS UNTUK RUTER.JS ERROR HANDLING ---
  describe('Ruter.js Error Handling Coverage', () => {
      it('Harus menangani error upload file pada endpoint pemberitahuan', async () => {
          const res = await request(app)
            .post('/api/pemberitahuan')
            .set('Cookie', `token=${pengelolaToken}`)
            .set('x-simulate-upload-error', 'true'); // Trigger error
          
          expect(res.statusCode).toBe(400);
          expect(res.body.message).toContain('Error upload file');
      });
  });
});