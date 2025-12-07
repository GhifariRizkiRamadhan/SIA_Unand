const mockPrismaSuratFindUnique = jest.fn();
const mockPrismaSuratUpdate = jest.fn();
const mockPrismaPembayaranFindUnique = jest.fn();
const mockPrismaPembayaranUpdate = jest.fn();
const mockPrismaPembayaranFindMany = jest.fn();
const mockPrismaPembayaranUpdateMany = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    suratbebasasrama: {
      findUnique: mockPrismaSuratFindUnique,
      update: mockPrismaSuratUpdate,
    },
    pembayaran: {
      findUnique: mockPrismaPembayaranFindUnique,
      update: mockPrismaPembayaranUpdate,
      findMany: mockPrismaPembayaranFindMany,
      updateMany: mockPrismaPembayaranUpdateMany,
    }
  })),
}));

jest.mock('../../models/userModels', () => ({
  findById: jest.fn().mockResolvedValue({ user_id: 'mhs-1', name: 'Test', role: 'mahasiswa' })
}));

jest.mock('ejs', () => ({ renderFile: jest.fn().mockResolvedValue('html') }));

const controller = require('../../controller/conPbyr');
const ejs = require('ejs');

describe('Unit Test: controller/conPbyr.js', () => {
  let mockRequest, mockResponse;

  const mockUser = { user_id: 'mhs-1', name: 'Test', role: 'mahasiswa' };
  const mockPengajuan = {
    Surat_id: 1,
    pembayaran: [{ id: 10, amount: 2000000 }],
    mahasiswa: { user: mockUser }
  };
  const mockPembayaran = { pembayaran_id: 1, surat_id: 1, mahasiswa: {}, suratbebasasrama: {} };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default Happy Path
    mockPrismaSuratFindUnique.mockResolvedValue(mockPengajuan);
    mockPrismaSuratUpdate.mockResolvedValue({});

    mockPrismaPembayaranFindUnique.mockResolvedValue(mockPembayaran);
    mockPrismaPembayaranUpdate.mockResolvedValue({ ...mockPembayaran, status_bukti: 'BELUM_DIVERIFIKASI' });
    mockPrismaPembayaranFindMany.mockResolvedValue([mockPembayaran]);
    mockPrismaPembayaranUpdateMany.mockResolvedValue({ count: 1 });

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
        expect.objectContaining({ pengajuan: mockPengajuan })
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
      mockPrismaSuratFindUnique.mockResolvedValue(null);
      await controller.showPembayaran(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.render).toHaveBeenCalledWith('error', expect.objectContaining({ message: expect.stringContaining("tidak ditemukan") }));
    });

    it('Sad Path: No Payment Record', async () => {
      mockRequest.params.id = '1';
      mockPrismaSuratFindUnique.mockResolvedValue({ ...mockPengajuan, pembayaran: [] });
      await controller.showPembayaran(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.render).toHaveBeenCalledWith('error', expect.objectContaining({ message: expect.stringContaining("Data pembayaran tidak ditemukan") }));
    });

    it('Sad Path: Invalid ID', async () => {
      mockRequest.params.id = 'abc';
      await controller.showPembayaran(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('Error Handling', async () => {
      mockPrismaSuratFindUnique.mockRejectedValue(new Error('Fail'));
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
      expect(mockPrismaPembayaranUpdate).toHaveBeenCalled();
      expect(mockPrismaSuratUpdate).toHaveBeenCalledWith(expect.objectContaining({
        where: { Surat_id: 1 },
        data: { status_pengajuan: "VERIFIKASI_PEMBAYARAN" }
      }));
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('Happy Path: Upload Sukses tapi Tidak Update Status Surat (No Surat ID)', async () => {
      mockRequest.body.id = '1';
      mockPrismaPembayaranFindUnique.mockResolvedValue({ pembayaran_id: 1, surat_id: null });
      mockPrismaPembayaranUpdate.mockResolvedValue({ pembayaran_id: 1, surat_id: null });

      await controller.uploadBuktiPembayaran(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
      expect(mockPrismaSuratUpdate).not.toHaveBeenCalled();
    });

    it('Happy Path: Upload Sukses tapi Surat ID Invalid', async () => {
      mockRequest.body.id = '1';
      mockPrismaPembayaranFindUnique.mockResolvedValue({ pembayaran_id: 1, surat_id: 'abc' });
      mockPrismaPembayaranUpdate.mockResolvedValue({ pembayaran_id: 1, surat_id: 'abc' });

      await controller.uploadBuktiPembayaran(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
      expect(mockPrismaSuratUpdate).not.toHaveBeenCalled();
    });

    it('Sad Path: No File', async () => {
      mockRequest.file = null;
      await controller.uploadBuktiPembayaran(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('Sad Path: Invalid ID', async () => {
      mockRequest.body.id = 'abc';
      await controller.uploadBuktiPembayaran(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('Sad Path: Payment Not Found', async () => {
      mockRequest.body.id = '99';
      mockPrismaPembayaranFindUnique.mockResolvedValue(null);
      await controller.uploadBuktiPembayaran(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Data pembayaran tidak ditemukan" }));
    });

    it('Error Handling', async () => {
      mockPrismaPembayaranFindUnique.mockRejectedValue(new Error('Fail'));
      mockRequest.body.id = '1';
      await controller.uploadBuktiPembayaran(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("Gagal upload") }));
    });
  });

  // --- Detail ---
  describe('getDetailPembayaran', () => {
    it('Happy Path', async () => {
      mockRequest.params.id = '1';
      await controller.getDetailPembayaran(mockRequest, mockResponse);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('Sad Path', async () => {
      mockRequest.params.id = '1';
      mockPrismaPembayaranFindUnique.mockResolvedValue(null);
      await controller.getDetailPembayaran(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Data tidak ditemukan" }));
    });

    it('Sad Path: Invalid ID', async () => {
      mockRequest.params.id = 'abc';
      await controller.getDetailPembayaran(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('Error', async () => {
      mockRequest.params.id = '1';
      mockPrismaPembayaranFindUnique.mockRejectedValue(new Error());
      await controller.getDetailPembayaran(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  // --- Approve ---
  describe('approvePembayaran', () => {
    it('Happy Path', async () => {
      mockRequest.params.id = '1';
      await controller.approvePembayaran(mockRequest, mockResponse);
      expect(mockPrismaPembayaranUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { surat_id: 1 },
        data: { status_bukti: 'VALID' }
      }));
      expect(mockPrismaSuratUpdate).toHaveBeenCalledWith(expect.objectContaining({
        where: { Surat_id: 1 },
        data: { status_pengajuan: 'SELESAI' }
      }));
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('Sad Path: Invalid ID', async () => {
      mockRequest.params.id = 'abc';
      await controller.approvePembayaran(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('Error Handling', async () => {
      mockRequest.params.id = '1';
      mockPrismaPembayaranUpdateMany.mockRejectedValue(new Error('Fail'));
      await controller.approvePembayaran(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  // --- Reject ---
  describe('rejectPembayaran', () => {
    it('Happy Path', async () => {
      mockRequest.params.id = '1';
      await controller.rejectPembayaran(mockRequest, mockResponse);
      expect(mockPrismaPembayaranUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { surat_id: 1 },
        data: { status_bukti: 'TIDAK_VALID', bukti_pembayaran: null }
      }));
      expect(mockPrismaSuratUpdate).toHaveBeenCalledWith(expect.objectContaining({
        where: { Surat_id: 1 },
        data: { status_pengajuan: 'MENUNGGU_PEMBAYARAN' }
      }));
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('Sad Path: Invalid ID', async () => {
      mockRequest.params.id = 'abc';
      await controller.rejectPembayaran(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('Error Handling', async () => {
      mockRequest.params.id = '1';
      mockPrismaPembayaranUpdateMany.mockRejectedValue(new Error());
      await controller.rejectPembayaran(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  // --- Reupload ---
  describe('reuploadBuktiPembayaran', () => {
    it('Happy Path', async () => {
      mockRequest.params.id = '1';
      await controller.reuploadBuktiPembayaran(mockRequest, mockResponse);
      expect(mockPrismaPembayaranUpdate).toHaveBeenCalled();
      expect(mockPrismaSuratUpdate).toHaveBeenCalledWith(expect.objectContaining({
        where: { Surat_id: 1 },
        data: { status_pengajuan: "VERIFIKASI_PEMBAYARAN" }
      }));
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('Happy Path: No Surat ID', async () => {
      mockPrismaPembayaranUpdate.mockResolvedValue({ pembayaran_id: 1, surat_id: null });
      mockRequest.params.id = '1';
      await controller.reuploadBuktiPembayaran(mockRequest, mockResponse);
      expect(mockPrismaSuratUpdate).not.toHaveBeenCalled();
    });

    it('Happy Path: Surat ID Invalid', async () => {
      mockPrismaPembayaranUpdate.mockResolvedValue({ pembayaran_id: 1, surat_id: 'abc' });
      mockRequest.params.id = '1';
      await controller.reuploadBuktiPembayaran(mockRequest, mockResponse);
      expect(mockPrismaSuratUpdate).not.toHaveBeenCalled();
    });

    it('Sad Path: No File', async () => {
      mockRequest.file = null;
      await controller.reuploadBuktiPembayaran(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: "File tidak ditemukan" }));
    });

    it('Sad Path: Invalid ID', async () => {
      mockRequest.params.id = 'abc';
      await controller.reuploadBuktiPembayaran(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('Sad Path: Payment Not Found (Update)', async () => {
      mockRequest.params.id = '99';
      mockPrismaPembayaranUpdate.mockResolvedValue(null);
      await controller.reuploadBuktiPembayaran(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Pembayaran tidak ditemukan" }));
    });

    it('Error Handling', async () => {
      mockRequest.params.id = '1';
      mockPrismaPembayaranUpdate.mockRejectedValue(new Error());
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
      mockPrismaPembayaranFindMany.mockRejectedValue(new Error());
      await controller.getAllPembayaran(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  // --- Update (Redundant) ---
  describe('updatePembayaran', () => {
    it('Happy Path', async () => {
      mockRequest.params.id = '10';
      await controller.updatePembayaran(mockRequest, mockResponse);
      expect(mockPrismaPembayaranUpdate).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('Happy Path: No File', async () => {
      mockRequest.params.id = '10';
      mockRequest.file = null;
      await controller.updatePembayaran(mockRequest, mockResponse);
      expect(mockPrismaPembayaranUpdate).toHaveBeenCalledWith(expect.objectContaining({
        where: { pembayaran_id: 10 },
        data: expect.objectContaining({ bukti_pembayaran: null })
      }));
    });

    it('Sad Path: Invalid ID', async () => {
      mockRequest.params.id = 'abc';
      await controller.updatePembayaran(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('Error', async () => {
      mockRequest.params.id = '10';
      mockPrismaPembayaranUpdate.mockRejectedValue(new Error());
      await controller.updatePembayaran(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });
});