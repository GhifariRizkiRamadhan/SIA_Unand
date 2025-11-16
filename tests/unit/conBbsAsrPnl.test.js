// 1. Deklarasikan fungsi mock di PALING ATAS
const mockPrismaTransaction = jest.fn();
const mockPrismaSuratFindUnique = jest.fn();
const mockPrismaSuratUpdate = jest.fn();
const mockPrismaKerusakanDeleteMany = jest.fn();
const mockPrismaKerusakanCreateMany = jest.fn();
const mockPrismaPembayaranCreate = jest.fn();
const mockPrismaMahasiswaFindUnique = jest.fn();

// 2. Mock semua modul SEBELUM 'require'
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    // Implementasi untuk instance 'prisma'
    suratbebasasrama: {
      findUnique: mockPrismaSuratFindUnique,
      update: mockPrismaSuratUpdate,
    },
    kerusakanFasilitas: {
      deleteMany: mockPrismaKerusakanDeleteMany,
      createMany: mockPrismaKerusakanCreateMany,
    },
    pembayaran: {
      create: mockPrismaPembayaranCreate,
    },
    mahasiswa: {
      findUnique: mockPrismaMahasiswaFindUnique,
    },
    // Mock transaksi
    $transaction: jest.fn(async (callback) => {
      // Panggil mock $transaction utama agar kita bisa memverifikasinya
      mockPrismaTransaction();
      // Buat mock 'tx' (prisma transaction client)
      const mockTx = {
        suratbebasasrama: {
          update: mockPrismaSuratUpdate,
        },
        kerusakanFasilitas: {
          deleteMany: mockPrismaKerusakanDeleteMany,
          createMany: mockPrismaKerusakanCreateMany,
        },
        pembayaran: {
          create: mockPrismaPembayaranCreate,
        },
        mahasiswa: {
          findUnique: mockPrismaMahasiswaFindUnique,
        },
      };
      // Jalankan callback transaksi dengan mock 'tx'
      return await callback(mockTx);
    }),
  })),
}));
jest.mock('../../models/userModels');
jest.mock('../../models/bebasAsramaModel');
jest.mock('../../controller/notification', () => ({
  createNotification: jest.fn().mockResolvedValue({}),
}));
jest.mock('ejs');
jest.mock('fs', () => ({ // Mock 'fs' untuk res.sendFile, meskipun tidak di-mock di sini
  existsSync: jest.fn(),
}));

// 3. Baru 'require' dependensi
const controller = require('../../controller/conBbsAsrPnl');
const User = require('../../models/userModels');
const BebasAsrama = require('../../models/bebasAsramaModel');
const { createNotification } = require('../../controller/notification');
const ejs = require('ejs');

// ===================================
// START: TEST SUITES
// ===================================
describe('Unit Test: controller/conBbsAsrPnl.js', () => {
  let mockRequest;
  let mockResponse;
  let nextFunction;

  beforeEach(() => {
    // Reset semua mock history
    jest.clearAllMocks();
    
    // Setup mock request
    mockRequest = {
      params: {},
      body: {},
      user: { user_id: 'pengelola-1' },
      session: { user_id: 'pengelola-1' }
    };
    
    // Setup mock response
    mockResponse = {
      render: jest.fn(),
      redirect: jest.fn(),
      json: jest.fn(),
      status: jest.fn(() => mockResponse),
      sendFile: jest.fn((path, cb) => cb()), // Mock res.sendFile agar sukses by default
    };
    
    // Setup mock 'prisma' (instance)
    // (kita tidak perlu me-reset mock di atas, cukup mock implementasinya)
  });

  // =
  // Test: showBebasAsramaPengelola
  // =
  describe('showBebasAsramaPengelola', () => {
    it('Happy Path: harus render halaman pengelola', async () => {
      User.findById.mockResolvedValue({ name: 'Pengelola', role: 'pengelola' });
      ejs.renderFile.mockResolvedValue('<html></html>');
      
      await controller.showBebasAsramaPengelola(mockRequest, mockResponse);
      
      expect(User.findById).toHaveBeenCalledWith('pengelola-1');
      expect(mockResponse.render).toHaveBeenCalledWith('layouts/main', expect.anything());
    });
    
    it('Sad Path: harus redirect ke /login jika tidak ada user_id', async () => {
      mockRequest.user = null;
      mockRequest.session = null;
      await controller.showBebasAsramaPengelola(mockRequest, mockResponse);
      expect(mockResponse.redirect).toHaveBeenCalledWith('/login');
    });
  });

  // =
  // Test: getAllBebasAsrama
  // =
  describe('getAllBebasAsrama', () => {
    it('Happy Path: harus mengembalikan semua data', async () => {
      const mockData = [{ id: 1 }, { id: 2 }];
      BebasAsrama.findAll.mockResolvedValue(mockData);
      
      await controller.getAllBebasAsrama(mockRequest, mockResponse);
      
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it('Error Handling: harus return 500 jika findAll gagal', async () => {
      BebasAsrama.findAll.mockRejectedValue(new Error('DB error'));
      await controller.getAllBebasAsrama(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  // =
  // Test: getDetailBebasAsrama
  // =
  describe('getDetailBebasAsrama', () => {
    it('Happy Path: harus mengembalikan detail data', async () => {
      const mockData = { id: 1 };
      mockRequest.params.id = '1';
      BebasAsrama.findById.mockResolvedValue(mockData);
      
      await controller.getDetailBebasAsrama(mockRequest, mockResponse);
      
      expect(BebasAsrama.findById).toHaveBeenCalledWith('1');
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it('Sad Path: harus return 404 jika data tidak ditemukan', async () => {
      mockRequest.params.id = '999';
      BebasAsrama.findById.mockResolvedValue(null);
      
      await controller.getDetailBebasAsrama(mockRequest, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  // =
  // Test: verifikasiFasilitas
  // =
  describe('verifikasiFasilitas', () => {
    
    // Data mock dasar untuk transaksi
    const mockPengajuan = {
      Surat_id: 1,
      mahasiswa_id: 10,
      mahasiswa: { kipk: 'tidak', user: { user_id: 'user-mhs-1' } }
    };
    const mockUpdatedSurat = { ...mockPengajuan, status_pengajuan: 'MENUNGGU_PEMBAYARAN', total_biaya: 2000000 };

    // Setup mock default sebelum tiap tes verifikasi
    beforeEach(() => {
      mockPrismaSuratFindUnique.mockResolvedValue(mockPengajuan);
      mockPrismaSuratUpdate.mockResolvedValue(mockUpdatedSurat);
      mockPrismaMahasiswaFindUnique.mockResolvedValue(mockPengajuan.mahasiswa);
    });
    
    it('Happy Path (Non-KIPK, Lengkap): harus set status MENUNGGU_PEMBAYARAN & buat tagihan 2jt', async () => {
      mockRequest.params.id = '1';
      mockRequest.body = { fasilitas_status: 'LENGKAP', kerusakan: [] };

      await controller.verifikasiFasilitas(mockRequest, mockResponse);

      // Verifikasi transaksi dipanggil
      expect(mockPrismaTransaction).toHaveBeenCalled();
      // Verifikasi surat di-update dengan biaya 2jt
      expect(mockPrismaSuratUpdate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          status_pengajuan: 'MENUNGGU_PEMBAYARAN',
          total_biaya: 2000000,
          biaya_tambahan: 0
        })
      }));
      // Verifikasi tagihan pembayaran dibuat
      expect(mockPrismaPembayaranCreate).toHaveBeenCalled();
      // Verifikasi kerusakan TIDAK dibuat
      expect(mockPrismaKerusakanCreateMany).not.toHaveBeenCalled();
      // Verifikasi notifikasi dikirim
      expect(createNotification).toHaveBeenCalled();
      // Verifikasi response sukses
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('Happy Path (Non-KIPK, Tidak Lengkap): harus tambah biaya kerusakan', async () => {
      mockRequest.params.id = '1';
      mockRequest.body = { 
        fasilitas_status: 'TIDAK_LENGKAP', 
        kerusakan: [{ nama_fasilitas: 'Kursi', biaya_kerusakan: 50000 }]
      };
      // Update mock agar total biaya benar
      mockPrismaSuratUpdate.mockResolvedValue({ ...mockUpdatedSurat, total_biaya: 2050000 });

      await controller.verifikasiFasilitas(mockRequest, mockResponse);
      
      // Verifikasi surat di-update dengan biaya 2.050.000
      expect(mockPrismaSuratUpdate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          total_biaya: 2050000,
          biaya_tambahan: 50000
        })
      }));
      // Verifikasi tagihan pembayaran dibuat
      expect(mockPrismaPembayaranCreate).toHaveBeenCalled();
      // Verifikasi kerusakan DIBUAT
      expect(mockPrismaKerusakanCreateMany).toHaveBeenCalled();
    });

    it('Happy Path (KIPK, Tidak Lengkap): harus set tagihan HANYA biaya kerusakan', async () => {
      // Setup: Mahasiswa adalah KIPK
      const mockPengajuanKIPK = { ...mockPengajuan, mahasiswa: { kipk: 'ya', user: { user_id: 'user-mhs-1' } } };
      mockPrismaSuratFindUnique.mockResolvedValue(mockPengajuanKIPK);
      mockPrismaSuratUpdate.mockResolvedValue({ ...mockPengajuanKIPK, total_biaya: 50000 });
      mockPrismaMahasiswaFindUnique.mockResolvedValue(mockPengajuanKIPK.mahasiswa);
      
      mockRequest.params.id = '1';
      mockRequest.body = { 
        fasilitas_status: 'TIDAK_LENGKAP', 
        kerusakan: [{ nama_fasilitas: 'Kursi', biaya_kerusakan: 50000 }]
      };
      
      await controller.verifikasiFasilitas(mockRequest, mockResponse);

      // Verifikasi surat di-update dengan biaya HANYA 50.000 (biaya pokok 0)
      expect(mockPrismaSuratUpdate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          total_biaya: 50000,
          biaya_tambahan: 50000
        })
      }));
      // Verifikasi tagihan pembayaran DIBUAT
      expect(mockPrismaPembayaranCreate).toHaveBeenCalled();
      // Verifikasi kerusakan DIBUAT
      expect(mockPrismaKerusakanCreateMany).toHaveBeenCalled();
    });

    it('Happy Path (KIPK, Lengkap - Validasi Bug Fix): harus set status SELESAI & TIDAK buat tagihan', async () => {
      // Setup: Mahasiswa adalah KIPK
      const mockPengajuanKIPK = { ...mockPengajuan, mahasiswa: { kipk: 'ya', user: { user_id: 'user-mhs-1' } } };
      mockPrismaSuratFindUnique.mockResolvedValue(mockPengajuanKIPK);
      // Setup mock update agar Selesai
      const mockUpdatedSelesai = { ...mockPengajuanKIPK, status_pengajuan: 'SELESAI', total_biaya: 0 };
      mockPrismaSuratUpdate.mockResolvedValue(mockUpdatedSelesai);
      mockPrismaMahasiswaFindUnique.mockResolvedValue(mockPengajuanKIPK.mahasiswa);
      
      mockRequest.params.id = '1';
      mockRequest.body = { fasilitas_status: 'LENGKAP', kerusakan: [] };
      
      await controller.verifikasiFasilitas(mockRequest, mockResponse);

      // Verifikasi surat di-update dengan status SELESAI
      expect(mockPrismaSuratUpdate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          status_pengajuan: 'SELESAI',
          total_biaya: 0
        })
      }));
      
      // VERIFIKASI BUG FIX #2: Tagihan pembayaran TIDAK dibuat
      expect(mockPrismaPembayaranCreate).not.toHaveBeenCalled();
      
      // VERIFIKASI BUG FIX #3: Notifikasi mengirim pesan "SELESAI"
      expect(createNotification).toHaveBeenCalledWith(
        'user-mhs-1',
        'Status Surat Bebas Asrama Diperbarui',
        expect.stringContaining('diperbarui menjadi "SELESAI"'), // <-- Validasi pesan
        'status_update',
        '1'
      );
    });

    it('Sad Path (400 - Bad Input): harus return 400 jika status tidak valid', async () => {
      mockRequest.params.id = '1';
      mockRequest.body = { fasilitas_status: 'RUSAK' }; // Input tidak valid
      
      await controller.verifikasiFasilitas(mockRequest, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockPrismaTransaction).not.toHaveBeenCalled(); // Transaksi tidak boleh berjalan
    });

    it('Sad Path (404 - Not Found): harus return 404 jika pengajuan tidak ditemukan', async () => {
      mockPrismaSuratFindUnique.mockResolvedValue(null); // Tidak ditemukan
      mockRequest.params.id = '1';
      mockRequest.body = { fasilitas_status: 'LENGKAP' };
      
      await controller.verifikasiFasilitas(mockRequest, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockPrismaTransaction).not.toHaveBeenCalled();
    });

    it('Error Handling (500 - Transaction Fail): harus return 500 jika transaksi gagal', async () => {
      // Buat salah satu operasi di dalam transaksi gagal
      mockPrismaKerusakanDeleteMany.mockRejectedValue(new Error('Gagal hapus'));
      
      mockRequest.params.id = '1';
      mockRequest.body = { fasilitas_status: 'LENGKAP' };
      
      await controller.verifikasiFasilitas(mockRequest, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  // =
  // Test: getBuktiPembayaran
  // =
  describe('getBuktiPembayaran', () => {
    it('Happy Path: harus mengirim file jika ditemukan', async () => {
      const mockData = {
        pembayaran: [{ bukti_pembayaran: 'uploads/bukti/test.jpg' }]
      };
      BebasAsrama.findByIdWithPembayaran.mockResolvedValue(mockData);
      mockRequest.params.id = '1';
      
      await controller.getBuktiPembayaran(mockRequest, mockResponse);
      
      expect(mockResponse.sendFile).toHaveBeenCalledWith(
        expect.stringContaining('test.jpg'),
        expect.any(Function)
      );
    });
    
    it('Sad Path (404 - No Pengajuan): harus return 404 jika pengajuan tidak ada', async () => {
      BebasAsrama.findByIdWithPembayaran.mockResolvedValue(null);
      mockRequest.params.id = '999';
      
      await controller.getBuktiPembayaran(mockRequest, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('Sad Path (404 - No Bukti): harus return 404 jika tidak ada file bukti', async () => {
      const mockData = { pembayaran: [] }; // Tidak ada pembayaran
      BebasAsrama.findByIdWithPembayaran.mockResolvedValue(mockData);
      mockRequest.params.id = '1';
      
      await controller.getBuktiPembayaran(mockRequest, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining("Bukti pembayaran untuk pengajuan ini tidak ditemukan")
      }));
    });

    it('Sad Path (404 - File Error): harus return 404 jika res.sendFile gagal', async () => {
      const mockData = {
        pembayaran: [{ bukti_pembayaran: 'uploads/bukti/file_hilang.jpg' }]
      };
      BebasAsrama.findByIdWithPembayaran.mockResolvedValue(mockData);
      mockRequest.params.id = '1';
      // Mock res.sendFile agar memanggil callback error
      mockResponse.sendFile.mockImplementation((path, cb) => cb(new Error('File not found')));
      
      await controller.getBuktiPembayaran(mockRequest, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining("File fisik tidak ditemukan di server")
      }));
    });
  });
});