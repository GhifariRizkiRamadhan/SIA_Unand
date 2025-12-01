require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret-rahasia-untuk-tes';

// 1. Setup Mocks Global
const mockSingletonPrismaMahasiswaFindFirst = jest.fn();
const mockSingletonPrismaPengelolaFindFirst = jest.fn();
const mockSingletonPrismaDisconnect = jest.fn();

// Mock Prisma Functions yang dipanggil Controller
const mockPrismaSuratFindUnique = jest.fn();
// Mock Transaksi
const mockPrismaTransaction = jest.fn(async (callback) => {
  const mockTx = {
    suratbebasasrama: { update: jest.fn().mockResolvedValue({ total_biaya: 2000000, mahasiswa_id: 10, Surat_id: 1 }) },
    kerusakanFasilitas: { deleteMany: jest.fn(), createMany: jest.fn() },
    pembayaran: { create: jest.fn() },
    mahasiswa: { findUnique: jest.fn().mockResolvedValue({ user: { user_id: 'mhs-1' } }) }
  };
  return await callback(mockTx);
});

// 2. Mock Config Database
jest.mock('../../config/database', () => ({
  prisma: {
    mahasiswa: { findFirst: mockSingletonPrismaMahasiswaFindFirst },
    pengelolaasrama: { findFirst: mockSingletonPrismaPengelolaFindFirst },
    $disconnect: mockSingletonPrismaDisconnect,
  },
}));

// 3. Mock Prisma Client
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      suratbebasasrama: { 
        findUnique: mockPrismaSuratFindUnique, 
        update: jest.fn() 
      },
      kerusakanFasilitas: { deleteMany: jest.fn(), createMany: jest.fn() },
      pembayaran: { create: jest.fn() },
      mahasiswa: { findUnique: jest.fn() },
      $transaction: mockPrismaTransaction 
    }))
  };
});

jest.mock('../../models/userModels');
jest.mock('../../models/bebasAsramaModel', () => ({
  findAll: jest.fn().mockResolvedValue([{ id: 1, status: 'SELESAI' }])
}));
jest.mock('../../controller/notification', () => ({
  createNotification: jest.fn().mockResolvedValue({}),
  getNotifications: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
}));

jest.mock('../../middlewares/uploadMiddleware', () => ({
  uploadBukti: (req, res, next) => next(),
  upload: (req, res, next) => next(),
  uploadImage: (req, res, next) => next(),
  uploadIzinDokumen: (req, res, next) => next(),
  uploadFotoKerusakan: (req, res, next) => next(),
}));
jest.mock('../../config/multerConfig', () => ({
  uploadMahasiswaFoto: { single: () => (req, res, next) => next() },
}));
jest.mock('../../middlewares/validateEmail', () => jest.fn((req, res, next) => next()));
jest.mock('../../middlewares/rateLimiter', () => jest.fn((req, res, next) => next()));

// Mock All Controllers
jest.mock('../../controller/conLogin', () => ({ showLogin: jest.fn(), authController: { login: jest.fn(), logout: jest.fn() } }));
jest.mock('../../controller/conRegis', () => ({ regcon: { showRegis: jest.fn(), register: jest.fn() } }));
jest.mock('../../controller/conProfile', () => ({ showProfile: jest.fn(), updateProfile: jest.fn() }));
jest.mock('../../controller/conForgot', () => ({ showForgotPassword: jest.fn(), resetPassword: jest.fn() }));
jest.mock('../../controller/conPbyr', () => ({ showPembayaran: jest.fn(), uploadBuktiPembayaran: jest.fn(), getDetailPembayaran: jest.fn(), reuploadBuktiPembayaran: jest.fn(), getAllPembayaran: jest.fn(), approvePembayaran: jest.fn(), rejectPembayaran: jest.fn() }));
jest.mock('../../controller/conBbsAsr', () => ({ showBebasAsrama: jest.fn(), ajukanBebasAsrama: jest.fn(), getStatusBebasAsrama: jest.fn(), deleteBebasAsrama: jest.fn(), downloadSurat: jest.fn(), getTagihanMahasiswa: jest.fn(), getRiwayatPengajuan: jest.fn(), checkActiveSubmission: jest.fn() }));
jest.mock('../../controller/conIzinKeluar', () => ({ showFormMahasiswa: jest.fn(), listIzinMahasiswa: jest.fn(), submitIzinMahasiswa: jest.fn(), showIzinPengelola: jest.fn(), listIzinPengelola: jest.fn(), approveIzin: jest.fn(), rejectIzin: jest.fn(), updateIzinNotes: jest.fn(), resetIzinStatus: jest.fn() }));
jest.mock('../../controller/conPelaporan', () => ({ showFormPelaporan: jest.fn(), listPelaporanMahasiswa: jest.fn(), submitPelaporan: jest.fn(), showPelaporanPengelola: jest.fn(), listPelaporanPengelola: jest.fn(), updateStatusPelaporan: jest.fn() }));
jest.mock('../../controller/conDhsPnl', () => ({ showDashboard: jest.fn() }));
jest.mock('../../controller/conPmbrthnPnl', () => ({ showPemberitahuanPengelola: jest.fn(), getPemberitahuan: jest.fn(), hapusPemberitahuan: jest.fn(), tambahPemberitahuan: jest.fn(), editPemberitahuan: jest.fn() }));
jest.mock('../../controller/conDtPnghni', () => ({ showDtPenghuni: jest.fn(), tambahPenghuni: jest.fn(), editPenghuni: jest.fn(), toggleStatusPenghuni: jest.fn(), getPenghuniById: jest.fn() }));


const request = require('supertest');
const { app, server } = require('../../app');
const jwt = require('jsonwebtoken');
const { prisma } = require('../../config/database');
const { createNotification } = require('../../controller/notification');

const generateAuthToken = (payload) => {
  const defaultPayload = { user_id: 'u1', email: 'test@x.com', role: 'mahasiswa', mahasiswa_id: 1 };
  const tokenPayload = { ...defaultPayload, ...payload };
  if (tokenPayload.role === 'mahasiswa') prisma.mahasiswa.findFirst.mockResolvedValue({ mahasiswa_id: 1 });
  if (tokenPayload.role === 'pengelola') prisma.pengelolaasrama.findFirst.mockResolvedValue({ Pengelola_id: 1 });
  return jwt.sign(tokenPayload, process.env.JWT_SECRET);
};

describe('Integration Test: Endpoints Pengelola Bebas Asrama', () => {
  let pengelolaToken, mahasiswaToken;

  beforeAll(() => {
    pengelolaToken = generateAuthToken({ role: 'pengelola' });
    mahasiswaToken = generateAuthToken({ role: 'mahasiswa' });
  });

  afterAll(async () => {
    if (server) await new Promise(r => server.close(r));
    await prisma.$disconnect();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    const mockPengajuan = {
        Surat_id: 1,
        mahasiswa_id: 10,
        mahasiswa: { kipk: 'tidak', user: { user_id: 'u1' } }
    };
    // SETUP PENTING: Pastikan findUnique mengembalikan data
    mockPrismaSuratFindUnique.mockResolvedValue(mockPengajuan);
  });

  describe('POST /api/pengelola/bebas-asrama/:id/verifikasi-fasilitas', () => {
    it('Happy Path: Pengelola harus bisa memverifikasi fasilitas', async () => {
      const res = await request(app)
        .post('/api/pengelola/bebas-asrama/1/verifikasi-fasilitas')
        .set('Cookie', `token=${pengelolaToken}`)
        .send({
          fasilitas_status: 'TIDAK_LENGKAP',
          kerusakan: [{ nama_fasilitas: 'Kursi', biaya_kerusakan: 50000 }]
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      
      expect(mockPrismaTransaction).toHaveBeenCalled();
      expect(createNotification).toHaveBeenCalled();
    });

    it('Sad Path: Invalid Input', async () => {
        const res = await request(app)
          .post('/api/pengelola/bebas-asrama/1/verifikasi-fasilitas')
          .set('Cookie', `token=${pengelolaToken}`)
          .send({ fasilitas_status: 'HANCUR' }); 
        
        expect(res.statusCode).toBe(400);
      });
  });

  describe('Keamanan Endpoint', () => {
      it('Sad Path: Mahasiswa ditolak', async () => {
        const res = await request(app)
          .post('/api/pengelola/bebas-asrama/1/verifikasi-fasilitas')
          .set('Cookie', `token=${mahasiswaToken}`); 
        expect(res.statusCode).toBe(403);
      });
  });
});