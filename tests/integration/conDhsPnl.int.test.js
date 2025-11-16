// ==========================================================
// FILE: tests/integration/conDhsPnl.int.test.js
// ==========================================================

require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret-rahasia-untuk-tes';

// 1. Deklarasikan FUNGSI MOCK di PALING ATAS
const mockSingletonPrismaMahasiswaFindFirst = jest.fn();
const mockSingletonPrismaPengelolaFindFirst = jest.fn();
const mockSingletonPrismaDisconnect = jest.fn();
const mockPrismaTransaction = jest.fn(); 
const mockUserFindById = jest.fn();

// 2. PANGGIL SEMUA JEST.MOCK() SETELAH ITU
jest.mock('../../config/database', () => ({
  prisma: {
    // Mock untuk authMiddleware
    mahasiswa: { findFirst: mockSingletonPrismaMahasiswaFindFirst },
    pengelolaasrama: { findFirst: mockSingletonPrismaPengelolaFindFirst },
    $disconnect: mockSingletonPrismaDisconnect,
    
    // Mock untuk controller 'showDashboard'
    $transaction: mockPrismaTransaction,
    // (Tambahkan mock .count() dan .groupBy() yang kosong)
    suratbebasasrama: { count: jest.fn() },
    pelaporankerusakan: { count: jest.fn() },
    mahasiswa: { 
      count: jest.fn(), 
      groupBy: jest.fn(),
      findFirst: mockSingletonPrismaMahasiswaFindFirst // Dibutuhkan oleh auth
    },
  },
}));
jest.mock('../../models/userModels', () => ({
  findById: mockUserFindById,
}));

// (Mock semua controller dan middleware lain dari ruter.js)
jest.mock('ejs');
jest.mock('../../controller/notification', () => ({ getNotifications: jest.fn((req, res) => res.json([])), markAsRead: jest.fn((req, res) => res.json({})), markAllAsRead: jest.fn((req, res) => res.json({}))}));
jest.mock('../../middlewares/uploadMiddleware', () => ({ uploadBukti: (req, res, next) => next(), upload: (req, res, next) => next(), uploadImage: (req, res, next) => next(), uploadIzinDokumen: (req, res, next) => next(), uploadFotoKerusakan: (req, res, next) => next()}));
jest.mock('../../config/multerConfig', () => ({ uploadMahasiswaFoto: { single: () => (req, res, next) => next() }}));
jest.mock('../../middlewares/validateEmail', () => jest.fn((req, res, next) => next()));
jest.mock('../../middlewares/rateLimiter', () => jest.fn((req, res, next) => next()));
jest.mock('../../controller/conLogin', () => ({ showLogin: jest.fn((req, res) => res.send()), authController: { login: jest.fn(), logout: jest.fn() }}));
jest.mock('../../controller/conRegis', () => ({ regcon: { showRegis: jest.fn(), register: jest.fn() }}));
jest.mock('../../controller/conProfile', () => ({ showProfile: jest.fn(), updateProfile: jest.fn()}));
jest.mock('../../controller/conForgot', () => ({ showForgotPassword: jest.fn(), resetPassword: jest.fn()}));
jest.mock('../../controller/conPbyr', () => ({ showPembayaran: jest.fn((req, res) => res.send()), uploadBuktiPembayaran: jest.fn(), getDetailPembayaran: jest.fn(), reuploadBuktiPembayaran: jest.fn(), getAllPembayaran: jest.fn(), approvePembayaran: jest.fn(), rejectPembayaran: jest.fn()}));
jest.mock('../../controller/conBbsAsr', () => ({ showBebasAsrama: jest.fn((req, res) => res.send()), ajukanBebasAsrama: jest.fn(), getStatusBebasAsrama: jest.fn(), deleteBebasAsrama: jest.fn(), downloadSurat: jest.fn(), getTagihanMahasiswa: jest.fn(), getRiwayatPengajuan: jest.fn(), checkActiveSubmission: jest.fn()}));
jest.mock('../../controller/conIzinKeluar', () => ({ showFormMahasiswa: jest.fn(), listIzinMahasiswa: jest.fn(), submitIzinMahasiswa: jest.fn(), showIzinPengelola: jest.fn(), listIzinPengelola: jest.fn(), approveIzin: jest.fn(), rejectIzin: jest.fn(), updateIzinNotes: jest.fn(), resetIzinStatus: jest.fn()}));
jest.mock('../../controller/conPelaporan', () => ({ showFormPelaporan: jest.fn(), listPelaporanMahasiswa: jest.fn(), submitPelaporan: jest.fn(), showPelaporanPengelola: jest.fn(), listPelaporanPengelola: jest.fn(), updateStatusPelaporan: jest.fn()}));
jest.mock('../../controller/conDshMhs', () => ({ showDashboard: jest.fn((req, res) => res.send('user dashboard')), getPemberitahuanDetail: jest.fn() })); 
jest.mock('../../controller/conBbsAsrPnl', () => ({ getBuktiPembayaran: jest.fn(), showBebasAsramaPengelola: jest.fn(), getAllBebasAsrama: jest.fn(), getDetailBebasAsrama: jest.fn(), verifikasiFasilitas: jest.fn()})); 
jest.mock('../../controller/conPmbrthnPnl', () => ({ showPemberitahuanPengelola: jest.fn(), getPemberitahuan: jest.fn(), hapusPemberitahuan: jest.fn(), tambahPemberitahuan: jest.fn(), editPemberitahuan: jest.fn()}));
jest.mock('../../controller/conDtPnghni', () => ({ showDtPenghuni: jest.fn(), tambahPenghuni: jest.fn(), editPenghuni: jest.fn(), toggleStatusPenghuni: jest.fn(), getPenghuniById: jest.fn()}));

// 3. BARU REQUIRE SEMUA DEPENDENSI
const request = require('supertest');
const { app, server } = require('../../app');
const jwt = require('jsonwebtoken');
const { prisma } = require('../../config/database');
const User = require('../../models/userModels'); 
const ejs = require('ejs');

// Helper untuk membuat token
const generateAuthToken = (payload) => {
  const defaultPayload = { user_id: 'user-default', email: 'test@example.com', role: 'mahasiswa', mahasiswa_id: 1 };
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
// START: TEST SUITES
// ===================================
describe('Integration Test: Dashboard Pengelola', () => {
  let mahasiswaToken;
  let pengelolaToken;
  const mockUserData = { name: 'Test Pengelola', role: 'pengelola', avatar: null };

  afterAll(async () => {
    await new Promise(resolve => server.close(resolve));
    await prisma.$disconnect();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Buat token
    mahasiswaToken = generateAuthToken({ user_id: 'mhs-1', role: 'mahasiswa', mahasiswa_id: 1 });
    pengelolaToken = generateAuthToken({ user_id: 'pengelola-1', role: 'pengelola', pengelola_id: 1, mahasiswa_id: null });

    // Mock panggilan di luar transaksi
    mockUserFindById.mockResolvedValue(mockUserData);

    // Mock panggilan $transaction (8 item)
    mockPrismaTransaction.mockResolvedValue([
      50, 10, 5, 2, 1, 8, 1, 
      [{ jurusan: 'Sistem Informasi', _count: { jurusan: 10 } }]
    ]);

    ejs.renderFile.mockResolvedValue('<html>Dashboard Pengelola</html>');
  });

  it('Happy Path: Pengelola harus bisa mengakses dashboard-nya', async () => {
    const res = await request(app)
      .get('/pengelola/dashboard')
      .set('Cookie', `token=${pengelolaToken}`); // <-- Token Pengelola

    // Verifikasi: Halaman sukses di-render
    expect(res.statusCode).toBe(200);
    // Verifikasi: Panggilan DB (User dan Transaksi) dilakukan
    expect(mockUserFindById).toHaveBeenCalled();
    expect(mockPrismaTransaction).toHaveBeenCalled();
    // Verifikasi: HTML dikirim ke klien
    expect(res.text).toContain('<html>Dashboard Pengelola</html>');
  });

  it('Sad Path (Security): Mahasiswa TIDAK BISA mengakses dashboard pengelola', async () => {
    const res = await request(app)
      .get('/pengelola/dashboard')
      .set('Cookie', `token=${mahasiswaToken}`); // <-- Token Mahasiswa

    // Verifikasi: Middleware 'requirePengelola' melakukan redirect
    expect(res.statusCode).toBe(302); 
    expect(res.headers.location).toBe('/mahasiswa/dashboard');
  });

  it('Sad Path (Auth): Pengguna yang tidak login harus di-redirect ke /login', async () => {
    const res = await request(app)
      .get('/pengelola/dashboard'); // <-- Tidak ada token

    // Verifikasi: authMiddleware mengembalikan 401 (karena supertest adalah klien API)
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toContain('Unauthorized: No token provided');
  });
});