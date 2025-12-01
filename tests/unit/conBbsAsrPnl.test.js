// ==========================================================
// FILE: tests/unit/conBbsAsrPnl.test.js (100% Coverage Target)
// ==========================================================

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
const User = require('../../models/userModels');

describe('Unit Test: controller/conBbsAsrPnl.js', () => {
  let mockRequest;
  let mockResponse;

  const mockPengajuan = {
    Surat_id: 1,
    mahasiswa_id: 10,
    mahasiswa: { kipk: 'tidak', user: { user_id: 'user-mhs-1' } }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default Happy Path Mocks
    mockPrismaSuratFindUnique.mockResolvedValue(mockPengajuan);
    mockPrismaSuratUpdate.mockResolvedValue({ ...mockPengajuan, status_pengajuan: 'MENUNGGU_PEMBAYARAN', total_biaya: 2000000 });
    mockPrismaMahasiswaFindUnique.mockResolvedValue(mockPengajuan.mahasiswa);
    
    mockPrismaKerusakanDeleteMany.mockResolvedValue({ count: 1 });
    mockPrismaKerusakanCreateMany.mockResolvedValue({ count: 1 });
    mockPrismaPembayaranCreate.mockResolvedValue({ id: 100 });
    mockCreateNotification.mockResolvedValue({});

    mockBebasAsramaFindAll.mockResolvedValue([]);
    mockBebasAsramaFindById.mockResolvedValue(mockPengajuan);
    
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
      // Default sendFile sukses (memanggil callback tanpa error)
      sendFile: jest.fn((path, cb) => cb && cb()),
    };
  });

  // --- Show Page ---
  it('showBebasAsramaPengelola: Happy', async () => await controller.showBebasAsramaPengelola(mockRequest, mockResponse));
  it('showBebasAsramaPengelola: No Auth', async () => { mockRequest.user = null; await controller.showBebasAsramaPengelola(mockRequest, mockResponse); });
  it('showBebasAsramaPengelola: Error', async () => { User.findById.mockRejectedValue(new Error('Fail')); await controller.showBebasAsramaPengelola(mockRequest, mockResponse); });

  // --- Get All ---
  it('getAllBebasAsrama: Happy', async () => await controller.getAllBebasAsrama(mockRequest, mockResponse));
  it('getAllBebasAsrama: Error', async () => { mockBebasAsramaFindAll.mockRejectedValue(new Error('Fail')); await controller.getAllBebasAsrama(mockRequest, mockResponse); });

  // --- Get Detail ---
  it('getDetailBebasAsrama: Happy', async () => { mockRequest.params.id = '1'; await controller.getDetailBebasAsrama(mockRequest, mockResponse); });
  it('getDetailBebasAsrama: Not Found', async () => { mockBebasAsramaFindById.mockResolvedValue(null); await controller.getDetailBebasAsrama(mockRequest, mockResponse); });
  it('getDetailBebasAsrama: Error', async () => { mockBebasAsramaFindById.mockRejectedValue(new Error('DB Fail')); await controller.getDetailBebasAsrama(mockRequest, mockResponse); });

  // --- Verifikasi Fasilitas (CRUCIAL) ---
  it('verifikasiFasilitas: Happy Non-KIPK Lengkap', async () => { 
      mockRequest.params.id = '1'; mockRequest.body = { fasilitas_status: 'LENGKAP', kerusakan: [] }; 
      await controller.verifikasiFasilitas(mockRequest, mockResponse); 
  });

  it('verifikasiFasilitas: Happy Non-KIPK Rusak', async () => { 
      mockRequest.params.id = '1'; 
      mockRequest.body = { fasilitas_status: 'TIDAK_LENGKAP', kerusakan: [{ nama_fasilitas: 'X', biaya_kerusakan: 10 }] }; 
      await controller.verifikasiFasilitas(mockRequest, mockResponse); 
  });

  it('verifikasiFasilitas: Happy KIPK', async () => {
      mockPrismaSuratFindUnique.mockResolvedValue({ ...mockPengajuan, mahasiswa: { kipk: 'ya', user: { user_id: 'u1' } } });
      mockRequest.params.id = '1'; mockRequest.body = { fasilitas_status: 'LENGKAP' };
      await controller.verifikasiFasilitas(mockRequest, mockResponse);
  });

  it('verifikasiFasilitas: Happy KIPK Rusak', async () => {
      mockPrismaSuratFindUnique.mockResolvedValue({ ...mockPengajuan, mahasiswa: { kipk: 'ya', user: { user_id: 'u1' } } });
      mockRequest.params.id = '1'; 
      mockRequest.body = { fasilitas_status: 'TIDAK_LENGKAP', kerusakan: [{ nama_fasilitas: 'X', biaya_kerusakan: 10 }] };
      await controller.verifikasiFasilitas(mockRequest, mockResponse);
  });

  it('verifikasiFasilitas: Invalid Input', async () => { mockRequest.body = { fasilitas_status: 'X' }; await controller.verifikasiFasilitas(mockRequest, mockResponse); });
  it('verifikasiFasilitas: Invalid ID', async () => { mockRequest.params.id = 'a'; mockRequest.body = { fasilitas_status: 'LENGKAP' }; await controller.verifikasiFasilitas(mockRequest, mockResponse); });
  it('verifikasiFasilitas: Not Found', async () => { mockPrismaSuratFindUnique.mockResolvedValue(null); mockRequest.params.id = '1'; mockRequest.body = { fasilitas_status: 'LENGKAP' }; await controller.verifikasiFasilitas(mockRequest, mockResponse); });
  it('verifikasiFasilitas: No Mahasiswa', async () => { mockPrismaSuratFindUnique.mockResolvedValue({ ...mockPengajuan, mahasiswa: null }); mockRequest.params.id = '1'; mockRequest.body = { fasilitas_status: 'LENGKAP' }; await controller.verifikasiFasilitas(mockRequest, mockResponse); });
  
  it('verifikasiFasilitas: Transaction Error', async () => { 
      mockPrismaKerusakanDeleteMany.mockRejectedValue(new Error('Simulasi Gagal Hapus'));
      mockRequest.params.id = '1'; mockRequest.body = { fasilitas_status: 'LENGKAP' }; 
      await controller.verifikasiFasilitas(mockRequest, mockResponse); 
      expect(mockResponse.status).toHaveBeenCalledWith(500);
  });

  // --- Bukti Pembayaran (CRUCIAL FOR 100% COVERAGE) ---
  it('getBuktiPembayaran: Happy', async () => { 
      mockBebasAsramaFindByIdWithPembayaran.mockResolvedValue({ pembayaran: [{ bukti_pembayaran: 'a.jpg' }] });
      mockRequest.params.id = '1';
      await controller.getBuktiPembayaran(mockRequest, mockResponse); 
      expect(mockResponse.sendFile).toHaveBeenCalled();
  });

  it('getBuktiPembayaran: Not Found', async () => { mockBebasAsramaFindByIdWithPembayaran.mockResolvedValue(null); await controller.getBuktiPembayaran(mockRequest, mockResponse); });
  it('getBuktiPembayaran: No Payment', async () => { mockBebasAsramaFindByIdWithPembayaran.mockResolvedValue({ pembayaran: [] }); await controller.getBuktiPembayaran(mockRequest, mockResponse); });
  it('getBuktiPembayaran: Error', async () => { mockBebasAsramaFindByIdWithPembayaran.mockRejectedValue(new Error('Fail')); await controller.getBuktiPembayaran(mockRequest, mockResponse); });

  // --- INI ADALAH TES KUNCI UNTUK 100% COVERAGE ---
  it('getBuktiPembayaran: File Not Found (Callback Error)', async () => {
      mockBebasAsramaFindByIdWithPembayaran.mockResolvedValue({
        pembayaran: [{ bukti_pembayaran: 'uploads/hilang.jpg' }]
      });
      mockRequest.params.id = '1';
      
      // KITA MEMAKSA callback dipanggil dengan ERROR
      mockResponse.sendFile.mockImplementation((path, cb) => {
         cb(new Error('File not found in system'));
      });
      
      await controller.getBuktiPembayaran(mockRequest, mockResponse);
      
      // Ini akan masuk ke dalam blok 'if (err)' di controller
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ 
          message: expect.stringContaining('File fisik tidak ditemukan') 
      }));
  });
});