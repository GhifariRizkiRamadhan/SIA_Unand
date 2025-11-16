// 1. DEKLARASIKAN FUNGSI MOCK DI PALING ATAS
const mockSingletonPrismaMahasiswaFindFirst = jest.fn();
const mockSingletonPrismaPengelolaFindFirst = jest.fn();
const mockSingletonPrismaDisconnect = jest.fn();
const mockControllerPrismaMahasiswaFindUnique = jest.fn();
const mockControllerPrismaPengelolaFindMany = jest.fn();

// 2. PANGGIL SEMUA JEST.MOCK() SETELAH ITU
jest.mock('../../config/database', () => ({
  prisma: {
    mahasiswa: {
      findFirst: mockSingletonPrismaMahasiswaFindFirst,
    },
    pengelolaasrama: {
      findFirst: mockSingletonPrismaPengelolaFindFirst,
    },
    $disconnect: mockSingletonPrismaDisconnect,
  },
}));
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    mahasiswa: {
      findUnique: mockControllerPrismaMahasiswaFindUnique,
    },
    pengelolaasrama: {
      findMany: mockControllerPrismaPengelolaFindMany,
    },
  })),
}));
jest.mock('../../models/userModels');
jest.mock('../../models/bebasAsramaModel');
jest.mock('../../models/pembayaranModel');
jest.mock('../../controller/notification', () => ({
  createNotification: jest.fn().mockResolvedValue({}),
  getNotifications: jest.fn().mockResolvedValue({}), 
  markAsRead: jest.fn().mockResolvedValue({}),       
  markAllAsRead: jest.fn().mockResolvedValue({}),    
}));

// 3. BARU REQUIRE SEMUA DEPENDENSI
const request = require('supertest');
const { app, server } = require('../../app');
const jwt = require('jsonwebtoken');
const { prisma } = require('../../config/database');
const User = require('../../models/userModels');
const BebasAsrama = require('../../models/bebasAsramaModel');
const Pembayaran = require('../../models/pembayaranModel');
const notificationController = require('../../controller/notification');


// Helper untuk membuat token otentikasi
const generateAuthToken = (payload) => {
  const defaultPayload = {
    user_id: 'user-default',
    email: 'test@example.com',
    role: 'mahasiswa',
    name: 'Test User',
    mahasiswa_id: 1,
  };
  const tokenPayload = { ...defaultPayload, ...payload };
  
  // Setup mock untuk 'prisma' singleton yang digunakan authMiddleware
  if (tokenPayload.role === 'mahasiswa' && tokenPayload.mahasiswa_id) {
    prisma.mahasiswa.findFirst.mockResolvedValue({ mahasiswa_id: tokenPayload.mahasiswa_id });
  } else {
    prisma.mahasiswa.findFirst.mockResolvedValue(null);
  }
  if (tokenPayload.role === 'pengelola' && tokenPayload.pengelola_id) {
    prisma.pengelolaasrama.findFirst.mockResolvedValue({ Pengelola_id: tokenPayload.pengelola_id });
  } else {
    prisma.pengelolaasrama.findFirst.mockResolvedValue(null);
  }
  
  return jwt.sign(tokenPayload, process.env.JWT_SECRET);
};

// Mock global.io
global.io = {
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
};

// ===================================
// START: TEST SUITES
// ===================================

describe('Integration Test: Endpoints Bebas Asrama', () => {
  let mahasiswaToken;
  let pengelolaToken;

  beforeAll(() => {
    // Buat token yang valid untuk digunakan di semua tes
    mahasiswaToken = generateAuthToken({
      user_id: 'mhs-1',
      role: 'mahasiswa',
      mahasiswa_id: 1,
    });
    
    pengelolaToken = generateAuthToken({
      user_id: 'pengelola-1',
      role: 'pengelola',
      pengelola_id: 1,
      mahasiswa_id: null,
    });
  });

  // FIX: Pindahkan 'afterAll' ke dalam 'describe' utama
  afterAll(async () => {
    // 1. Tutup server Express
    await new Promise(resolve => server.close(resolve));
    
    // 2. Tutup koneksi Prisma
    await prisma.$disconnect();
  });


  beforeEach(() => {
    // Reset semua mock history
    jest.clearAllMocks();
    
    // Reset mock token (penting agar mock findFirst di authMiddleware konsisten)
    mahasiswaToken = generateAuthToken({ user_id: 'mhs-1', role: 'mahasiswa', mahasiswa_id: 1 });
  });

  // ===================
  // Test: POST /api/bebas-asrama
  // ===================
  describe('POST /api/bebas-asrama', () => {
    
    const mockMahasiswa = { 
      mahasiswa_id: 1, 
      kipk: 'tidak', 
      nim: '12345',
      user: { user_id: 'mhs-1', name: 'Test User' } 
    };
    const mockPengajuanBaru = { Surat_id: 10, status_pengajuan: 'VERIFIKASI_FASILITAS' };

    beforeEach(() => {
      // Setup mock default untuk happy path
      mockControllerPrismaMahasiswaFindUnique.mockResolvedValue(mockMahasiswa);
      mockControllerPrismaPengelolaFindMany.mockResolvedValue([{ user_id: 'pengelola-1' }]);
      BebasAsrama.findActiveByMahasiswaId.mockResolvedValue(null);
      BebasAsrama.create.mockResolvedValue(mockPengajuanBaru);
    });
    
    it('Happy Path: harus membuat pengajuan jika user adalah mahasiswa & belum ada pengajuan', async () => {
      const res = await request(app)
        .post('/api/bebas-asrama')
        .set('Cookie', `token=${mahasiswaToken}`); 

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockPengajuanBaru);
      expect(notificationController.createNotification).toHaveBeenCalled();
    });

    it('Sad Path: harus return 401 jika tidak ada token (tidak login)', async () => {
      const res = await request(app)
        .post('/api/bebas-asrama');
      expect(res.statusCode).toBe(401); 
      expect(res.body.message).toContain('No token provided');
    });

    it('Sad Path: harus return 409 jika mahasiswa sudah punya pengajuan aktif', async () => {
      BebasAsrama.findActiveByMahasiswaId.mockResolvedValue({ Surat_id: 9 });
      const res = await request(app)
        .post('/api/bebas-asrama')
        .set('Cookie', `token=${mahasiswaToken}`);
      expect(res.statusCode).toBe(409);
      expect(res.body.message).toContain('Anda sudah memiliki pengajuan');
    });

    // TES INI SUDAH DIUPDATE UNTUK PERBAIKAN MIDDLEWARE
    it('Security Sad Path: harus return 403 jika user adalah PENGELOLA (dihentikan oleh middleware)', async () => {
      pengelolaToken = generateAuthToken({ 
        user_id: 'pengelola-1', 
        role: 'pengelola', 
        pengelola_id: 1, 
        mahasiswa_id: null 
      });
      
      const res = await request(app)
        .post('/api/bebas-asrama')
        .set('Cookie', `token=${pengelolaToken}`);

      expect(res.statusCode).toBe(403);
      // Memvalidasi pesan dari middleware 'requireMahasiswa'
      expect(res.body.message).toContain('Forbidden: Akun Anda tidak terhubung');
      expect(BebasAsrama.create).not.toHaveBeenCalled();
    });
  });

  // ===================
  // Test: GET /api/bebas-asrama/mahasiswa/:id/status-aktif
  // ===================
  describe('GET /api/bebas-asrama/mahasiswa/:id/status-aktif', () => {
    it('Happy Path: harus return hasActive: true jika ada pengajuan', async () => {
      BebasAsrama.findActiveByMahasiswaId.mockResolvedValue({ Surat_id: 1 });
      const res = await request(app)
        .get('/api/bebas-asrama/mahasiswa/1/status-aktif')
        .set('Cookie', `token=${mahasiswaToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.hasActive).toBe(true);
    });
    
    it('Happy Path: harus return hasActive: false jika tidak ada pengajuan', async () => {
      BebasAsrama.findActiveByMahasiswaId.mockResolvedValue(null);
      const res = await request(app)
        .get('/api/bebas-asrama/mahasiswa/1/status-aktif')
        .set('Cookie', `token=${mahasiswaToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.hasActive).toBe(false);
    });

    it('Sad Path: harus return 401 jika tidak login', async () => {
      const res = await request(app)
        .get('/api/bebas-asrama/mahasiswa/1/status-aktif');
      expect(res.statusCode).toBe(401);
    });
  });

  // ===================
  // Test: GET /api/tagihan/:id
  // ===================
  describe('GET /api/tagihan/:id', () => {
    it('Happy Path: harus return data tagihan jika ditemukan', async () => {
      Pembayaran.findByMahasiswaId.mockResolvedValue([{ id: 1, amount: 1000 }]);
      const res = await request(app)
        .get('/api/tagihan/1')
        .set('Cookie', `token=${mahasiswaToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.data).toEqual([{ id: 1, amount: 1000 }]);
    });
    
    it('Sad Path: harus return 404 jika tidak ada tagihan', async () => {
      Pembayaran.findByMahasiswaId.mockResolvedValue([]); 
      const res = await request(app)
        .get('/api/tagihan/1')
        .set('Cookie', `token=${mahasiswaToken}`);
      expect(res.statusCode).toBe(404);
      expect(res.body.message).toContain('Tagihan untuk mahasiswa ini tidak ditemukan');
    });
  });
});