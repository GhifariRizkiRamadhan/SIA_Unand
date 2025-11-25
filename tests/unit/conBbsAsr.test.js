// 1. DEKLARASIKAN FUNGSI MOCK DI PALING ATAS
const mockPrismaMahasiswaFindUnique = jest.fn();
const mockPrismaPengelolaFindMany = jest.fn();
const mockPrismaMahasiswaFindFirst = jest.fn();
const mockPrismaPengelolaFindFirst = jest.fn();

// 2. PANGGIL SEMUA JEST.MOCK() SETELAH ITU
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    mahasiswa: {
      findUnique: mockPrismaMahasiswaFindUnique,
      findFirst: mockPrismaMahasiswaFindFirst,
    },
    pengelolaasrama: {
      findMany: mockPrismaPengelolaFindMany,
      findFirst: mockPrismaPengelolaFindFirst,
    },
  })),
}));
jest.mock('../../models/userModels');
jest.mock('../../models/bebasAsramaModel');
jest.mock('../../models/pembayaranModel');
jest.mock('../../controller/notification', () => ({
  createNotification: jest.fn().mockResolvedValue({}),
}));
jest.mock('ejs');
jest.mock('pdfkit');

// 3. BARU REQUIRE SEMUA DEPENDENSI
const controller = require('../../controller/conBbsAsr'); // <-- FIX: Ini yang hilang
const User = require('../../models/userModels');
const BebasAsrama = require('../../models/bebasAsramaModel');
const Pembayaran = require('../../models/pembayaranModel');
const notificationController = require('../../controller/notification');
const ejs = require('ejs');
const PDFDocument = require('pdfkit');

// Mock global.io
global.io = {
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
};

// ===================================
// START: TEST SUITES
// ===================================

describe('Unit Test: controller/conBbsAsr.js', () => {
  let mockRequest;
  let mockResponse;
  let nextFunction;
  
  // Data mock default
  const mockMahasiswa = { 
    mahasiswa_id: 1, 
    kipk: 'tidak', 
    nim: '12345',
    user: { user_id: 'user-1', name: 'Test User' } 
  };
  const mockPengajuanBaru = { Surat_id: 10, status_pengajuan: 'VERIFIKASI_FASILITAS', total_biaya: 2000000 };
  const mockPengelola = [{ user_id: 'pengelola-1' }];
  const mockUser = { name: 'Test User', role: 'mahasiswa', avatar: null };

  // Setup ulang mock req/res/next DAN mock default sebelum setiap tes
  beforeEach(() => {
    // Reset semua mock history
    jest.clearAllMocks();
    jest.resetAllMocks();

    // --- Atur Mock Default untuk Semua Tes ---
    mockPrismaMahasiswaFindUnique.mockResolvedValue(mockMahasiswa);
    mockPrismaPengelolaFindMany.mockResolvedValue(mockPengelola);
    User.findById.mockResolvedValue(mockUser);
    BebasAsrama.findActiveByMahasiswaId.mockResolvedValue(null);
    BebasAsrama.create.mockResolvedValue(mockPengajuanBaru);
    BebasAsrama.findById.mockResolvedValue({ Surat_id: 1 }); // Default untuk delete/get
    
    BebasAsrama.findByIdWithMahasiswa.mockResolvedValue({ 
      mahasiswa: { 
        nim: '12345', 
        nama: 'Test User', 
        jurusan: 'Sistem Informasi' 
      }, 
      nomor_pengajuan: 'SB-123' 
    });

    ejs.renderFile.mockResolvedValue('<html>konten ejs</html>');
    Pembayaran.findByMahasiswaId.mockResolvedValue([{ id: 1 }]);
    BebasAsrama.findByMahasiswaId.mockResolvedValue([{ id: 1 }]);
    // --- Akhir Mock Default ---

    // Buat mock req
    mockRequest = {
      user: { user_id: 'user-1', mahasiswa_id: 1 },
      params: {}, body: {}, session: {},
    };
    
    // Buat mock res
    mockResponse = {
      render: jest.fn(),
      redirect: jest.fn(),
      json: jest.fn(),
      status: jest.fn(() => mockResponse),
      setHeader: jest.fn(),
      pipe: jest.fn(),
    };

    // Buat mock next
    nextFunction = jest.fn();

    // Mock implementasi PDFKit
    const mockPdfDoc = {
      font: jest.fn().mockReturnThis(),
      fontSize: jest.fn().mockReturnThis(),
      text: jest.fn().mockReturnThis(),
      moveDown: jest.fn().mockReturnThis(),
      image: jest.fn().mockReturnThis(),
      pipe: jest.fn(),
      end: jest.fn(),
      page: { width: 595.28, margins: { right: 80 } },
      y: 100
    };
    PDFDocument.mockImplementation(() => mockPdfDoc);
  });

  // ===================
  // Test: showBebasAsrama
  // ===================
  describe('showBebasAsrama', () => {
    it('Happy Path: harus me-render halaman bebas asrama jika user terotentikasi', async () => {
      await controller.showBebasAsrama(mockRequest, mockResponse);
      expect(User.findById).toHaveBeenCalledWith('user-1');
      expect(ejs.renderFile).toHaveBeenCalled();
      expect(mockResponse.render).toHaveBeenCalledWith('layouts/main', 
        expect.objectContaining({ body: '<html>konten ejs</html>' })
      );
    });

    it('Sad Path: harus redirect ke /login jika user_id tidak ada', async () => {
      mockRequest.user = null;
      mockRequest.session = null;
      await controller.showBebasAsrama(mockRequest, mockResponse);
      expect(mockResponse.redirect).toHaveBeenCalledWith('/login');
    });

    it('Error Handling: harus render halaman error jika User.findById gagal', async () => {
      User.findById.mockRejectedValue(new Error('Database connection lost'));
      await controller.showBebasAsrama(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.render).toHaveBeenCalledWith('error', { message: 'Database connection lost' });
    });
  });

  // ===================
  // Test: ajukanBebasAsrama
  // ===================
  describe('ajukanBebasAsrama', () => {
    
    it('Happy Path (Non-KIPK): harus membuat pengajuan dengan biaya default', async () => {
      await controller.ajukanBebasAsrama(mockRequest, mockResponse);
      expect(mockPrismaMahasiswaFindUnique).toHaveBeenCalledWith({ where: { mahasiswa_id: 1 }, include: { user: true } });
      expect(BebasAsrama.findActiveByMahasiswaId).toHaveBeenCalledWith(1);
      expect(BebasAsrama.create).toHaveBeenCalledWith(expect.objectContaining({
        total_biaya: 2000000,
      }));
      expect(notificationController.createNotification).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true, data: mockPengajuanBaru });
    });

    it('Happy Path (KIPK): harus membuat pengajuan dengan biaya 0', async () => {
      const mockMahasiswaKipk = { ...mockMahasiswa, kipk: 'ya' };
      mockPrismaMahasiswaFindUnique.mockResolvedValue(mockMahasiswaKipk); 
      await controller.ajukanBebasAsrama(mockRequest, mockResponse);
      expect(BebasAsrama.create).toHaveBeenCalledWith(expect.objectContaining({
        total_biaya: 0,
      }));
    });

    it('Sad Path: harus return 403 jika tidak ada mahasiswa_id di request', async () => {
      mockRequest.user.mahasiswa_id = null;
      await controller.ajukanBebasAsrama(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(BebasAsrama.create).not.toHaveBeenCalled();
    });

    it('Sad Path: harus return 404 jika mahasiswa tidak ditemukan', async () => {
      mockPrismaMahasiswaFindUnique.mockResolvedValue(null); 
      await controller.ajukanBebasAsrama(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Data mahasiswa tidak ditemukan." })
      );
    });

    it('Sad Path: harus return 409 jika sudah ada pengajuan aktif', async () => {
      BebasAsrama.findActiveByMahasiswaId.mockResolvedValue({ Surat_id: 9 });
      await controller.ajukanBebasAsrama(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(BebasAsrama.create).not.toHaveBeenCalled();
    });

    it('Error Handling: harus return 500 jika BebasAsrama.create gagal', async () => {
      BebasAsrama.create.mockRejectedValue(new Error('Gagal create'));
      await controller.ajukanBebasAsrama(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  // ===================
  // Test: getStatusBebasAsrama
  // ===================
  describe('getStatusBebasAsrama', () => {
    it('Happy Path: harus return data pengajuan jika ditemukan', async () => {
      mockRequest.params.id = '1';
      await controller.getStatusBebasAsrama(mockRequest, mockResponse);
      expect(BebasAsrama.findById).toHaveBeenCalledWith('1');
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true, data: { Surat_id: 1 } });
    });

    it('Sad Path: harus return 404 jika pengajuan tidak ditemukan', async () => {
      mockRequest.params.id = '999';
      BebasAsrama.findById.mockResolvedValue(null);
      await controller.getStatusBebasAsrama(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  // ===================
  // Test: deleteBebasAsrama
  // ===================
  describe('deleteBebasAsrama', () => {
    
    it('Happy Path: harus return sukses jika penghapusan berhasil', async () => {
      mockRequest.params.id = '1';
      BebasAsrama.findByIdAndDelete.mockResolvedValue({ count: 1 }); 
      await controller.deleteBebasAsrama(mockRequest, mockResponse);
      expect(BebasAsrama.findById).toHaveBeenCalledWith('1');
      expect(BebasAsrama.findByIdAndDelete).toHaveBeenCalledWith('1');
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true, message: "Pengajuan dihapus" });
    });

    it('Sad Path: harus return 404 jika ID tidak ditemukan (setelah perbaikan)', async () => {
      mockRequest.params.id = '999';
      BebasAsrama.findById.mockResolvedValue(null); 
      BebasAsrama.findByIdAndDelete.mockResolvedValue({}); 
      await controller.deleteBebasAsrama(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(BebasAsrama.findByIdAndDelete).not.toHaveBeenCalled();
    });
  });
  
  // ===================
  // Test: downloadSurat
  // ===================
  describe('downloadSurat', () => {
    it('Happy Path: harus men-stream PDF jika data ditemukan', async () => {
      mockRequest.params.id = '1';
      await controller.downloadSurat(mockRequest, mockResponse);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('surat_bebas_asrama_12345.pdf'));
      const mockPdfDocInstance = PDFDocument.mock.results[0].value;
      expect(mockPdfDocInstance.pipe).toHaveBeenCalledWith(mockResponse);
      expect(mockPdfDocInstance.text).toHaveBeenCalledWith(
        expect.stringContaining('SURAT KETERANGAN BEBAS ASRAMA'), 
        expect.anything() // <-- TAMBAHKAN INI
      );
      expect(mockPdfDocInstance.end).toHaveBeenCalled();
    });

    it('Sad Path: harus return 404 jika data tidak ditemukan', async () => {
      mockRequest.params.id = '999';
      BebasAsrama.findByIdWithMahasiswa.mockResolvedValue(null);
      await controller.downloadSurat(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(PDFDocument).not.toHaveBeenCalled();
    });
  });

  // ===================
  // Test: getTagihanMahasiswa
  // ===================
  describe('getTagihanMahasiswa', () => {
    it('Happy Path: harus return data tagihan jika ditemukan', async () => {
      mockRequest.params.id = '1';
      await controller.getTagihanMahasiswa(mockRequest, mockResponse);
      expect(Pembayaran.findByMahasiswaId).toHaveBeenCalledWith('1');
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true, data: [{ id: 1 }] });
    });

    it('Sad Path: harus return 404 jika tidak ada tagihan ditemukan (array kosong)', async () => {
      mockRequest.params.id = '1';
      Pembayaran.findByMahasiswaId.mockResolvedValue([]);
      await controller.getTagihanMahasiswa(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  // ===================
  // Test: getRiwayatPengajuan
  // ===================
  describe('getRiwayatPengajuan', () => {
    it('Happy Path: harus return data riwayat jika ditemukan', async () => {
      mockRequest.params.id = '1';
      await controller.getRiwayatPengajuan(mockRequest, mockResponse);
      expect(BebasAsrama.findByMahasiswaId).toHaveBeenCalledWith('1');
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true, data: [{ id: 1 }] });
    });

    it('Happy Path: harus return array kosong jika tidak ada riwayat', async () => {
      mockRequest.params.id = '1';
      BebasAsrama.findByMahasiswaId.mockResolvedValue(null);
      await controller.getRiwayatPengajuan(mockRequest, mockResponse);
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true, data: [] });
    });
  });

  // ===================
  // Test: checkActiveSubmission
  // ===================
  describe('checkActiveSubmission', () => {
    it('Happy Path: harus return hasActive: true jika ada pengajuan aktif', async () => {
      mockRequest.params.id = '1';
      BebasAsrama.findActiveByMahasiswaId.mockResolvedValue({ id: 1 }); // Override default (null)
      await controller.checkActiveSubmission(mockRequest, mockResponse);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        hasActive: true
      }));
    });

    it('Happy Path: harus return hasActive: false jika tidak ada pengajuan aktif', async () => {
      mockRequest.params.id = '1';

      await controller.checkActiveSubmission(mockRequest, mockResponse);
      expect(mockResponse.json).toHaveBeenCalledWith({ hasActive: false });
    });
  });
});