// ==========================================================
// FILE: tests/unit/conDshMhs.test.js (LENGKAP & DIPERBAIKI)
// ==========================================================

// 1. Deklarasikan fungsi mock di PALING ATAS
const mockPrismaIzinkeluarCount = jest.fn();
const mockPrismaPelaporanCount = jest.fn();
const mockPrismaBebasAsramaCount = jest.fn();
const mockPrismaPemberitahuanCount = jest.fn();
const mockPrismaPemberitahuanFindMany = jest.fn();
const mockPrismaPemberitahuanFindUnique = jest.fn();
const mockUserFindById = jest.fn();
const mockUserCountAll = jest.fn();
const mockPrismaTransaction = jest.fn(); // Mock untuk transaksi

// 2. PANGGIL SEMUA JEST.MOCK() SETELAH ITU
jest.mock('../../config/database', () => ({
  prisma: {
    izinkeluar: { count: mockPrismaIzinkeluarCount },
    pelaporankerusakan: { count: mockPrismaPelaporanCount },
    suratbebasasrama: { count: mockPrismaBebasAsramaCount },
    pemberitahuan: {
      count: mockPrismaPemberitahuanCount,
      findMany: mockPrismaPemberitahuanFindMany,
      findUnique: mockPrismaPemberitahuanFindUnique,
    },
    // Tambahkan mock untuk transaksi (untuk kode yang sudah di-refactor)
    $transaction: mockPrismaTransaction,
  },
}));
jest.mock('../../models/userModels', () => ({
  findById: mockUserFindById,
  countAll: mockUserCountAll,
}));
jest.mock('ejs');

// 3. BARU REQUIRE SEMUA DEPENDENSI
const controller = require('../../controller/conDshMhs');
const User = require('../../models/userModels');
const ejs = require('ejs');
const { prisma } = require('../../config/database');

// ===================================
// START: TEST SUITES
// ===================================
describe('Unit Test: controller/conDshMhs.js', () => {
  let mockRequest;
  let mockResponse;

  // --- PERBAIKAN #1: Pindahkan mock data ke scope 'describe' ---
  const mockUserData = { name: 'Test Mahasiswa', role: 'mahasiswa', avatar: null };
  const mockPemberitahuanList = [{ id: 1, title: 'Test', image: '/test.jpg' }]; // Path gambar diperbaiki
  // --- AKHIR PERBAIKAN #1 ---

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = {
      params: {},
      query: {},
      user: { user_id: 'mhs-1', mahasiswa_id: 1 },
      session: { user_id: 'mhs-1' }
    };
    mockResponse = {
      render: jest.fn(),
      redirect: jest.fn(),
      json: jest.fn(),
      status: jest.fn(() => mockResponse),
      send: jest.fn(), 
    };

    // --- PERBAIKAN #3: Mock panggilan di luar transaksi ---
    User.findById.mockResolvedValue(mockUserData);
    User.countAll.mockResolvedValue(100);
    
    // --- PERBAIKAN #3: Mock transaksi HANYA 8 item ---
    prisma.$transaction.mockResolvedValue([
      1, // 0: Total Izin
      2, // 1: Total Laporan
      3, // 2: Total Bebas Asrama
      0, // 3: Perubahan Izin
      1, // 4: Perubahan Laporan
      0, // 5: Perubahan Bebas Asrama
      1, // 6: Total Pemberitahuan
      mockPemberitahuanList, // 7: List Pemberitahuan
    ]);
    
    ejs.renderFile.mockResolvedValue('<html>Dashboard Mahasiswa</html>');
  });

  // =
  // Test: showDashboard
  // =
  describe('showDashboard', () => {
    
    // ==========================================================
    // PERBAIKAN #2: Tes Happy Path ini diperbarui
    // ==========================================================
    it('Happy Path: harus memanggil transaksi dan me-render halaman', async () => {
      await controller.showDashboard(mockRequest, mockResponse);

      // Verifikasi panggilan DI LUAR transaksi
      expect(User.findById).toHaveBeenCalledWith('mhs-1');
      expect(User.countAll).toHaveBeenCalled();
      // Verifikasi panggilan TRANSAKSI
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      
      // Verifikasi EJS di-render dengan path dan data yang benar
      expect(ejs.renderFile).toHaveBeenCalledWith(
        // PERBAIKAN A: Gunakan stringMatching untuk path (robust untuk Windows/Unix)
        expect.stringMatching(/[\\\/]views[\\\/]mahasiswa[\\\/]dashboard\.ejs$/),
        // PERBAIKAN B: Harapkan SEMUA kunci, bukan hanya 'stats'
        expect.objectContaining({
          user: mockUserData,
          totalUsers: 100,
          pemberitahuanList: mockPemberitahuanList, // Periksa path gambar yang sudah diformat
          stats: { 
            izin: 1,
            laporan: 2,
            bebasAsrama: 3,
            perubahanIzin: 0,
            perubahanLaporan: 1,
            perubahanBebasAsrama: 0
          },
          pagination: { page: 1, totalPages: 1, hasNext: false, hasPrev: false }
        })
      );
      
      // Verifikasi: Layout utama di-render
      expect(mockResponse.render).toHaveBeenCalledWith('layouts/main', expect.anything());
    });
    // ==========================================================

    it('Sad Path: harus redirect ke /login jika tidak ada user_id', async () => {
      mockRequest.user = null;
      mockRequest.session = null;
      await controller.showDashboard(mockRequest, mockResponse);
      expect(mockResponse.redirect).toHaveBeenCalledWith('/login');
    });

    it('Sad Path: harus me-render halaman error 403 jika tidak ada mahasiswa_id', async () => {
      mockRequest.user.mahasiswa_id = null; // Tidak ada ID mahasiswa
      await controller.showDashboard(mockRequest, mockResponse);
      
      // Verifikasi (untuk kode yang sudah di-refactor):
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.render).toHaveBeenCalledWith('error', { message: expect.stringContaining('Forbidden') });
    });

    // ==========================================================
    // PERBAIKAN #2: Tes ini diubah untuk mencocokkan kode yang sudah di-refactor
    // ==========================================================
    it('Error Handling: harus me-render halaman error jika transaksi gagal', async () => {
      const dbError = new Error('Database crash');
      // Simulasikan kegagalan pada salah satu panggilan (bisa User.findById atau $transaction)
      User.findById.mockRejectedValue(dbError); 

      await controller.showDashboard(mockRequest, mockResponse);

      // Verifikasi (untuk kode yang sudah di-refactor):
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.render).toHaveBeenCalledWith('error', { message: 'Database crash' });
    });
    // ==========================================================
  });

  // =
  // Test: getPemberitahuanDetail
  // =
  describe('getPemberitahuanDetail', () => {
    it('Happy Path: harus mengembalikan detail pemberitahuan', async () => {
      const mockPemberitahuan = { pemberitahuan_id: 1, title: 'Judul Tes' };
      mockRequest.params.id = '1';
      mockPrismaPemberitahuanFindUnique.mockResolvedValue(mockPemberitahuan);
      await controller.getPemberitahuanDetail(mockRequest, mockResponse);
      expect(mockPrismaPemberitahuanFindUnique).toHaveBeenCalledWith(expect.anything());
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true, data: mockPemberitahuan });
    });

    it('Sad Path (400 Bad Request): harus return 400 jika ID tidak valid', async () => {
      mockRequest.params.id = 'abc'; 
      await controller.getPemberitahuanDetail(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('Sad Path (404 Not Found): harus return 404 jika data tidak ditemukan', async () => {
      mockRequest.params.id = '999';
      mockPrismaPemberitahuanFindUnique.mockResolvedValue(null);
      await controller.getPemberitahuanDetail(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });
});