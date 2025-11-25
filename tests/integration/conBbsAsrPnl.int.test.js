// ==========================================================
// FILE: tests/integration/conBbsAsrPnl.int.test.js (FINAL REVISION)
// ==========================================================

require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret-rahasia-untuk-tes';

// 1. Setup Mocks Global (Semua variable HARUS diawali 'mock')
const mockSingletonPrismaMahasiswaFindFirst = jest.fn();
const mockSingletonPrismaPengelolaFindFirst = jest.fn();
const mockSingletonPrismaDisconnect = jest.fn();

// Mock fungsi findUnique untuk surat (dipanggil langsung di controller)
const mockPrismaSuratFindUnique = jest.fn();

// Mock implementasi transaksi (Definisikan fungsi ini dengan awalan 'mock')
const mockTransactionImpl = async (callback) => {
  // Kita menyimulasikan objek 'tx' yang diterima oleh callback di controller
  const mockTx = {
    suratbebasasrama: { 
        // Saat update dipanggil dalam transaksi, kembalikan data dummy yang valid
        update: jest.fn().mockResolvedValue({ 
            total_biaya: 2000000, 
            mahasiswa_id: 10, 
            Surat_id: 1 
        }) 
    },
    kerusakanFasilitas: { deleteMany: jest.fn(), createMany: jest.fn() },
    pembayaran: { create: jest.fn() },
    mahasiswa: { findUnique: jest.fn().mockResolvedValue({ user: { user_id: 'mhs-1' } }) }
  };
  // Jalankan callback controller dengan mockTx kita
  return await callback(mockTx);
};

// Spy global untuk transaksi yang akan kita 'expect' di tes
const mockPrismaTransaction = jest.fn(mockTransactionImpl);


// 2. Mock Config Database (Singleton - dipakai Auth Middleware)
jest.mock('../../config/database', () => ({
  prisma: {
    mahasiswa: { findFirst: mockSingletonPrismaMahasiswaFindFirst },
    pengelolaasrama: { findFirst: mockSingletonPrismaPengelolaFindFirst },
    $disconnect: mockSingletonPrismaDisconnect,
  },
}));

// 3. Mock Prisma Client (Instance Baru - dipakai Controller)
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      // Hubungkan method ke variabel global 'mock...' kita
      suratbebasasrama: { 
        findUnique: mockPrismaSuratFindUnique, 
        update: jest.fn() 
      },
      kerusakanFasilitas: { deleteMany: jest.fn(), createMany: jest.fn() },
      pembayaran: { create: jest.fn() },
      mahasiswa: { findUnique: jest.fn() },
      
      // PENTING: Hubungkan $transaction ke spy global
      $transaction: mockPrismaTransaction 
    }))
  };
});

// 4. Mock Controller/Middleware Lain (Wajib agar router.js tidak crash)
jest.mock('../../models/userModels');
jest.mock('../../models/bebasAsramaModel', () => ({
  findAll: jest.fn().mockResolvedValue([{ id: 1, status: 'SELESAI' }])
}));
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
jest.mock('../../config/multerConfig', () => ({
  uploadMahasiswaFoto: { single: () => (req, res, next) => next() },
}));
jest.mock('../../middlewares/validateEmail', () => jest.fn((req, res, next) => next()));
jest.mock('../../middlewares/rateLimiter', () => jest.fn((req, res, next) => next()));

// Mock Controllers Lain (Dummy Functions agar require tidak error)
jest.mock('../../controller/conLogin', () => ({ showLogin: jest.fn(), authController: { login: jest.fn(), logout: jest.fn() } }));
jest.mock('../../controller/conRegis', () => ({ regcon: { showRegis: jest.fn(), register: jest.fn() } }));
jest.mock('../../controller/conProfile', () => ({ showProfile: jest.fn(), updateProfile: jest.fn() }));
jest.mock('../../controller/conForgot', () => ({ showForgotPassword: jest.fn(), resetPassword: jest.fn() }));
jest.mock('../../controller/conPbyr', () => ({ showPembayaran: jest.fn(), uploadBuktiPembayaran: jest.fn(), getDetailPembayaran: jest.fn(), reuploadBuktiPembayaran: jest.fn(), getAllPembayaran: jest.fn(), approvePembayaran: jest.fn(), rejectPembayaran: jest.fn() }));
jest.mock('../../controller/conBbsAsr', () => ({ showBebasAsrama: jest.fn(), ajukanBebasAsrama: jest.fn(), getStatusBebasAsrama: jest.fn(), deleteBebasAsrama: jest.fn(), downloadSurat: jest.fn(), getTagihanMahasiswa: jest.fn(), getRiwayatPengajuan: jest.fn(), checkActiveSubmission: jest.fn() }));
jest.mock('../../controller/conIzinKeluar', () => ({ showFormMahasiswa: jest.fn(), listIzinMahasiswa: jest.fn(), submitIzinMahasiswa: jest.fn(), showIzinPengelola: jest.fn(), listIzinPengelola: jest.fn(), approveIzin: jest.fn(), rejectIzin: jest.fn(), updateIzinNotes: jest.fn(), resetIzinStatus: jest.fn() }));
jest.mock('../../controller/conPelaporan', () => ({ showFormPelaporan: jest.fn(), listPelaporanMahasiswa: jest.fn(), submitPelaporan: jest.fn(), showPelaporanPengelola: jest.fn(), listPelaporanPengelola: jest.fn(), updateStatusPelaporan: jest.fn() }));
jest.mock('../../controller/conDhsPnl', () => ({ showDashboard: jest.fn() }));
// Mock controller target lain di file yang sama
jest.mock('../../controller/conPmbrthnPnl', () => ({ showPemberitahuanPengelola: jest.fn(), getPemberitahuan: jest.fn(), hapusPemberitahuan: jest.fn(), tambahPemberitahuan: jest.fn(), editPemberitahuan: jest.fn() }));
jest.mock('../../controller/conDtPnghni', () => ({ showDtPenghuni: jest.fn(), tambahPenghuni: jest.fn(), editPenghuni: jest.fn(), toggleStatusPenghuni: jest.fn(), getPenghuniById: jest.fn() }));


// 5. Require Dependensi
const request = require('supertest');
const { app, server } = require('../../app');
const jwt = require('jsonwebtoken');
const { prisma } = require('../../config/database');
const { createNotification } = require('../../controller/notification');

// Helper Token
const generateAuthToken = (payload) => {
  const defaultPayload = { user_id: 'user-default', email: 'test@example.com', role: 'mahasiswa', mahasiswa_id: 1 };
  const tokenPayload = { ...defaultPayload, ...payload };
  if (tokenPayload.role === 'mahasiswa') {
    prisma.mahasiswa.findFirst.mockResolvedValue({ mahasiswa_id: tokenPayload.mahasiswa_id });
  }
  if (tokenPayload.role === 'pengelola') {
    prisma.pengelolaasrama.findFirst.mockResolvedValue({ Pengelola_id: tokenPayload.pengelola_id });
  }
  return jwt.sign(tokenPayload, process.env.JWT_SECRET);
};

describe('Integration Test: Endpoints Pengelola Bebas Asrama', () => {
  let pengelolaToken;
  let mahasiswaToken;

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

    // --- SETUP MOCK DATA UNTUK CONTROLLER ---
    const mockPengajuan = {
        Surat_id: 1,
        mahasiswa_id: 10,
        mahasiswa: { kipk: 'tidak', user: { user_id: 'user-mhs-1' } }
    };

    // Set return value untuk findUnique yang dipanggil di awal controller
    mockPrismaSuratFindUnique.mockResolvedValue(mockPengajuan);
    
    // Reset implementasi transaksi ke default kita
    mockPrismaTransaction.mockImplementation(mockTransactionImpl);
  });

  // =
  // Test Group
  // =
  describe('POST /api/pengelola/bebas-asrama/:id/verifikasi-fasilitas', () => {
    it('Happy Path: Pengelola harus bisa memverifikasi fasilitas', async () => {
      const res = await request(app)
        .post('/api/pengelola/bebas-asrama/1/verifikasi-fasilitas')
        .set('Cookie', `token=${pengelolaToken}`)
        .send({
          fasilitas_status: 'TIDAK_LENGKAP',
          kerusakan: [{ nama_fasilitas: 'Kursi', biaya_kerusakan: 50000 }]
        });

      // Verifikasi response sukses
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      // Verifikasi transaksi dipanggil (sekarang variabelnya terhubung benar)
      expect(mockPrismaTransaction).toHaveBeenCalled();
      
      // Verifikasi notifikasi dipanggil
      expect(createNotification).toHaveBeenCalled();
    });

    it('Sad Path: Harus return 400 jika input body tidak valid', async () => {
        const res = await request(app)
          .post('/api/pengelola/bebas-asrama/1/verifikasi-fasilitas')
          .set('Cookie', `token=${pengelolaToken}`)
          .send({ fasilitas_status: 'HANCUR' }); 
        
        expect(res.statusCode).toBe(400);
      });
  });

  // Tes keamanan sederhana
  describe('Keamanan Endpoint', () => {
      it('Sad Path (Security): Mahasiswa ditolak', async () => {
        const res = await request(app)
          .post('/api/pengelola/bebas-asrama/1/verifikasi-fasilitas')
          .set('Cookie', `token=${mahasiswaToken}`); 
        expect(res.statusCode).toBe(403);
      });
  });
});