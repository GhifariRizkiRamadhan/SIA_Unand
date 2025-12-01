// tests/unit/conPbyr.test.js
const mockUserFindById = jest.fn();
const mockPembayaranFindById = jest.fn();
const mockPembayaranFindByIdAndUpdate = jest.fn();
const mockPembayaranFindAll = jest.fn();
const mockPembayaranUpdateStatusBySuratId = jest.fn();
const mockPembayaranResetPaymentStatusBySuratId = jest.fn();
const mockBebasAsramaUpdateStatus = jest.fn();
const mockBebasAsramaFindById = jest.fn();

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
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserFindById.mockResolvedValue({ user_id: 1 });
    mockBebasAsramaFindById.mockResolvedValue({ Surat_id: 1, pembayaran: [{}] });
    mockPembayaranFindById.mockResolvedValue({ id: 1, surat_id: 1 });
    mockPembayaranFindByIdAndUpdate.mockResolvedValue({ id: 1, surat_id: 1 });
    mockPembayaranFindAll.mockResolvedValue([]);
    
    mockRequest = { params: {}, body: {}, file: { path: 'a.jpg' }, user: { user_id: 1 } };
    mockResponse = { render: jest.fn(), redirect: jest.fn(), json: jest.fn(), status: jest.fn(() => mockResponse) };
  });

  // --- Show ---
  it('showPembayaran: Happy', async () => { mockRequest.params.id = '1'; await controller.showPembayaran(mockRequest, mockResponse); });
  it('showPembayaran: No ID', async () => { mockRequest.params.id = null; await controller.showPembayaran(mockRequest, mockResponse); expect(mockResponse.redirect).toHaveBeenCalled(); });
  it('showPembayaran: Not Found', async () => { mockBebasAsramaFindById.mockResolvedValue(null); mockRequest.params.id = '1'; await controller.showPembayaran(mockRequest, mockResponse); });
  it('showPembayaran: No Payment Rec', async () => { mockBebasAsramaFindById.mockResolvedValue({ pembayaran: [] }); mockRequest.params.id = '1'; await controller.showPembayaran(mockRequest, mockResponse); });
  it('showPembayaran: Error', async () => { mockBebasAsramaFindById.mockRejectedValue(new Error()); await controller.showPembayaran(mockRequest, mockResponse); });

  // --- Upload ---
  it('uploadBuktiPembayaran: Happy', async () => { mockRequest.body.id = '1'; await controller.uploadBuktiPembayaran(mockRequest, mockResponse); });
  it('uploadBuktiPembayaran: No File', async () => { mockRequest.file = null; await controller.uploadBuktiPembayaran(mockRequest, mockResponse); expect(mockResponse.status).toHaveBeenCalledWith(400); });
  it('uploadBuktiPembayaran: Not Found', async () => { mockPembayaranFindById.mockResolvedValue(null); mockRequest.body.id = '99'; await controller.uploadBuktiPembayaran(mockRequest, mockResponse); expect(mockResponse.status).toHaveBeenCalledWith(404); });
  it('uploadBuktiPembayaran: Error', async () => { mockPembayaranFindById.mockRejectedValue(new Error()); await controller.uploadBuktiPembayaran(mockRequest, mockResponse); });

  // --- Detail ---
  it('getDetailPembayaran: Happy', async () => { await controller.getDetailPembayaran(mockRequest, mockResponse); });
  it('getDetailPembayaran: Not Found', async () => { mockPembayaranFindById.mockResolvedValue(null); await controller.getDetailPembayaran(mockRequest, mockResponse); });
  it('getDetailPembayaran: Error', async () => { mockPembayaranFindById.mockRejectedValue(new Error()); await controller.getDetailPembayaran(mockRequest, mockResponse); });

  // --- Update ---
  it('updatePembayaran: Happy', async () => { await controller.updatePembayaran(mockRequest, mockResponse); });
  it('updatePembayaran: Error', async () => { mockPembayaranFindByIdAndUpdate.mockRejectedValue(new Error()); await controller.updatePembayaran(mockRequest, mockResponse); });

  // --- Reupload ---
  it('reuploadBuktiPembayaran: Happy', async () => { mockRequest.params.id = '1'; await controller.reuploadBuktiPembayaran(mockRequest, mockResponse); });
  it('reuploadBuktiPembayaran: No File', async () => { mockRequest.file = null; await controller.reuploadBuktiPembayaran(mockRequest, mockResponse); });
  it('reuploadBuktiPembayaran: Not Found', async () => { mockPembayaranFindByIdAndUpdate.mockResolvedValue(null); mockRequest.params.id = '1'; await controller.reuploadBuktiPembayaran(mockRequest, mockResponse); });
  it('reuploadBuktiPembayaran: Error', async () => { mockPembayaranFindByIdAndUpdate.mockRejectedValue(new Error()); await controller.reuploadBuktiPembayaran(mockRequest, mockResponse); });

  // --- Admin ---
  it('getAllPembayaran: Happy', async () => { await controller.getAllPembayaran(mockRequest, mockResponse); });
  it('getAllPembayaran: Error', async () => { mockPembayaranFindAll.mockRejectedValue(new Error()); await controller.getAllPembayaran(mockRequest, mockResponse); });

  it('approvePembayaran: Happy', async () => { await controller.approvePembayaran(mockRequest, mockResponse); });
  it('approvePembayaran: Error', async () => { mockPembayaranUpdateStatusBySuratId.mockRejectedValue(new Error()); await controller.approvePembayaran(mockRequest, mockResponse); });

  it('rejectPembayaran: Happy', async () => { await controller.rejectPembayaran(mockRequest, mockResponse); });
  it('rejectPembayaran: Error', async () => { mockPembayaranResetPaymentStatusBySuratId.mockRejectedValue(new Error()); await controller.rejectPembayaran(mockRequest, mockResponse); });
});