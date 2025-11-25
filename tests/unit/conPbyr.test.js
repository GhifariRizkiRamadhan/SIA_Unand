// ==========================================================
// FILE: tests/unit/conPbyr.test.js (PERBAIKAN REFERENCE ERROR)
// ==========================================================

// 1. Deklarasikan mock di luar
const mockUserFindById = jest.fn();
const mockPembayaranFindById = jest.fn();
const mockPembayaranFindByIdAndUpdate = jest.fn();
const mockPembayaranFindAll = jest.fn();
const mockPembayaranUpdateStatusBySuratId = jest.fn();
const mockPembayaranResetPaymentStatusBySuratId = jest.fn();
const mockBebasAsramaUpdateStatus = jest.fn();
const mockBebasAsramaFindById = jest.fn();

// 2. Mock Modules
jest.mock('../../models/userModels', () => ({
  findById: mockUserFindById
}));
jest.mock('../../models/pembayaranModel', () => ({
  findById: mockPembayaranFindById,
  findByIdAndUpdate: mockPembayaranFindByIdAndUpdate,
  findAll: mockPembayaranFindAll,
  updateStatusBySuratId: mockPembayaranUpdateStatusBySuratId,
  resetPaymentStatusBySuratId: mockPembayaranResetPaymentStatusBySuratId
}));
jest.mock('../../models/bebasAsramaModel', () => ({
  findById: mockBebasAsramaFindById,
  updateStatus: mockBebasAsramaUpdateStatus
}));
jest.mock('ejs');
// Mock Prisma (walaupun hanya dipakai sedikit di file ini)
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({}))
}));

// 3. Require Controller
const controller = require('../../controller/conPbyr');
const ejs = require('ejs');

describe('Unit Test: controller/conPbyr.js', () => {
  let mockRequest;
  let mockResponse;
  
  // Data Mock Default
  const mockUser = { user_id: 'mhs-1', name: 'Test Mahasiswa', role: 'mahasiswa' };
  const mockPengajuan = { Surat_id: 1, pembayaran: [{ pembayaran_id: 10, amount: 2000000 }] };
  const mockPembayaranData = { pembayaran_id: 10, surat_id: 1, bukti_pembayaran: 'uploads/test.jpg' };

  beforeEach(() => {
    // Reset history panggilan
    jest.clearAllMocks();

    // RESET IMPLEMENTASI KE HAPPY PATH
    mockUserFindById.mockResolvedValue(mockUser);
    mockBebasAsramaFindById.mockResolvedValue(mockPengajuan);
    mockBebasAsramaUpdateStatus.mockResolvedValue({});
    
    mockPembayaranFindById.mockResolvedValue(mockPembayaranData);
    mockPembayaranFindByIdAndUpdate.mockResolvedValue(mockPembayaranData);
    mockPembayaranFindAll.mockResolvedValue([mockPembayaranData]);
    mockPembayaranUpdateStatusBySuratId.mockResolvedValue({});
    mockPembayaranResetPaymentStatusBySuratId.mockResolvedValue({});
    
    ejs.renderFile.mockResolvedValue('<html>Page</html>');

    // Mock Req & Res
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
      status: jest.fn(() => mockResponse), // Chaining
    };
  });

  // --- Show Pembayaran ---
  describe('showPembayaran', () => {
    it('Happy Path: harus me-render halaman pembayaran', async () => {
      mockRequest.params.id = '1';
      await controller.showPembayaran(mockRequest, mockResponse);

      expect(mockBebasAsramaFindById).toHaveBeenCalledWith('1');
      expect(mockUserFindById).toHaveBeenCalledWith('mhs-1');
      
      expect(ejs.renderFile).toHaveBeenCalledWith(
        expect.stringMatching(/[\\\/]views[\\\/]mahasiswa[\\\/]pembayaran\.ejs$/),
        expect.objectContaining({ 
          pengajuan: mockPengajuan,
          user: mockUser 
        })
      );
      expect(mockResponse.render).toHaveBeenCalledWith('layouts/main', expect.anything());
    });

    it('Sad Path: render 404 jika pengajuan tidak ditemukan', async () => {
      mockRequest.params.id = '999';
      mockBebasAsramaFindById.mockResolvedValue(null); // Override mock

      await controller.showPembayaran(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.render).toHaveBeenCalledWith('error', expect.objectContaining({ message: expect.stringContaining("tidak ditemukan") }));
    });
  });

  // --- Upload Bukti ---
  describe('uploadBuktiPembayaran', () => {
    it('Happy Path: upload sukses', async () => {
      mockRequest.body.id = '10';
      await controller.uploadBuktiPembayaran(mockRequest, mockResponse);

      expect(mockPembayaranFindByIdAndUpdate).toHaveBeenCalled();
      expect(mockBebasAsramaUpdateStatus).toHaveBeenCalledWith(1, "VERIFIKASI_PEMBAYARAN");
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  // --- Approve (Pengelola) ---
  describe('approvePembayaran', () => {
    it('Happy Path: setujui pembayaran', async () => {
      mockRequest.params.id = '1';
      await controller.approvePembayaran(mockRequest, mockResponse);

      expect(mockPembayaranUpdateStatusBySuratId).toHaveBeenCalledWith('1', 'VALID');
      expect(mockBebasAsramaUpdateStatus).toHaveBeenCalledWith('1', 'SELESAI');
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('Error Handling: return 500 jika DB gagal', async () => {
      mockRequest.params.id = '1';
      mockPembayaranUpdateStatusBySuratId.mockRejectedValue(new Error('DB Fail')); // Override mock

      await controller.approvePembayaran(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  // --- Reject (Pengelola) ---
  describe('rejectPembayaran', () => {
    it('Happy Path: harus reset status Pembayaran dan BebasAsrama', async () => {
      mockRequest.params.id = '1';
      await controller.rejectPembayaran(mockRequest, mockResponse);
      
      // PERBAIKAN: Gunakan variabel mock, BUKAN 'Pembayaran.reset...'
      expect(mockPembayaranResetPaymentStatusBySuratId).toHaveBeenCalledWith('1');
      // PERBAIKAN: Gunakan variabel mock, BUKAN 'BebasAsrama.update...'
      expect(mockBebasAsramaUpdateStatus).toHaveBeenCalledWith('1', 'MENUNGGU_PEMBAYARAN');
    });
  });

  // --- Update (Redundant) ---
  describe('updatePembayaran (Redundant Function)', () => {
    it('Seharusnya berfungsi, tetapi tidak digunakan oleh router', async () => {
        mockRequest.params.id = '10';
        await controller.updatePembayaran(mockRequest, mockResponse);
        
        // PERBAIKAN: Gunakan variabel mock
        expect(mockPembayaranFindByIdAndUpdate).toHaveBeenCalled();
    });
  });
});