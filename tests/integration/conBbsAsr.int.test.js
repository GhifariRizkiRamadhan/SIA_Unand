// ==========================================================
// FILE: tests/integration/conBbsAsr.int.test.js (FINAL FIXED)
// ==========================================================

require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret-rahasia-untuk-tes';

// 1. Setup Mocks
const mockSingletonPrismaMahasiswaFindFirst = jest.fn();
const mockSingletonPrismaPengelolaFindFirst = jest.fn();
const mockSingletonPrismaDisconnect = jest.fn();
const mockControllerPrismaMahasiswaFindUnique = jest.fn();
const mockControllerPrismaPengelolaFindMany = jest.fn();

// 2. Mock Config Database
jest.mock('../../config/database', () => ({
  prisma: {
    mahasiswa: { findFirst: mockSingletonPrismaMahasiswaFindFirst },
    pengelolaasrama: { findFirst: mockSingletonPrismaPengelolaFindFirst },
    $disconnect: mockSingletonPrismaDisconnect,
  },
}));

// 3. Mock Prisma Client (Controller)
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      mahasiswa: { findUnique: mockControllerPrismaMahasiswaFindUnique },
      pengelolaasrama: { findMany: mockControllerPrismaPengelolaFindMany },
    }))
  };
});

// 4. Mock Dependencies Lain
jest.mock('../../models/userModels');
jest.mock('../../models/bebasAsramaModel');
jest.mock('../../models/pembayaranModel');
jest.mock('../../controller/notification', () => ({
  createNotification: jest.fn().mockResolvedValue({}),
  getNotifications: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
}));

jest.mock('../../middlewares/uploadMiddleware', () => ({
  uploadBukti: (req, res, next) => next(),
  upload: (req, res, next) => next(),
  uploadImage: (req, res, next) => next(),
  uploadIzinDokumen: (req, res, next) => next(),
  uploadFotoKerusakan: (req, res, next) => next(),
}));

const request = require('supertest');
const { app, server } = require('../../app');
const jwt = require('jsonwebtoken');
const { prisma } = require('../../config/database');
const BebasAsrama = require('../../models/bebasAsramaModel');
const notificationController = require('../../controller/notification');
const Pembayaran = require('../../models/pembayaranModel');

// Helper Token
const generateAuthToken = (payload) => {
  const defaultPayload = { user_id: 'u1', email: 'test@x.com', role: 'mahasiswa', mahasiswa_id: 1 };
  const tokenPayload = { ...defaultPayload, ...payload };
  
  if (tokenPayload.role === 'mahasiswa') {
      prisma.mahasiswa.findFirst.mockResolvedValue({ mahasiswa_id: 1 });
  }
  if (tokenPayload.role === 'pengelola') {
      prisma.pengelolaasrama.findFirst.mockResolvedValue({ Pengelola_id: 1 });
  }

  return jwt.sign(tokenPayload, process.env.JWT_SECRET);
};

describe('Integration Test: Endpoints Bebas Asrama', () => {
  let mahasiswaToken, pengelolaToken;

  beforeAll(() => {
    mahasiswaToken = generateAuthToken({ role: 'mahasiswa' });
    pengelolaToken = generateAuthToken({ role: 'pengelola' });
  });

  afterAll(async () => {
    if (server) await new Promise(r => server.close(r));
    await prisma.$disconnect();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock default auth
    mockSingletonPrismaMahasiswaFindFirst.mockResolvedValue({ mahasiswa_id: 1 });
    mockSingletonPrismaPengelolaFindFirst.mockResolvedValue({ Pengelola_id: 1 });
  });

  // --- General Coverage ---
  describe('General Routes Coverage', () => {
    it('GET / harus redirect ke /login', async () => {
      const res = await request(app).get('/');
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toBe('/login');
    });

    it('GET /debug/headers harus mengembalikan headers json', async () => {
      const res = await request(app).get('/debug/headers');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('headers');
    });
  });

  // --- POST API ---
  describe('POST /api/bebas-asrama', () => {
    const mockData = { Surat_id: 10, status_pengajuan: 'VERIFIKASI_FASILITAS' };
    
    beforeEach(() => {
      mockControllerPrismaMahasiswaFindUnique.mockResolvedValue({ mahasiswa_id: 1, user: { name: 'Test' } });
      
      // --- PERBAIKAN DISINI ---
      // Return array berisi user agar loop notifikasi berjalan
      mockControllerPrismaPengelolaFindMany.mockResolvedValue([{ user_id: 'admin1' }]); 
      // ------------------------
      
      BebasAsrama.findActiveByMahasiswaId.mockResolvedValue(null);
      BebasAsrama.create.mockResolvedValue(mockData);
    });

    it('Happy Path', async () => {
      // Pastikan mock auth diset ulang
      mockSingletonPrismaMahasiswaFindFirst.mockResolvedValue({ mahasiswa_id: 1 });
      
      const res = await request(app).post('/api/bebas-asrama').set('Cookie', `token=${mahasiswaToken}`);
      expect(res.statusCode).toBe(200);
      expect(notificationController.createNotification).toHaveBeenCalled();
    });

    it('Sad Path: No Auth', async () => {
      const res = await request(app).post('/api/bebas-asrama');
      expect(res.statusCode).toBe(401);
    });

    it('Sad Path: Conflict', async () => {
      // Setup agar auth lolos tapi controller deteksi konflik
      mockSingletonPrismaMahasiswaFindFirst.mockResolvedValue({ mahasiswa_id: 1 });
      BebasAsrama.findActiveByMahasiswaId.mockResolvedValue({ id: 1 });
      
      const res = await request(app).post('/api/bebas-asrama').set('Cookie', `token=${mahasiswaToken}`);
      expect(res.statusCode).toBe(409);
    });

    it('Security: Pengelola Ditolak', async () => {
      // Setup agar auth lolos sebagai pengelola (bukan mahasiswa)
      mockSingletonPrismaPengelolaFindFirst.mockResolvedValue({ Pengelola_id: 1 });

      const res = await request(app).post('/api/bebas-asrama').set('Cookie', `token=${pengelolaToken}`);
      expect(res.statusCode).toBe(403);
    });
  });

  // --- GET Active ---
  describe('GET /api/bebas-asrama/mahasiswa/:id/status-aktif', () => {
    it('Happy Path: Active', async () => {
      mockSingletonPrismaMahasiswaFindFirst.mockResolvedValue({ mahasiswa_id: 1 });
      BebasAsrama.findActiveByMahasiswaId.mockResolvedValue({ id: 1 });
      
      const res = await request(app).get('/api/bebas-asrama/mahasiswa/1/status-aktif').set('Cookie', `token=${mahasiswaToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.hasActive).toBe(true);
    });
    
    it('Happy Path: Inactive', async () => {
      mockSingletonPrismaMahasiswaFindFirst.mockResolvedValue({ mahasiswa_id: 1 });
      BebasAsrama.findActiveByMahasiswaId.mockResolvedValue(null);
      
      const res = await request(app).get('/api/bebas-asrama/mahasiswa/1/status-aktif').set('Cookie', `token=${mahasiswaToken}`);
      expect(res.body.hasActive).toBe(false);
    });
  });

  // --- GET Tagihan ---
  describe('GET /api/tagihan/:id', () => {
    it('Happy Path', async () => {
      mockSingletonPrismaMahasiswaFindFirst.mockResolvedValue({ mahasiswa_id: 1 });
      Pembayaran.findByMahasiswaId.mockResolvedValue([{ id: 1 }]);
      
      const res = await request(app).get('/api/tagihan/1').set('Cookie', `token=${mahasiswaToken}`);
      expect(res.statusCode).toBe(200);
    });
    
    it('Sad Path: Not Found', async () => {
      mockSingletonPrismaMahasiswaFindFirst.mockResolvedValue({ mahasiswa_id: 1 });
      Pembayaran.findByMahasiswaId.mockResolvedValue([]);
      
      const res = await request(app).get('/api/tagihan/1').set('Cookie', `token=${mahasiswaToken}`);
      expect(res.statusCode).toBe(404);
    });
  });
});