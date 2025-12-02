// 1. Deklarasi Mock
const mockUserFindById = jest.fn();
const mockPembayaranFindById = jest.fn();
const mockPembayaranFindByIdAndUpdate = jest.fn();
const mockPembayaranFindAll = jest.fn();
const mockPembayaranUpdateStatusBySuratId = jest.fn();
const mockPembayaranResetPaymentStatusBySuratId = jest.fn();
const mockBebasAsramaUpdateStatus = jest.fn();
const mockBebasAsramaFindById = jest.fn();

// 2. Mock Modules
jest.mock('../../models/userModels', () => ({ findById: mockUserFindById }));
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
jest.mock('ejs', () => ({ renderFile: jest.fn().mockResolvedValue('html') }));
jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn().mockImplementation(() => ({})) }));

const controller = require('../../controller/conPbyr');
const ejs = require('ejs');

describe('Unit Test: controller/conPbyr.js', () => {
  let mockRequest, mockResponse;
  
  const mockUser = { user_id: 'mhs-1', name: 'Test', role: 'mahasiswa' };
  const mockPengajuan = { Surat_id: 1, pembayaran: [{ id: 10, amount: 2000000 }] };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default Happy Path
    mockUserFindById.mockResolvedValue(mockUser);
    mockBebasAsramaFindById.mockResolvedValue(mockPengajuan);
    mockBebasAsramaUpdateStatus.mockResolvedValue({});
    
    mockPembayaranFindById.mockResolvedValue({ id: 1, surat_id: 1 });
    mockPembayaranFindByIdAndUpdate.mockResolvedValue({ id: 1, surat_id: 1 });
    mockPembayaranFindAll.mockResolvedValue([{ id: 1 }]);
    mockPembayaranUpdateStatusBySuratId.mockResolvedValue({});
    mockPembayaranResetPaymentStatusBySuratId.mockResolvedValue({});
    
    ejs.renderFile.mockResolvedValue('html');
    
    mockRequest = { params: {}, body: {}, file: { path: 'a.jpg' }, user: { user_id: 'u1' } };
    mockResponse = { render: jest.fn(), redirect: jest.fn(), json: jest.fn(), status: jest.fn(() => mockResponse) };
  });

  // --- Show ---
  describe('showPembayaran', () => {
    it('Happy Path', async () => {
      mockRequest.params.id = '1';
      await controller.showPembayaran(mockRequest, mockResponse);
      
      expect(ejs.renderFile).toHaveBeenCalledWith(
        expect.stringMatching(/[\\\/]views[\\\/]mahasiswa[\\\/]pembayaran\.ejs$/),
        expect.objectContaining({ pengajuan: mockPengajuan, user: mockUser })
      );
      expect(mockResponse.render).toHaveBeenCalledWith('layouts/main', expect.anything());
    });

    it('Sad Path: No ID', async () => {
        mockRequest.params.id = null;
        await controller.showPembayaran(mockRequest, mockResponse);
        expect(mockResponse.redirect).toHaveBeenCalledWith('/mahasiswa/bebas-asrama');
    });

    it('Sad Path: Not Found', async () => {
      mockRequest.params.id = '999';
      mockBebasAsramaFindById.mockResolvedValue(null);
      await controller.showPembayaran(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.render).toHaveBeenCalledWith('error', expect.objectContaining({ message: expect.stringContaining("tidak ditemukan") }));
    });

    it('Sad Path: No Payment Rec', async () => {
        mockBebasAsramaFindById.mockResolvedValue({ pembayaran: [] });
        mockRequest.params.id = '1';
        await controller.showPembayaran(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.render).toHaveBeenCalledWith('error', expect.objectContaining({ message: expect.stringContaining("Data pembayaran tidak ditemukan") }));
    });

    it('Error Handling', async () => {
        mockBebasAsramaFindById.mockRejectedValue(new Error('Fail'));
        mockRequest.params.id = '1';
        await controller.showPembayaran(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.render).toHaveBeenCalledWith('error', expect.anything());
    });
  });

  // --- Upload ---
  describe('uploadBuktiPembayaran', () => {
    it('Happy Path', async () => {
      mockRequest.body.id = '1';
      await controller.uploadBuktiPembayaran(mockRequest, mockResponse);
      expect(mockPembayaranFindByIdAndUpdate).toHaveBeenCalled();
      expect(mockBebasAsramaUpdateStatus).toHaveBeenCalledWith(1, "VERIFIKASI_PEMBAYARAN");
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('Happy Path: Upload Sukses tapi Tidak Update Status Surat (No Surat ID)', async () => {
        mockRequest.body.id = '1';
        mockPembayaranFindById.mockResolvedValue({ id: 1 });
        mockPembayaranFindByIdAndUpdate.mockResolvedValue({ id: 1, surat_id: null });
        
        await controller.uploadBuktiPembayaran(mockRequest, mockResponse);
        
        expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        expect(mockBebasAsramaUpdateStatus).not.toHaveBeenCalled();
    });

    it('Sad Path: No File', async () => {
      mockRequest.file = null;
      await controller.uploadBuktiPembayaran(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('Sad Path: Not Found (Create)', async () => {
        mockPembayaranFindById.mockResolvedValue(null);
        mockRequest.body.id = '99';
        await controller.uploadBuktiPembayaran(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("tidak ditemukan") }));
    });
    
    it('Error Handling', async () => {
        mockPembayaranFindById.mockRejectedValue(new Error('Fail'));
        mockRequest.body.id = '1';
        await controller.uploadBuktiPembayaran(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("Gagal upload") }));
    });
  });

  // --- Detail ---
  describe('getDetailPembayaran', () => {
      it('Happy Path', async () => { 
          await controller.getDetailPembayaran(mockRequest, mockResponse); 
          expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true })); 
      });
      
      it('Sad Path', async () => { 
          mockPembayaranFindById.mockResolvedValue(null); 
          await controller.getDetailPembayaran(mockRequest, mockResponse); 
          expect(mockResponse.status).toHaveBeenCalledWith(404); 
          expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Data tidak ditemukan" }));
      });

      it('Error', async () => { 
          mockPembayaranFindById.mockRejectedValue(new Error()); 
          await controller.getDetailPembayaran(mockRequest, mockResponse); 
          expect(mockResponse.status).toHaveBeenCalledWith(500); 
      });
  });

  // --- Approve ---
  describe('approvePembayaran', () => {
    it('Happy Path', async () => {
      mockRequest.params.id = '1';
      await controller.approvePembayaran(mockRequest, mockResponse);
      expect(mockPembayaranUpdateStatusBySuratId).toHaveBeenCalledWith('1', 'VALID');
      expect(mockBebasAsramaUpdateStatus).toHaveBeenCalledWith('1', 'SELESAI');
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('Error Handling', async () => {
      mockRequest.params.id = '1';
      mockPembayaranUpdateStatusBySuratId.mockRejectedValue(new Error('Fail'));
      await controller.approvePembayaran(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  // --- Reject ---
  describe('rejectPembayaran', () => {
    it('Happy Path', async () => {
      mockRequest.params.id = '1';
      await controller.rejectPembayaran(mockRequest, mockResponse);
      expect(mockPembayaranResetPaymentStatusBySuratId).toHaveBeenCalledWith('1');
      expect(mockBebasAsramaUpdateStatus).toHaveBeenCalledWith('1', 'MENUNGGU_PEMBAYARAN');
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('Error Handling', async () => {
        mockPembayaranResetPaymentStatusBySuratId.mockRejectedValue(new Error());
        await controller.rejectPembayaran(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  // --- Reupload ---
  describe('reuploadBuktiPembayaran', () => {
    it('Happy Path', async () => {
      mockRequest.params.id = '1';
      await controller.reuploadBuktiPembayaran(mockRequest, mockResponse);
      expect(mockPembayaranFindByIdAndUpdate).toHaveBeenCalled();
      expect(mockBebasAsramaUpdateStatus).toHaveBeenCalledWith(1, "VERIFIKASI_PEMBAYARAN");
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
    
    it('Happy Path: No Surat ID', async () => {
        mockPembayaranFindByIdAndUpdate.mockResolvedValue({ id: 1, surat_id: null });
        mockRequest.params.id = '1';
        await controller.reuploadBuktiPembayaran(mockRequest, mockResponse);
        expect(mockBebasAsramaUpdateStatus).not.toHaveBeenCalled();
    });

    it('Sad Path: No File', async () => {
        mockRequest.file = null;
        await controller.reuploadBuktiPembayaran(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: "File tidak ditemukan" }));
    });

    it('Sad Path: Not Found', async () => {
        mockPembayaranFindByIdAndUpdate.mockResolvedValue(null);
        mockRequest.params.id = '1';
        await controller.reuploadBuktiPembayaran(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
    
    it('Error Handling', async () => {
        mockPembayaranFindByIdAndUpdate.mockRejectedValue(new Error());
        await controller.reuploadBuktiPembayaran(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  // --- Admin Get All ---
  describe('getAllPembayaran', () => {
      it('Happy Path', async () => { 
          await controller.getAllPembayaran(mockRequest, mockResponse); 
          expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: expect.any(Array) })); 
      });

      it('Error', async () => { 
          mockPembayaranFindAll.mockRejectedValue(new Error()); 
          await controller.getAllPembayaran(mockRequest, mockResponse); 
          expect(mockResponse.status).toHaveBeenCalledWith(500); 
      });
  });

  // --- Update (Redundant) ---
  describe('updatePembayaran', () => {
    it('Happy Path', async () => {
        mockRequest.params.id = '10';
        await controller.updatePembayaran(mockRequest, mockResponse);
        expect(mockPembayaranFindByIdAndUpdate).toHaveBeenCalled();
        expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
    
    it('Happy Path: No File', async () => {
        mockRequest.params.id = '10';
        mockRequest.file = null; 
        await controller.updatePembayaran(mockRequest, mockResponse);
        expect(mockPembayaranFindByIdAndUpdate).toHaveBeenCalledWith(
            '10', 
            expect.objectContaining({ bukti_pembayaran: null }), 
            expect.anything()
        );
    });

    it('Error', async () => {
        mockPembayaranFindByIdAndUpdate.mockRejectedValue(new Error());
        await controller.updatePembayaran(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });
});