// 1. Deklarasikan fungsi mock di PALING ATAS
// (Kita akan mock semua panggilan prisma yang ada di dalam transaksi)
const mockPrismaMahasiswaCount = jest.fn();
const mockPrismaBebasAsramaCount = jest.fn();
const mockPrismaPelaporanCount = jest.fn();
const mockPrismaMahasiswaGroupBy = jest.fn();
const mockUserFindById = jest.fn();
const mockPrismaTransaction = jest.fn(); 

// 2. PANGGIL SEMUA JEST.MOCK() SETELAH ITU
jest.mock('../../config/database', () => ({
  prisma: {
    // Sediakan mock untuk setiap model yang dipanggil
    mahasiswa: {
      count: mockPrismaMahasiswaCount,
      groupBy: mockPrismaMahasiswaGroupBy,
    },
    suratbebasasrama: { 
      count: mockPrismaBebasAsramaCount 
    },
    pelaporankerusakan: { 
      count: mockPrismaPelaporanCount 
    },
    // Mock $transaction
    $transaction: mockPrismaTransaction,
  },
}));
jest.mock('../../models/userModels', () => ({
  findById: mockUserFindById,
}));
jest.mock('ejs'); // Mock EJS

// 3. BARU REQUIRE SEMUA DEPENDENSI
const controller = require('../../controller/conDhsPnl');
const User = require('../../models/userModels');
const ejs = require('ejs');
const { prisma } = require('../../config/database');

// ===================================
// START: TEST SUITES
// ===================================
describe('Unit Test: controller/conDhsPnl.js', () => {
  let mockRequest;
  let mockResponse;

  // Definisikan data mock default
  const mockUserData = { name: 'Test Pengelola', role: 'pengelola', avatar: null };
  const mockJurusanData = [
    { jurusan: 'Sistem Informasi', _count: { jurusan: 10 } },
    { jurusan: 'Teknik Komputer', _count: { jurusan: 5 } },
  ];
  // Ini adalah mock untuk 8 item di dalam $transaction
  const mockTransactionResults = [
    50, // 0: Total Mahasiswa Aktif
    10, // 1: Total Surat Selesai
    5,  // 2: Total Laporan Selesai
    2,  // 3: Perubahan Surat Selesai
    1,  // 4: Perubahan Laporan Selesai
    8,  // 5: Mahasiswa Baru
    1,  // 6: Mahasiswa Non-aktif
    mockJurusanData, // 7: Data Group By Jurusan
  ];

  beforeEach(() => {
    // Reset semua mock sebelum setiap tes
    jest.clearAllMocks();

    // Setup mock request default
    mockRequest = {
      params: {},
      query: {},
      user: { user_id: 'admin-1' }, // User pengelola
      session: { user_id: 'admin-1' }
    };
    
    // Setup mock response default
    mockResponse = {
      render: jest.fn(),
      redirect: jest.fn(),
      json: jest.fn(),
      status: jest.fn(() => mockResponse),
    };

    // --- Atur Mock Default untuk Semua Tes (Happy Path) ---
    // 1. Mock panggilan di luar transaksi
    User.findById.mockResolvedValue(mockUserData);
    // 2. Mock panggilan $transaction
    prisma.$transaction.mockResolvedValue(mockTransactionResults);
    // 3. Mock ejs
    ejs.renderFile.mockResolvedValue('<html>Dashboard Pengelola</html>');
  });

  // =
  // Test: showDashboard
  // =
  describe('showDashboard', () => {
    it('Happy Path: harus memanggil User.findById dan $transaction, lalu me-render halaman', async () => {
      // Panggil fungsi controller
      await controller.showDashboard(mockRequest, mockResponse);

      // Verifikasi: Panggilan di luar transaksi
      expect(User.findById).toHaveBeenCalledWith('admin-1');

      // Verifikasi: Panggilan $transaction
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      // Verifikasi bahwa $transaction dipanggil dengan 8 promise
      expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(8);

      // Verifikasi: EJS di-render dengan data yang benar
      expect(ejs.renderFile).toHaveBeenCalledWith(
        expect.stringMatching(/[\\\/]views[\\\/]pengelola[\\\/]dashboard\.ejs$/),
        expect.objectContaining({
          user: mockUserData,
          totalMahasiswaAktif: 50,
          totalSelesai: 10,
          perubahanPenghuni: 7, // (8 penambahan - 1 pengurangan)
          labelsJurusan: ['Sistem Informasi', 'Teknik Komputer'],
          countsJurusan: [10, 5]
        })
      );
      
      // Verifikasi: Layout utama di-render
      expect(mockResponse.render).toHaveBeenCalledWith('layouts/main', expect.anything());
    });

    it('Sad Path: harus redirect ke /login jika tidak ada user_id', async () => {
      mockRequest.user = null;
      mockRequest.session = null;
      
      await controller.showDashboard(mockRequest, mockResponse);
      
      // Verifikasi: Redirect terjadi
      expect(mockResponse.redirect).toHaveBeenCalledWith('/login');
      // Verifikasi: Tidak ada panggilan DB
      expect(User.findById).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('Error Handling: harus me-render halaman error jika User.findById gagal', async () => {
      const dbError = new Error('Gagal ambil user');
      User.findById.mockRejectedValue(dbError); // Simulasikan error

      await controller.showDashboard(mockRequest, mockResponse);

      // Verifikasi: Halaman error di-render
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.render).toHaveBeenCalledWith('error', { message: 'Gagal ambil user' });
      // Verifikasi: Transaksi tidak berjalan
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('Error Handling: harus me-render halaman error jika $transaction gagal', async () => {
      const dbError = new Error('Transaksi gagal');
      prisma.$transaction.mockRejectedValue(dbError); // Simulasikan error

      await controller.showDashboard(mockRequest, mockResponse);

      // Verifikasi: Panggilan User.findById tetap terjadi
      expect(User.findById).toHaveBeenCalled();
      // Verifikasi: Halaman error di-render
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.render).toHaveBeenCalledWith('error', { message: 'Transaksi gagal' });
    });
  });
});