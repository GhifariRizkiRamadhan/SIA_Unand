// 1. Deklarasi Mock Functions
const mockPrismaTransaction = jest.fn();
const mockPrismaSuratFindUnique = jest.fn();
const mockPrismaSuratUpdate = jest.fn();
const mockPrismaKerusakanDeleteMany = jest.fn();
const mockPrismaKerusakanCreateMany = jest.fn();
const mockPrismaPembayaranCreate = jest.fn();
const mockPrismaMahasiswaFindUnique = jest.fn();
const mockBebasAsramaFindAll = jest.fn();
const mockBebasAsramaFindById = jest.fn();
const mockBebasAsramaFindByIdWithPembayaran = jest.fn();
const mockCreateNotification = jest.fn();

// 2. Mock Modules
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
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
    $transaction: jest.fn(async (callback) => {
      mockPrismaTransaction(); // Track panggilan
      // Mock context transaksi (tx)
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
jest.mock('../../models/bebasAsramaModel', () => ({
  findAll: mockBebasAsramaFindAll,
  findById: mockBebasAsramaFindById,
  findByIdWithPembayaran: mockBebasAsramaFindByIdWithPembayaran
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

// 3. Require Controller
const controller = require('../../controller/conBbsAsrPnl');

describe('Unit Test: controller/conBbsAsrPnl.js', () => {
  let mockRequest;
  let mockResponse;

  // Data Mock
  const mockPengajuan = {
    Surat_id: 1,
    mahasiswa_id: 10,
    mahasiswa: { kipk: 'tidak', user: { user_id: 'user-mhs-1' } }
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // --- RESET SEMUA IMPLEMENTASI KE HAPPY PATH (CRUCIAL) ---
    mockPrismaSuratFindUnique.mockResolvedValue(mockPengajuan);
    mockPrismaSuratUpdate.mockResolvedValue({ ...mockPengajuan, status_pengajuan: 'MENUNGGU_PEMBAYARAN' });
    mockPrismaMahasiswaFindUnique.mockResolvedValue(mockPengajuan.mahasiswa);
    
    // Pastikan operasi void/delete mereturn sukses, BUKAN error
    mockPrismaKerusakanDeleteMany.mockResolvedValue({ count: 1 });
    mockPrismaKerusakanCreateMany.mockResolvedValue({ count: 1 });
    mockPrismaPembayaranCreate.mockResolvedValue({ id: 100 });
    mockCreateNotification.mockResolvedValue({});

    // Model custom mocks
    mockBebasAsramaFindAll.mockResolvedValue([]);
    mockBebasAsramaFindById.mockResolvedValue(mockPengajuan);
    
    // Req/Res
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
      sendFile: jest.fn((path, cb) => cb && cb()), // Mock sendFile sukses
    };
  });

  // --- Verifikasi Fasilitas ---
  describe('verifikasiFasilitas', () => {
    it('Happy Path: Non-KIPK Lengkap', async () => {
      mockRequest.params.id = '1';
      mockRequest.body = { fasilitas_status: 'LENGKAP', kerusakan: [] };

      await controller.verifikasiFasilitas(mockRequest, mockResponse);

      expect(mockPrismaTransaction).toHaveBeenCalled();
      expect(mockPrismaSuratUpdate).toHaveBeenCalled();
      expect(mockPrismaPembayaranCreate).toHaveBeenCalled(); // Ada biaya 2jt
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('Happy Path: KIPK Lengkap (Validasi Bug Fix)', async () => {
      const kipkData = { ...mockPengajuan, mahasiswa: { kipk: 'ya', user: { user_id: 'u1' } } };
      mockPrismaSuratFindUnique.mockResolvedValue(kipkData);
      mockPrismaMahasiswaFindUnique.mockResolvedValue(kipkData.mahasiswa);
      
      mockRequest.params.id = '1';
      mockRequest.body = { fasilitas_status: 'LENGKAP', kerusakan: [] };

      await controller.verifikasiFasilitas(mockRequest, mockResponse);

      expect(mockPrismaSuratUpdate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ 
          status_pengajuan: 'SELESAI', 
          total_biaya: 0 
        })
      }));
      expect(mockPrismaPembayaranCreate).not.toHaveBeenCalled(); // Tidak boleh ada tagihan
      expect(mockCreateNotification).toHaveBeenCalled();
    });

    it('Error Handling: Transaksi Gagal', async () => {
      // Override mock KHUSUS untuk tes ini
      mockPrismaKerusakanDeleteMany.mockRejectedValue(new Error('Simulasi Gagal Hapus'));
      
      mockRequest.params.id = '1';
      mockRequest.body = { fasilitas_status: 'LENGKAP' };

      await controller.verifikasiFasilitas(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      // Tes ini SUKSES jika masuk catch block dan return 500
    });
  });

  // --- Get Bukti Pembayaran ---
  describe('getBuktiPembayaran', () => {
    it('Happy Path: Kirim file', async () => {
      mockBebasAsramaFindByIdWithPembayaran.mockResolvedValue({
        pembayaran: [{ bukti_pembayaran: 'uploads/file.jpg' }]
      });
      mockRequest.params.id = '1';

      await controller.getBuktiPembayaran(mockRequest, mockResponse);
      expect(mockResponse.sendFile).toHaveBeenCalled();
    });
  });
});