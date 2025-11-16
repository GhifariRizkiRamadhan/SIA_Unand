// 1. Deklarasikan fungsi mock di PALING ATAS
const mockPrismaMahasiswaFindUnique = jest.fn();

// 2. PANGGIL SEMUA JEST.MOCK() SETELAH ITU
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    mahasiswa: {
      findUnique: mockPrismaMahasiswaFindUnique,
    },
  })),
}));
jest.mock('../../models/userModels');
jest.mock('../../models/pembayaranModel');
jest.mock('../../models/bebasAsramaModel');
jest.mock('ejs');

// 3. BARU REQUIRE SEMUA DEPENDENSI
const controller = require('../../controller/conPbyr');
const User = require('../../models/userModels');
const Pembayaran = require('../../models/pembayaranModel');
const BebasAsrama = require('../../models/bebasAsramaModel');
const ejs = require('ejs');

// ===================================
// START: TEST SUITES
// ===================================
describe('Unit Test: controller/conPbyr.js', () => {
  let mockRequest;
  let mockResponse;
  
  // Data mock default
  const mockUser = { user_id: 'mhs-1', name: 'Test Mahasiswa', role: 'mahasiswa' };
  const mockPengajuan = {
    Surat_id: 1,
    pembayaran: [{ pembayaran_id: 10, amount: 2000000 }]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = {
      params: {},
      body: {},
      file: { path: 'uploads/test.jpg' },
      user: { user_id: 'mhs-1' }
    };
    mockResponse = {
      render: jest.fn(),
      redirect: jest.fn(),
      json: jest.fn(),
      status: jest.fn(() => mockResponse),
    };

    // Setup mock default (Happy Path)
    BebasAsrama.findById.mockResolvedValue(mockPengajuan);
    User.findById.mockResolvedValue(mockUser);
    ejs.renderFile.mockResolvedValue('<html></html>');
    
    // Default mock untuk model Pembayaran & BebasAsrama
    Pembayaran.findById.mockResolvedValue({ pembayaran_id: 10, surat_id: 1 });
    Pembayaran.findByIdAndUpdate.mockResolvedValue({ pembayaran_id: 10, surat_id: 1 });
    BebasAsrama.updateStatus.mockResolvedValue({});
    Pembayaran.updateStatusBySuratId.mockResolvedValue({});
    Pembayaran.resetPaymentStatusBySuratId.mockResolvedValue({});
  });

  // =
  // Test: showPembayaran
  // =
  describe('showPembayaran', () => {
    
    // ==========================================================
    //Tes 'showPembayaran' Happy Path
    // ==========================================================
    it('Happy Path: harus me-render halaman pembayaran', async () => {
      mockRequest.params.id = '1';
      await controller.showPembayaran(mockRequest, mockResponse);

      // Verifikasi data diambil
      expect(BebasAsrama.findById).toHaveBeenCalledWith('1');
      expect(User.findById).toHaveBeenCalledWith('mhs-1');
      
      // Verifikasi ejs.renderFile dipanggil
      expect(ejs.renderFile).toHaveBeenCalled();

      // Verifikasi argumen panggilan secara terpisah
      const renderArgs = ejs.renderFile.mock.calls[0][1];
      expect(renderArgs.pengajuan).toEqual(mockPengajuan);
      expect(renderArgs.user).toEqual(mockUser);
      expect(ejs.renderFile.mock.calls[0][0]).toEqual(
        expect.stringMatching(/[\\\/]mahasiswa[\\\/]pembayaran\.ejs$/)
        );
      
      // Verifikasi render akhir
      expect(mockResponse.render).toHaveBeenCalledWith('layouts/main', expect.anything());
    });
    // ==========================================================

    it('Sad Path (Validasi Bug Fix): harus render 404 jika pengajuan tidak ditemukan', async () => {
      mockRequest.params.id = '999';
      BebasAsrama.findById.mockResolvedValue(null); 
      await controller.showPembayaran(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.render).toHaveBeenCalledWith('error', { message: "Data pengajuan tidak ditemukan." });
      expect(User.findById).not.toHaveBeenCalled();
    });

    it('Sad Path: harus render 500 jika pengajuan ada tapi record pembayaran tidak ada', async () => {
      mockRequest.params.id = '1';
      BebasAsrama.findById.mockResolvedValue({ Surat_id: 1, pembayaran: [] });
      await controller.showPembayaran(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  // =
  // Test: uploadBuktiPembayaran
  // =
  describe('uploadBuktiPembayaran', () => {
    it('Happy Path: harus update pembayaran dan status surat', async () => {
      mockRequest.body.id = '10';
      
      await controller.uploadBuktiPembayaran(mockRequest, mockResponse);

      expect(Pembayaran.findByIdAndUpdate).toHaveBeenCalledWith(
        '10',
        { bukti_pembayaran: 'uploads/test.jpg', status_bukti: "BELUM_DIVERIFIKASI" },
        { new: true }
      );
      expect(BebasAsrama.updateStatus).toHaveBeenCalledWith(1, "VERIFIKASI_PEMBAYARAN");
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('Sad Path: harus return 400 jika tidak ada file', async () => {
      mockRequest.file = null; 
      await controller.uploadBuktiPembayaran(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('Sad Path: harus return 404 jika ID pembayaran tidak ditemukan', async () => {
      mockRequest.body.id = '999';
      Pembayaran.findById.mockResolvedValue(null); 
      await controller.uploadBuktiPembayaran(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  // =
  // Test: reuploadBuktiPembayaran
  // =
  describe('reuploadBuktiPembayaran', () => {
    it('Happy Path: harus update pembayaran dan status surat', async () => {
      mockRequest.params.id = '10';
      await controller.reuploadBuktiPembayaran(mockRequest, mockResponse);
      expect(Pembayaran.findByIdAndUpdate).toHaveBeenCalled();
      expect(BebasAsrama.updateStatus).toHaveBeenCalledWith(1, "VERIFIKASI_PEMBAYARAN");
    });

    it('Sad Path: harus return 404 jika ID pembayaran tidak ditemukan', async () => {
      mockRequest.params.id = '999';
      Pembayaran.findByIdAndUpdate.mockResolvedValue(null); 
      await controller.reuploadBuktiPembayaran(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  // =
  // Test: approvePembayaran (Pengelola)
  // =
  describe('approvePembayaran', () => {
    it('Happy Path: harus update status Pembayaran dan BebasAsrama', async () => {
      mockRequest.params.id = '1'; 
      await controller.approvePembayaran(mockRequest, mockResponse);
      expect(Pembayaran.updateStatusBySuratId).toHaveBeenCalledWith('1', 'VALID');
      expect(BebasAsrama.updateStatus).toHaveBeenCalledWith('1', 'SELESAI');
    });

    it('Error Handling: harus return 500 jika gagal', async () => {
      mockRequest.params.id = '1';
      Pembayaran.updateStatusBySuratId.mockRejectedValue(new Error('DB Fail')); 
      await controller.approvePembayaran(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  // =
  // Test: rejectPembayaran (Pengelola)
  // =
  describe('rejectPembayaran', () => {
    it('Happy Path: harus reset status Pembayaran dan BebasAsrama', async () => {
      mockRequest.params.id = '1'; 
      await controller.rejectPembayaran(mockRequest, mockResponse);
      expect(Pembayaran.resetPaymentStatusBySuratId).toHaveBeenCalledWith('1');
      expect(BebasAsrama.updateStatus).toHaveBeenCalledWith('1', 'MENUNGGU_PEMBAYARAN');
    });
  });
  
  // Tes untuk fungsi yang tidak terpakai/redundant
  describe('updatePembayaran (Redundant Function)', () => {
    it('Seharusnya berfungsi, tetapi tidak digunakan oleh router', async () => {
        mockRequest.params.id = '10';
        await controller.updatePembayaran(mockRequest, mockResponse);
        expect(Pembayaran.findByIdAndUpdate).toHaveBeenCalled();
    });
  });
});