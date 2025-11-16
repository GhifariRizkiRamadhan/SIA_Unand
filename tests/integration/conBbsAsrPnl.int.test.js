// 1. DEKLARASIKAN FUNGSI MOCK DI PALING ATAS
const mockSingletonPrismaMahasiswaFindFirst = jest.fn();
const mockSingletonPrismaPengelolaFindFirst = jest.fn();
const mockSingletonPrismaDisconnect = jest.fn();
const mockControllerPrismaTransaction = jest.fn();
const mockControllerPrismaSuratFindUnique = jest.fn();
const mockControllerPrismaSuratUpdate = jest.fn();
const mockControllerPrismaKerusakanDeleteMany = jest.fn();
const mockControllerPrismaKerusakanCreateMany = jest.fn();
const mockControllerPrismaPembayaranCreate = jest.fn();
const mockControllerPrismaMahasiswaFindUnique = jest.fn();

// 2. PANGGIL SEMUA JEST.MOCK() SETELAH ITU
jest.mock('../../config/database', () => ({
  prisma: {
    mahasiswa: { findFirst: mockSingletonPrismaMahasiswaFindFirst },
    pengelolaasrama: { findFirst: mockSingletonPrismaPengelolaFindFirst },
    $disconnect: mockSingletonPrismaDisconnect,
  },
}));
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    suratbebasasrama: {
      findUnique: mockControllerPrismaSuratFindUnique,
      update: mockControllerPrismaSuratUpdate,
    },
    kerusakanFasilitas: {
      deleteMany: mockControllerPrismaKerusakanDeleteMany,
      createMany: mockControllerPrismaKerusakanCreateMany,
    },
    pembayaran: {
      create: mockControllerPrismaPembayaranCreate,
    },
    mahasiswa: {
      findUnique: mockControllerPrismaMahasiswaFindUnique,
    },
    $transaction: jest.fn(async (callback) => {
      mockControllerPrismaTransaction();
      const mockTx = {
        suratbebasasrama: { update: mockControllerPrismaSuratUpdate },
        kerusakanFasilitas: {
          deleteMany: mockControllerPrismaKerusakanDeleteMany,
          createMany: mockControllerPrismaKerusakanCreateMany,
        },
        pembayaran: { create: mockControllerPrismaPembayaranCreate },
        mahasiswa: { findUnique: mockControllerPrismaMahasiswaFindUnique },
      };
      return await callback(mockTx);
    }),
  })),
}));
jest.mock('../../models/userModels');
jest.mock('../../models/bebasAsramaModel');
jest.mock('../../models/pembayaranModel');
jest.mock('../../controller/notification', () => ({
  createNotification: jest.fn().mockResolvedValue({}),
  getNotifications: jest.fn().mockResolvedValue({}),
  markAsRead: jest.fn().mockResolvedValue({}),
  markAllAsRead: jest.fn().mockResolvedValue({}),
}));

// 3. BARU REQUIRE SEMUA DEPENDENSI
const request = require('supertest');
const { app, server } = require('../../app');
const jwt = require('jsonwebtoken');
const { prisma } = require('../../config/database');
const BebasAsrama = require('../../models/bebasAsramaModel');

const { createNotification } = require('../../controller/notification');


// Helper untuk membuat token otentikasi
const generateAuthToken = (payload) => {
  const defaultPayload = {
    user_id: 'user-default',
    email: 'test@example.com',
    role: 'mahasiswa',
    mahasiswa_id: 1,
  };
  const tokenPayload = { ...defaultPayload, ...payload };
  
  // Setup mock untuk 'prisma' singleton yang digunakan authMiddleware
  if (tokenPayload.role === 'mahasiswa') {
    prisma.mahasiswa.findFirst.mockResolvedValue({ mahasiswa_id: tokenPayload.mahasiswa_id });
  } else {
    prisma.mahasiswa.findFirst.mockResolvedValue(null);
  }
  if (tokenPayload.role === 'pengelola') {
    prisma.pengelolaasrama.findFirst.mockResolvedValue({ Pengelola_id: tokenPayload.pengelola_id });
  } else {
    prisma.pengelolaasrama.findFirst.mockResolvedValue(null);
  }
  
  return jwt.sign(tokenPayload, process.env.JWT_SECRET);
};

// ===================================
// START: TEST SUITES
// ===================================
describe('Integration Test: Endpoints Pengelola Bebas Asrama', () => {
  let pengelolaToken;
  let mahasiswaToken;

  beforeAll(() => {
    // Buat token pengelola yang valid
    pengelolaToken = generateAuthToken({
      user_id: 'pengelola-1',
      role: 'pengelola',
      pengelola_id: 1,
      mahasiswa_id: null,
    });
    // Buat token mahasiswa untuk tes keamanan
    mahasiswaToken = generateAuthToken({
      user_id: 'mhs-1',
      role: 'mahasiswa',
      mahasiswa_id: 1,
    });
  });

  afterAll(async () => {
    await new Promise(resolve => server.close(resolve));
    await prisma.$disconnect();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock token (penting agar mock findFirst di authMiddleware konsisten)
    // Perlu me-reset kedua token jika digunakan di beforeEach
    pengelolaToken = generateAuthToken({ user_id: 'pengelola-1', role: 'pengelola', pengelola_id: 1, mahasiswa_id: null });
    mahasiswaToken = generateAuthToken({ user_id: 'mhs-1', role: 'mahasiswa', mahasiswa_id: 1 });
  });

  // =
  // Test: Keamanan Rute (Validasi Bug Fix #1)
  // =
  describe('Keamanan Endpoint (requirePengelola)', () => {
    it('Sad Path (Security): Mahasiswa TIDAK BISA mengakses GET /api/pengelola/bebas-asrama', async () => {
      const res = await request(app)
        .get('/api/pengelola/bebas-asrama')
        .set('Cookie', `token=${mahasiswaToken}`); // <-- Token Mahasiswa

      // Middleware 'requirePengelola' (yang sudah API-aware) harus me-return 403
      expect(res.statusCode).toBe(403);
      expect(res.body.message).toContain('Forbidden: Akses hanya untuk pengelola');
    });

    it('Sad Path (Security): Mahasiswa TIDAK BISA mengakses POST /.../verifikasi-fasilitas', async () => {
      const res = await request(app)
        .post('/api/pengelola/bebas-asrama/1/verifikasi-fasilitas')
        .set('Cookie', `token=${mahasiswaToken}`); // <-- Token Mahasiswa

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toContain('Forbidden: Akses hanya untuk pengelola');
    });

    it('Sad Path (Security): Mahasiswa TIDAK BISA mengakses GET /.../bukti-pembayaran', async () => {
      const res = await request(app)
        .get('/api/pengelola/surat/1/bukti-pembayaran')
        .set('Cookie', `token=${mahasiswaToken}`); // <-- Token Mahasiswa

      expect(res.statusCode).toBe(403);
    });
  });
  
  // =
  // Test: GET /api/pengelola/bebas-asrama
  // =
  describe('GET /api/pengelola/bebas-asrama', () => {
    it('Happy Path: Pengelola harus bisa mengambil semua data', async () => {
      const mockData = [{ id: 1, status: 'SELESAI' }];
      BebasAsrama.findAll.mockResolvedValue(mockData);
      
      const res = await request(app)
        .get('/api/pengelola/bebas-asrama')
        .set('Cookie', `token=${pengelolaToken}`); // <-- Token Pengelola

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toEqual(mockData);
    });
  });

  // =
  // Test: POST /api/pengelola/bebas-asrama/:id/verifikasi-fasilitas
  // =
  describe('POST /api/pengelola/bebas-asrama/:id/verifikasi-fasilitas', () => {
    
    // Setup mock data di sini
    const mockPengajuan = {
      Surat_id: 1,
      mahasiswa_id: 10,
      mahasiswa: { kipk: 'tidak', user: { user_id: 'user-mhs-1' } }
    };
    const mockUpdatedSurat = { ...mockPengajuan, status_pengajuan: 'MENUNGGU_PEMBAYARAN', total_biaya: 2050000 };
    
    // Setup mock default untuk tes di grup ini
    beforeEach(() => {
      mockControllerPrismaSuratFindUnique.mockResolvedValue(mockPengajuan);
      mockControllerPrismaSuratUpdate.mockResolvedValue(mockUpdatedSurat);
      mockControllerPrismaMahasiswaFindUnique.mockResolvedValue(mockPengajuan.mahasiswa);
    });
    
    it('Happy Path: Pengelola harus bisa memverifikasi fasilitas', async () => {
      const res = await request(app)
        .post('/api/pengelola/bebas-asrama/1/verifikasi-fasilitas')
        .set('Cookie', `token=${pengelolaToken}`)
        .send({
          fasilitas_status: 'TIDAK_LENGKAP',
          kerusakan: [{ nama_fasilitas: 'Kursi', biaya_kerusakan: 50000 }]
        });

      // Verifikasi response sukses
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      // Verifikasi transaksi dipanggil
      expect(mockControllerPrismaTransaction).toHaveBeenCalled();
      
      expect(createNotification).toHaveBeenCalled();
    });
    
    it('Sad Path: Harus return 400 jika input body tidak valid', async () => {
      const res = await request(app)
        .post('/api/pengelola/bebas-asrama/1/verifikasi-fasilitas')
        .set('Cookie', `token=${pengelolaToken}`)
        .send({ fasilitas_status: 'HANCUR' }); // Input tidak valid
      
      expect(res.statusCode).toBe(400);
    });
  });
});