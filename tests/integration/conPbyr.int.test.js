require('dotenv').config(); // <-- PERBAIKAN #1: Muat .env
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret-rahasia-untuk-tes'; // Pastikan secret ada

// 1. Deklarasikan fungsi mock di PALING ATAS
const mockSingletonPrismaMahasiswaFindFirst = jest.fn();
const mockSingletonPrismaPengelolaFindFirst = jest.fn();
const mockSingletonPrismaDisconnect = jest.fn();

// 2. PANGGIL SEMUA JEST.MOCK() SETELAH ITU
jest.mock('../../config/database', () => ({
  prisma: {
    mahasiswa: { findFirst: mockSingletonPrismaMahasiswaFindFirst },
    pengelolaasrama: { findFirst: mockSingletonPrismaPengelolaFindFirst },
    $disconnect: mockSingletonPrismaDisconnect,
  },
}));
jest.mock('@prisma/client'); // conPbyr tidak menggunakan 'new PrismaClient()'
jest.mock('../../models/userModels');
jest.mock('../../models/pembayaranModel');
jest.mock('../../models/bebasAsramaModel');
jest.mock('../../controller/notification', () => ({
  createNotification: jest.fn().mockResolvedValue({}),
  getNotifications: jest.fn().mockResolvedValue({}),
  markAsRead: jest.fn().mockResolvedValue({}),
  markAllAsRead: jest.fn().mockResolvedValue({}),
}));
// PERBAIKAN #2: Path middleware yang benar
jest.mock('../../middlewares/uploadMiddleware', () => ({
  uploadBukti: (req, res, next) => {
    if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
      req.file = { path: 'uploads/mock-bukti.jpg' };
    }
    next();
  },
  upload: jest.fn((req, res, next) => next()),
  uploadImage: jest.fn((req, res, next) => next()),
  uploadIzinDokumen: jest.fn((req, res, next) => next()),
  uploadFotoKerusakan: jest.fn((req, res, next) => next()),
}));

// 3. BARU REQUIRE SEMUA DEPENDENSI
const request = require('supertest');
const { app, server } = require('../../app');
const jwt = require('jsonwebtoken');
const { prisma } = require('../../config/database');
const Pembayaran = require('../../models/pembayaranModel');
const BebasAsrama = require('../../models/bebasAsramaModel');

// Helper untuk membuat token otentikasi
const generateAuthToken = (payload) => {
  const defaultPayload = {
    user_id: 'user-default',
    email: 'test@example.com',
    role: 'mahasiswa',
    mahasiswa_id: 1,
  };
  const tokenPayload = { ...defaultPayload, ...payload };
  
  if (tokenPayload.role === 'mahasiswa') {
    prisma.mahasiswa.findFirst.mockResolvedValue({ mahasiswa_id: tokenPayload.mahasiswa_id });
  } else {
    prisma.mahasiswa.findFirst.mockResolvedValue(null);
  }
  if (tokenPayload.role === 'pengelola') {
    prisma.pengelolaasrama.findFirst.mockResolvedValue({ Pengelola_id: tokenPayload.pengelola_id });
  } else {
    prisma.pengelolaasrama.findFirst.mockResolvedValue(null);
  }
  
  return jwt.sign(tokenPayload, process.env.JWT_SECRET);
};

// ===================================
// START: TEST SUITES (INI ADALAH INTEGRATION TEST)
// ===================================
describe('Integration Test: Endpoints Pembayaran', () => {
  let pengelolaToken;
  let mahasiswaToken;
  const mockPembayaran = { pembayaran_id: 10, surat_id: 1, status_bukti: 'BELUM_DIVERIFIKASI' };
  
  beforeAll(() => {
    pengelolaToken = generateAuthToken({ user_id: 'pengelola-1', role: 'pengelola', pengelola_id: 1, mahasiswa_id: null });
    mahasiswaToken = generateAuthToken({ user_id: 'mhs-1', role: 'mahasiswa', mahasiswa_id: 1 });
  });

  afterAll(async () => {
    await new Promise(resolve => server.close(resolve));
    await prisma.$disconnect();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    
    // Reset mock implementasi
    Pembayaran.findById.mockResolvedValue(mockPembayaran);
    Pembayaran.findByIdAndUpdate.mockResolvedValue(mockPembayaran);
    BebasAsrama.updateStatus.mockResolvedValue({});
    Pembayaran.updateStatusBySuratId.mockResolvedValue({});
    Pembayaran.resetPaymentStatusBySuratId.mockResolvedValue({});
    
    // Reset token
    pengelolaToken = generateAuthToken({ user_id: 'pengelola-1', role: 'pengelola', pengelola_id: 1, mahasiswa_id: null });
    mahasiswaToken = generateAuthToken({ user_id: 'mhs-1', role: 'mahasiswa', mahasiswa_id: 1 });
  });

  // =
  // Test: Keamanan Endpoint (Validasi Bug Fix #1)
  // =
  describe('Keamanan Endpoint (Validasi Perbaikan Router)', () => {
    it('Sad Path (Security): Mahasiswa TIDAK BISA approve pembayaran', async () => {
      const res = await request(app)
        .post('/api/pengelola/pembayaran/1/approve')
        .set('Cookie', `token=${mahasiswaToken}`); 
      expect(res.statusCode).toBe(403);
    });

    it('Sad Path (Security): Mahasiswa TIDAK BISA mengambil semua pembayaran', async () => {
      const res = await request(app)
        .get('/api/pengelola/pembayaran')
        .set('Cookie', `token=${mahasiswaToken}`);
      expect(res.statusCode).toBe(403);
    });

    it('Sad Path (Security): Pengelola TIDAK BISA re-upload bukti', async () => {
      const res = await request(app)
        .put('/api/pembayaran/10/reupload')
        .set('Cookie', `token=${pengelolaToken}`);
      expect(res.statusCode).toBe(403);
    });
  });

  // =
  // Test: Alur Mahasiswa
  // =
  describe('Alur Mahasiswa', () => {
    it('Happy Path: POST /api/pembayaran (Upload Awal)', async () => {
      Pembayaran.findById.mockResolvedValue(mockPembayaran);
      
      const res = await request(app)
        .post('/api/pembayaran')
        .set('Cookie', `token=${mahasiswaToken}`)
        .set('Content-Type', 'multipart/form-data') // Simulasikan upload
        .field('id', '10'); 

      expect(res.statusCode).toBe(200);
      expect(BebasAsrama.updateStatus).toHaveBeenCalledWith(1, "VERIFIKASI_PEMBAYARAN");
    });

    it('Happy Path: PUT /api/pembayaran/:id/reupload (Re-upload)', async () => {
      const res = await request(app)
        .put('/api/pembayaran/10/reupload')
        .set('Cookie', `token=${mahasiswaToken}`)
        .set('Content-Type', 'multipart/form-data'); // Simulasikan upload

      expect(res.statusCode).toBe(200);
      expect(BebasAsrama.updateStatus).toHaveBeenCalledWith(1, "VERIFIKASI_PEMBAYARAN");
    });
  });
  
  // =
  // Test: Alur Pengelola
  // =
  describe('Alur Pengelola', () => {
    it('Happy Path: POST /api/pengelola/pembayaran/:id/approve', async () => {
      const res = await request(app)
        .post('/api/pengelola/pembayaran/1/approve') // ID Surat
        .set('Cookie', `token=${pengelolaToken}`);

      expect(res.statusCode).toBe(200);
      expect(Pembayaran.updateStatusBySuratId).toHaveBeenCalledWith('1', 'VALID');
      expect(BebasAsrama.updateStatus).toHaveBeenCalledWith('1', 'SELESAI');
    });

    it('Happy Path: POST /api/pengelola/pembayaran/:id/reject', async () => {
      const res = await request(app)
        .post('/api/pengelola/pembayaran/1/reject') // ID Surat
        .set('Cookie', `token=${pengelolaToken}`);

      expect(res.statusCode).toBe(200);
      expect(Pembayaran.resetPaymentStatusBySuratId).toHaveBeenCalledWith('1');
      expect(BebasAsrama.updateStatus).toHaveBeenCalledWith('1', 'MENUNGGU_PEMBAYARAN');
    });
  });
});