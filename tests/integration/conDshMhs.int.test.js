// ==========================================================
// FILE: tests/integration/conDshMhs.int.test.js (LENGKAP & DIPERBAIKI)
// ==========================================================

require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret-rahasia-untuk-tes';

// 1. Deklarasikan FUNGSI MOCK di PALING ATAS
const mockSingletonPrismaMahasiswaFindFirst = jest.fn();
const mockSingletonPrismaPengelolaFindFirst = jest.fn();
const mockSingletonPrismaDisconnect = jest.fn();
const mockUserFindById = jest.fn();
const mockUserCountAll = jest.fn();

// --- Mock untuk semua model yang dipanggil ---
const mockPrismaIzinkeluarCount = jest.fn();
const mockPrismaPelaporanCount = jest.fn();
const mockPrismaBebasAsramaCount = jest.fn();
const mockPrismaPemberitahuanCount = jest.fn();
const mockPrismaPemberitahuanFindMany = jest.fn();

// 2. PANGGIL SEMUA JEST.MOCK() SETELAH ITU
jest.mock('../../config/database', () => ({
  prisma: {
    // Mock untuk authMiddleware
    mahasiswa: { findFirst: mockSingletonPrismaMahasiswaFindFirst },
    pengelolaasrama: { findFirst: mockSingletonPrismaPengelolaFindFirst },
    $disconnect: mockSingletonPrismaDisconnect,
    
    // --- PERBAIKAN: Mock untuk controller 'showDashboard' (kode asli) ---
    izinkeluar: { count: mockPrismaIzinkeluarCount },
    pelaporankerusakan: { count: mockPrismaPelaporanCount },
    suratbebasasrama: { count: mockPrismaBebasAsramaCount },
    pemberitahuan: {
      count: mockPrismaPemberitahuanCount,
      findMany: mockPrismaPemberitahuanFindMany,
    },
    // --- AKHIR PERBAIKAN ---
  },
}));
jest.mock('../../models/userModels', () => ({
  findById: mockUserFindById,
  countAll: mockUserCountAll
}));
// (Mock sisa controller dan middleware)
jest.mock('../../controller/notification', () => ({ getNotifications: jest.fn((req, res) => res.json([])), markAsRead: jest.fn((req, res) => res.json({})), markAllAsRead: jest.fn((req, res) => res.json({}))}));
jest.mock('ejs');
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
jest.mock('../../controller/conDhsPnl', () => ({ showDashboard: jest.fn((req, res) => res.send('admin dashboard'))})); 
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
describe('Integration Test: Dashboard Mahasiswa', () => {
  let mahasiswaToken;
  let pengelolaToken;
  const mockUserData = { name: 'Test User', role: 'mahasiswa', avatar: null };

  afterAll(async () => {
    await new Promise(resolve => server.close(resolve));
    await prisma.$disconnect();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    mahasiswaToken = generateAuthToken({ user_id: 'mhs-1', role: 'mahasiswa', mahasiswa_id: 1 });
    pengelolaToken = generateAuthToken({ user_id: 'pengelola-1', role: 'pengelola', pengelola_id: 1, mahasiswa_id: null });

    const mockPemberitahuanList = [{ id: 1, title: 'Test', image: 'test.jpg' }];
    
    // --- PERBAIKAN: Mock semua 10 panggilan 'await' dari kode ASLI ---
    mockUserFindById.mockResolvedValue(mockUserData);
    mockUserCountAll.mockResolvedValue(100);
    // Panggilan .count() akan digunakan 6 kali (total + 7 hari)
    mockPrismaIzinkeluarCount.mockResolvedValue(1);
    mockPrismaPelaporanCount.mockResolvedValue(2);
    mockPrismaBebasAsramaCount.mockResolvedValue(3);
    // Panggilan sisa
    mockPrismaPemberitahuanCount.mockResolvedValue(1);
    mockPrismaPemberitahuanFindMany.mockResolvedValue(mockPemberitahuanList);
    // --- AKHIR PERBAIKAN ---

    ejs.renderFile.mockResolvedValue('<html>Dashboard Mahasiswa</html>');
  });

  it('Happy Path: Mahasiswa harus bisa mengakses dashboard-nya', async () => {
    const res = await request(app)
      .get('/mahasiswa/dashboard')
      .set('Cookie', `token=${mahasiswaToken}`);

    // Ini sekarang akan lolos
    expect(res.statusCode).toBe(200);
    // Verifikasi bahwa panggilan database utama dilakukan
    expect(mockUserFindById).toHaveBeenCalled();
    expect(mockPrismaIzinkeluarCount).toHaveBeenCalled();
    expect(res.text).toContain('<html>Dashboard Mahasiswa</html>');
  });

  it('Sad Path (Security): Pengelola TIDAK BISA mengakses dashboard mahasiswa', async () => {
    const res = await request(app)
      .get('/mahasiswa/dashboard')
      .set('Cookie', `token=${pengelolaToken}`); 

    expect(res.statusCode).toBe(302); 
    expect(res.headers.location).toBe('/pengelola/dashboard');
  });

  it('Sad Path (Auth): Pengguna yang tidak login harus me-return 401 (API Request)', async () => {
    const res = await request(app)
      .get('/mahasiswa/dashboard');

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toContain('Unauthorized: No token provided');
  });
});