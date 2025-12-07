// ==========================================================
// FILE: tests/unit/conBbsAsrPnl.test.js
// ==========================================================

const mockPrismaTransaction = jest.fn();
const mockPrismaSuratFindUnique = jest.fn();
const mockPrismaSuratUpdate = jest.fn();
const mockPrismaKerusakanDeleteMany = jest.fn();
const mockPrismaKerusakanCreateMany = jest.fn();
const mockPrismaPembayaranCreate = jest.fn();
const mockPrismaMahasiswaFindUnique = jest.fn();
const mockPrismaSuratFindMany = jest.fn();
const mockCreateNotification = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    suratbebasasrama: {
      findUnique: mockPrismaSuratFindUnique,
      update: mockPrismaSuratUpdate,
      findMany: mockPrismaSuratFindMany,
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
    $transaction: jest.fn(async (callback) => {
      mockPrismaTransaction();
      const mockTx = {
        suratbebasasrama: { update: mockPrismaSuratUpdate },
        kerusakanFasilitas: {
          deleteMany: mockPrismaKerusakanDeleteMany,
          createMany: mockPrismaKerusakanCreateMany
        },
        pembayaran: { create: mockPrismaPembayaranCreate },
        mahasiswa: { findUnique: mockPrismaMahasiswaFindUnique },
      };
      return await callback(mockTx);
    }),
  })),
}));

jest.mock('../../models/userModels', () => ({
  findById: jest.fn().mockResolvedValue({ name: 'Admin', role: 'pengelola' })
}));

jest.mock('../../controller/notification', () => ({
  createNotification: mockCreateNotification
}));
jest.mock('ejs', () => ({
  renderFile: jest.fn().mockResolvedValue('<html></html>')
}));
jest.mock('fs', () => ({
  existsSync: jest.fn(),
}));

const controller = require('../../controller/conBbsAsrPnl');
const User = require('../../models/userModels');

describe('Unit Test: controller/conBbsAsrPnl.js', () => {
  let mockRequest;
  let mockResponse;

  const mockPengajuan = {
    Surat_id: 1,
    mahasiswa_id: 10,
    mahasiswa: { kipk: 'tidak', user: { user_id: 'user-mhs-1' } },
    pembayaran: [{ bukti_pembayaran: 'uploads/bukti.jpg' }]
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default Happy Path Mocks
    mockPrismaSuratFindUnique.mockResolvedValue(mockPengajuan);
    mockPrismaSuratUpdate.mockResolvedValue({ ...mockPengajuan, status_pengajuan: 'MENUNGGU_PEMBAYARAN', total_biaya: 2000000 });
    mockPrismaMahasiswaFindUnique.mockResolvedValue(mockPengajuan.mahasiswa);
    mockPrismaSuratFindMany.mockResolvedValue([]);

    mockPrismaKerusakanDeleteMany.mockResolvedValue({ count: 1 });
    mockPrismaKerusakanCreateMany.mockResolvedValue({ count: 1 });
    mockPrismaPembayaranCreate.mockResolvedValue({ id: 100 });
    mockCreateNotification.mockResolvedValue({});

    mockRequest = {
      params: {},
      body: {},
      user: { user_id: 'pengelola-1' },
      session: { user_id: 'pengelola-1' }
    };
    mockResponse = {
      render: jest.fn(),
      redirect: jest.fn(),
      json: jest.fn(),
      status: jest.fn(() => mockResponse),
      sendFile: jest.fn((path, cb) => cb && cb()),
    };
  });

  // --- Show Page ---
  it('showBebasAsramaPengelola: Happy', async () => {
    await controller.showBebasAsramaPengelola(mockRequest, mockResponse);
    expect(mockResponse.render).toHaveBeenCalledWith('layouts/main', expect.anything());
  });

  it('showBebasAsramaPengelola: No Auth', async () => {
    mockRequest.user = null;
    mockRequest.session = null;
    await controller.showBebasAsramaPengelola(mockRequest, mockResponse);
    expect(mockResponse.redirect).toHaveBeenCalledWith('/login');
  });

  it('showBebasAsramaPengelola: Error', async () => {
    User.findById.mockRejectedValue(new Error('Fail'));
    await controller.showBebasAsramaPengelola(mockRequest, mockResponse);
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.render).toHaveBeenCalledWith('error', expect.anything());
  });

  // --- Get All ---
  it('getAllBebasAsrama: Happy', async () => {
    await controller.getAllBebasAsrama(mockRequest, mockResponse);
    expect(mockPrismaSuratFindMany).toHaveBeenCalled();
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('getAllBebasAsrama: Error', async () => {
    mockPrismaSuratFindMany.mockRejectedValue(new Error('Fail'));
    await controller.getAllBebasAsrama(mockRequest, mockResponse);
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  // --- Get Detail ---
  it('getDetailBebasAsrama: Happy', async () => {
    mockRequest.params.id = '1';
    await controller.getDetailBebasAsrama(mockRequest, mockResponse);
    expect(mockPrismaSuratFindUnique).toHaveBeenCalled();
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: mockPengajuan }));
  });

  it('getDetailBebasAsrama: Not Found', async () => {
    mockPrismaSuratFindUnique.mockResolvedValue(null);
    mockRequest.params.id = '1';
    await controller.getDetailBebasAsrama(mockRequest, mockResponse);
    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Tidak ditemukan" }));
  });

  it('getDetailBebasAsrama: Invalid ID', async () => {
    mockRequest.params.id = 'abc';
    await controller.getDetailBebasAsrama(mockRequest, mockResponse);
    expect(mockResponse.status).toHaveBeenCalledWith(400);
  });

  it('getDetailBebasAsrama: Error', async () => {
    mockRequest.params.id = '1';
    mockPrismaSuratFindUnique.mockRejectedValue(new Error('DB Fail'));
    await controller.getDetailBebasAsrama(mockRequest, mockResponse);
    expect(mockResponse.status).toHaveBeenCalledWith(500);
  });

  // --- Verifikasi Fasilitas ---
  it('verifikasiFasilitas: Happy Non-KIPK Lengkap', async () => {
    mockRequest.params.id = '1'; mockRequest.body = { fasilitas_status: 'LENGKAP', kerusakan: [] };
    await controller.verifikasiFasilitas(mockRequest, mockResponse);

    expect(mockPrismaTransaction).toHaveBeenCalled();
    expect(mockPrismaSuratUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ total_biaya: 2000000 })
    }));
    expect(mockPrismaPembayaranCreate).toHaveBeenCalled();
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('verifikasiFasilitas: Happy Non-KIPK Rusak', async () => {
    mockRequest.params.id = '1';
    mockRequest.body = { fasilitas_status: 'TIDAK_LENGKAP', kerusakan: [{ nama_fasilitas: 'X', biaya_kerusakan: 10 }] };
    await controller.verifikasiFasilitas(mockRequest, mockResponse);

    expect(mockPrismaKerusakanCreateMany).toHaveBeenCalled();
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('verifikasiFasilitas: Calc Logic Check (Invalid Cost)', async () => {
    mockRequest.params.id = '1';
    mockRequest.body = {
      fasilitas_status: 'TIDAK_LENGKAP',
      kerusakan: [
        { nama_fasilitas: 'Valid', biaya_kerusakan: 50000 },
        { nama_fasilitas: 'Invalid', biaya_kerusakan: null },
        { nama_fasilitas: 'Invalid2', biaya_kerusakan: 'abc' }
      ]
    };
    await controller.verifikasiFasilitas(mockRequest, mockResponse);

    expect(mockPrismaSuratUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ total_biaya: 2050000 })
    }));
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('verifikasiFasilitas: Notification Skip (No User Found)', async () => {
    mockRequest.params.id = '1';
    mockRequest.body = { fasilitas_status: 'LENGKAP' };
    mockPrismaMahasiswaFindUnique.mockResolvedValue(null);

    await controller.verifikasiFasilitas(mockRequest, mockResponse);

    expect(mockCreateNotification).not.toHaveBeenCalled();
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('verifikasiFasilitas: Happy KIPK', async () => {
    mockPrismaSuratFindUnique.mockResolvedValue({ ...mockPengajuan, mahasiswa: { kipk: 'ya', user: { user_id: 'u1' } } });
    mockRequest.params.id = '1'; mockRequest.body = { fasilitas_status: 'LENGKAP' };
    await controller.verifikasiFasilitas(mockRequest, mockResponse);

    // Jika KIPK + Lengkap -> Biaya 0, No Tagihan
    expect(mockPrismaPembayaranCreate).not.toHaveBeenCalled();
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('verifikasiFasilitas: Happy KIPK Rusak', async () => {
    mockPrismaSuratFindUnique.mockResolvedValue({ ...mockPengajuan, mahasiswa: { kipk: 'ya', user: { user_id: 'u1' } } });
    mockRequest.params.id = '1';
    mockRequest.body = { fasilitas_status: 'TIDAK_LENGKAP', kerusakan: [{ nama_fasilitas: 'X', biaya_kerusakan: 10 }] };
    await controller.verifikasiFasilitas(mockRequest, mockResponse);

    // Jika KIPK + Rusak -> Ada Tagihan (hanya kerusakan)
    expect(mockPrismaPembayaranCreate).toHaveBeenCalled();
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('verifikasiFasilitas: Invalid Input', async () => {
    mockRequest.body = { fasilitas_status: 'X' };
    await controller.verifikasiFasilitas(mockRequest, mockResponse);
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("wajib diisi") }));
  });

  it('verifikasiFasilitas: Invalid ID', async () => {
    mockRequest.params.id = 'a';
    mockRequest.body = { fasilitas_status: 'LENGKAP' };
    await controller.verifikasiFasilitas(mockRequest, mockResponse);
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("ID pengajuan tidak valid") }));
  });

  it('verifikasiFasilitas: Not Found', async () => {
    mockPrismaSuratFindUnique.mockResolvedValue(null);
    mockRequest.params.id = '1';
    mockRequest.body = { fasilitas_status: 'LENGKAP' };
    await controller.verifikasiFasilitas(mockRequest, mockResponse);
    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Pengajuan tidak ditemukan." }));
  });

  it('verifikasiFasilitas: No Mahasiswa', async () => {
    mockPrismaSuratFindUnique.mockResolvedValue({ ...mockPengajuan, mahasiswa: null });
    mockRequest.params.id = '1';
    mockRequest.body = { fasilitas_status: 'LENGKAP' };
    await controller.verifikasiFasilitas(mockRequest, mockResponse);
    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("Data mahasiswa") }));
  });

  it('verifikasiFasilitas: Transaction Error', async () => {
    mockPrismaKerusakanDeleteMany.mockRejectedValue(new Error('Simulasi Gagal Hapus'));
    mockRequest.params.id = '1'; mockRequest.body = { fasilitas_status: 'LENGKAP' };
    await controller.verifikasiFasilitas(mockRequest, mockResponse);
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  // --- Bukti Pembayaran ---
  it('getBuktiPembayaran: Happy', async () => {
    mockRequest.params.id = '1';
    await controller.getBuktiPembayaran(mockRequest, mockResponse);
    expect(mockResponse.sendFile).toHaveBeenCalled();
  });

  it('getBuktiPembayaran: Not Found', async () => {
    mockPrismaSuratFindUnique.mockResolvedValue(null);
    mockRequest.params.id = '1';
    await controller.getBuktiPembayaran(mockRequest, mockResponse);
    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Pengajuan tidak ditemukan." }));
  });

  it('getBuktiPembayaran: No Payment', async () => {
    mockPrismaSuratFindUnique.mockResolvedValue({ ...mockPengajuan, pembayaran: [] });
    mockRequest.params.id = '1';
    await controller.getBuktiPembayaran(mockRequest, mockResponse);
    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("Bukti pembayaran") }));
  });

  it('getBuktiPembayaran: Invalid ID', async () => {
    mockRequest.params.id = 'abc';
    await controller.getBuktiPembayaran(mockRequest, mockResponse);
    expect(mockResponse.status).toHaveBeenCalledWith(400);
  });

  it('getBuktiPembayaran: Error', async () => {
    mockRequest.params.id = '1';
    mockPrismaSuratFindUnique.mockRejectedValue(new Error('Fail'));
    await controller.getBuktiPembayaran(mockRequest, mockResponse);
    expect(mockResponse.status).toHaveBeenCalledWith(500);
  });

  it('getBuktiPembayaran: File Not Found (Callback Error)', async () => {
    mockPrismaSuratFindUnique.mockResolvedValue({
      pembayaran: [{ bukti_pembayaran: 'uploads/hilang.jpg' }]
    });
    mockRequest.params.id = '1';

    mockResponse.sendFile.mockImplementation((path, cb) => {
      cb(new Error('File not found in system'));
    });

    await controller.getBuktiPembayaran(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('File fisik tidak ditemukan')
    }));
  });
});