/**
 * @file tests/dataPenghuni.test.js
 * Menguji endpoint Data Penghuni (Pengelola)
 */

const request = require('supertest');
const { app } = require('../app');

// 🧩 Mock semua dependency internal
jest.mock('../models/userModels');
jest.mock('../config/database', () => ({
  prisma: require('./__mocks__/prisma'),
}));
jest.mock('bcrypt'); 
jest.mock('fs');
jest.mock('../middlewares/authMiddleware', () =>
  require('./__mocks__/middlewares/authMiddleware')
);
jest.mock('../config/multerConfig', () =>
  require('./__mocks__/config/multerConfig')
);

const User = require('../models/userModels');
const { prisma } = require('../config/database');
const bcrypt = require('bcrypt');
const fs = require('fs');

describe('📋 Data Penghuni API Test (Jest + Supertest)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock fs.unlinkSync agar tidak error
    fs.unlinkSync = jest.fn();
    fs.existsSync = jest.fn().mockReturnValue(false);
  });

  // ==============================================
  // TEST: GET /pengelola/dataPenghuni
  // ==============================================
  describe('GET /pengelola/dataPenghuni', () => {
    test('✅ Berhasil menampilkan halaman data penghuni', async () => {
      // Mock user pengelola
      User.findById.mockResolvedValue({
        user_id: 'pengelola_123',
        name: 'Admin Asrama',
        email: 'admin@asrama.com',
        role: 'pengelola',
      });

      // Mock data mahasiswa aktif
      prisma.mahasiswa.findMany.mockResolvedValueOnce([
        {
          mahasiswa_id: 1,
          nim: '2111001',
          nama: 'Budi Santoso',
          jurusan: 'Teknik Informatika',
          status: 'aktif',
          kipk: 'ya',
          foto: '/image/mahasiswa/budi.jpg',
          user_id: 'mahasiswa_001',
          user: {
            email: '2111001@student.unand.ac.id',
          },
        },
      ]);

      // Mock data mahasiswa tidak aktif
      prisma.mahasiswa.findMany.mockResolvedValueOnce([
        {
          mahasiswa_id: 2,
          nim: '2111002',
          nama: 'Ani Wijaya',
          jurusan: 'Sistem Informasi',
          status: 'tidak aktif',
          kipk: 'tidak',
          foto: null,
          user_id: 'mahasiswa_002',
          user: {
            email: '2111002@student.unand.ac.id',
          },
        },
      ]);

      const res = await request(app)
        .get('/pengelola/dataPenghuni')
        .set('Accept', 'text/html');

      expect(res.statusCode).toBe(200);
      expect(User.findById).toHaveBeenCalledWith('pengelola_123');
      expect(prisma.mahasiswa.findMany).toHaveBeenCalledTimes(2);
    });
  });

  // ==============================================
  // TEST: POST /pengelola/dataPenghuni/tambah
  // ==============================================
  describe('POST /pengelola/dataPenghuni/tambah', () => {
    test('❌ Gagal jika field wajib tidak diisi', async () => {
      const res = await request(app)
        .post('/pengelola/dataPenghuni/tambah')
        .send({
          nama: '',
          nim: '',
          jurusan: '',
        });

      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toMatch(/error=/);
      // Decode URL untuk matching
      const decodedLocation = decodeURIComponent(res.headers.location);
      expect(decodedLocation).toMatch(/Semua field harus diisi/i);
    });

    test('❌ Gagal jika NIM sudah terdaftar', async () => {
      // Mock NIM sudah ada
      prisma.mahasiswa.findUnique.mockResolvedValue({
        mahasiswa_id: 1,
        nim: '2111001',
        nama: 'Existing Student',
      });

      const res = await request(app)
        .post('/pengelola/dataPenghuni/tambah')
        .send({
          nama: 'New Student',
          nim: '2111001',
          jurusan: 'Teknik Informatika',
          status: 'aktif',
          kipk: 'ya',
        });

      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toMatch(/error=/);
      const decodedLocation = decodeURIComponent(res.headers.location);
      expect(decodedLocation).toMatch(/NIM sudah terdaftar/i);
    });

    test('✅ Berhasil menambahkan penghuni baru', async () => {
      // Mock NIM belum ada
      prisma.mahasiswa.findUnique.mockResolvedValue(null);

      // Mock bcrypt hash
      bcrypt.hash.mockResolvedValue('hashedPassword123');

      // Mock create user
      prisma.user.create.mockResolvedValue({
        user_id: 'mahasiswa_12345',
        name: 'Citra Dewi',
        email: '2111003@student.unand.ac.id',
        role: 'mahasiswa',
      });

      // Mock create mahasiswa
      prisma.mahasiswa.create.mockResolvedValue({
        mahasiswa_id: 3,
        nim: '2111003',
        nama: 'Citra Dewi',
        jurusan: 'Teknik Elektro',
        status: 'aktif',
        kipk: 'ya',
        foto: '/image/mahasiswa/dummy.png',
        user_id: 'mahasiswa_12345',
      });

      const res = await request(app)
        .post('/pengelola/dataPenghuni/tambah')
        .send({
          nama: 'Citra Dewi',
          nim: '2111003',
          jurusan: 'Teknik Elektro',
          status: 'aktif',
          kipk: 'ya',
        });

      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toMatch(/success=/);
      const decodedLocation = decodeURIComponent(res.headers.location);
      expect(decodedLocation).toMatch(/berhasil ditambahkan/i);
      expect(prisma.user.create).toHaveBeenCalled();
      expect(prisma.mahasiswa.create).toHaveBeenCalled();
    });
  });

  // ==============================================
  // TEST: POST /pengelola/dataPenghuni/edit
  // ==============================================
  describe('POST /pengelola/dataPenghuni/edit', () => {
    test('❌ Gagal jika field wajib tidak diisi', async () => {
      const res = await request(app)
        .post('/pengelola/dataPenghuni/edit')
        .send({
          mahasiswa_id: '',
          nama: '',
          nim: '',
          jurusan: '',
          status: '',
        });

      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toMatch(/error=/);
      const decodedLocation = decodeURIComponent(res.headers.location);
      expect(decodedLocation).toMatch(/Semua field harus diisi/i);
    });

    test('❌ Gagal jika mahasiswa tidak ditemukan', async () => {
      prisma.mahasiswa.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/pengelola/dataPenghuni/edit')
        .send({
          mahasiswa_id: '999',
          nama: 'Test User',
          nim: '2111999',
          jurusan: 'Test',
          status: 'aktif',
        });

      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toMatch(/error=/);
      const decodedLocation = decodeURIComponent(res.headers.location);
      expect(decodedLocation).toMatch(/tidak ditemukan/i);
    });

    test('❌ Gagal jika NIM sudah digunakan mahasiswa lain', async () => {
      // Mock mahasiswa yang akan diedit
      prisma.mahasiswa.findUnique.mockResolvedValue({
        mahasiswa_id: 1,
        nim: '2111001',
        nama: 'Old Name',
        user_id: 'mahasiswa_001',
      });

      // Mock NIM sudah dipakai mahasiswa lain
      prisma.mahasiswa.findFirst.mockResolvedValue({
        mahasiswa_id: 2,
        nim: '2111002',
        nama: 'Other Student',
      });

      const res = await request(app)
        .post('/pengelola/dataPenghuni/edit')
        .send({
          mahasiswa_id: '1',
          nama: 'Updated Name',
          nim: '2111002', // NIM sudah dipakai mahasiswa_id 2
          jurusan: 'Teknik Informatika',
          status: 'aktif',
        });

      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toMatch(/error=/);
      const decodedLocation = decodeURIComponent(res.headers.location);
      expect(decodedLocation).toMatch(/NIM sudah digunakan/i);
    });

    test('✅ Berhasil mengedit data penghuni', async () => {
      // Mock mahasiswa yang akan diedit
      prisma.mahasiswa.findUnique.mockResolvedValue({
        mahasiswa_id: 1,
        nim: '2111001',
        nama: 'Old Name',
        jurusan: 'Old Major',
        status: 'aktif',
        foto: null,
        user_id: 'mahasiswa_001',
      });

      // Mock NIM tidak dipakai mahasiswa lain
      prisma.mahasiswa.findFirst.mockResolvedValue(null);

      // Mock update mahasiswa
      prisma.mahasiswa.update.mockResolvedValue({
        mahasiswa_id: 1,
        nim: '2111001',
        nama: 'New Name',
        jurusan: 'New Major',
        status: 'aktif',
        kipk: 'ya',
        foto: '/image/mahasiswa/dummy.png',
      });

      // Mock update user
      prisma.user.update.mockResolvedValue({
        user_id: 'mahasiswa_001',
        name: 'New Name',
      });

      const res = await request(app)
        .post('/pengelola/dataPenghuni/edit')
        .send({
          mahasiswa_id: '1',
          nama: 'New Name',
          nim: '2111001',
          jurusan: 'New Major',
          status: 'aktif',
          kipk: 'ya',
        });

      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toMatch(/success=/);
      const decodedLocation = decodeURIComponent(res.headers.location);
      expect(decodedLocation).toMatch(/berhasil diupdate/i);
      expect(prisma.mahasiswa.update).toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalled();
    });
  });

  // ==============================================
  // TEST: POST /pengelola/dataPenghuni/toggle/:mahasiswa_id
  // ==============================================
  describe('POST /pengelola/dataPenghuni/toggle/:mahasiswa_id', () => {
    test('❌ Gagal jika mahasiswa tidak ditemukan', async () => {
      prisma.mahasiswa.findUnique.mockResolvedValue(null);

      const res = await request(app).post(
        '/pengelola/dataPenghuni/toggle/999'
      );

      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toMatch(/error=/);
      const decodedLocation = decodeURIComponent(res.headers.location);
      expect(decodedLocation).toMatch(/tidak ditemukan/i);
    });

    test('✅ Berhasil toggle status dari aktif ke tidak aktif', async () => {
      // Mock mahasiswa dengan status aktif
      prisma.mahasiswa.findUnique.mockResolvedValue({
        mahasiswa_id: 1,
        nim: '2111001',
        nama: 'Test User',
        status: 'aktif',
      });

      // Mock update
      prisma.mahasiswa.update.mockResolvedValue({
        mahasiswa_id: 1,
        status: 'tidak aktif',
      });

      const res = await request(app).post('/pengelola/dataPenghuni/toggle/1');

      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toMatch(/success=/);
      const decodedLocation = decodeURIComponent(res.headers.location);
      expect(decodedLocation).toMatch(/tidak aktif/i);
      expect(prisma.mahasiswa.update).toHaveBeenCalledWith({
        where: { mahasiswa_id: 1 },
        data: { status: 'tidak aktif' },
      });
    });

    test('✅ Berhasil toggle status dari tidak aktif ke aktif', async () => {
      // Mock mahasiswa dengan status tidak aktif
      prisma.mahasiswa.findUnique.mockResolvedValue({
        mahasiswa_id: 2,
        nim: '2111002',
        nama: 'Test User 2',
        status: 'tidak aktif',
      });

      // Mock update
      prisma.mahasiswa.update.mockResolvedValue({
        mahasiswa_id: 2,
        status: 'aktif',
      });

      const res = await request(app).post('/pengelola/dataPenghuni/toggle/2');

      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toMatch(/success=/);
      const decodedLocation = decodeURIComponent(res.headers.location);
      expect(decodedLocation).toMatch(/aktif/i);
      expect(prisma.mahasiswa.update).toHaveBeenCalledWith({
        where: { mahasiswa_id: 2 },
        data: { status: 'aktif' },
      });
    });
  });

  // ==============================================
  // TEST: GET /pengelola/dataPenghuni/get/:id
  // ==============================================
  describe('GET /pengelola/dataPenghuni/get/:id', () => {
    test('❌ Gagal jika mahasiswa tidak ditemukan', async () => {
      prisma.mahasiswa.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get('/pengelola/dataPenghuni/get/999')
        .set('Accept', 'application/json');

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/tidak ditemukan/i);
    });

    test('✅ Berhasil mengambil data penghuni by ID', async () => {
      const mockMahasiswa = {
        mahasiswa_id: 1,
        nim: '2111001',
        nama: 'Budi Santoso',
        jurusan: 'Teknik Informatika',
        status: 'aktif',
        kipk: 'ya',
        foto: '/image/mahasiswa/budi.jpg',
        user_id: 'mahasiswa_001',
        user: {
          email: '2111001@student.unand.ac.id',
        },
      };

      prisma.mahasiswa.findUnique.mockResolvedValue(mockMahasiswa);

      const res = await request(app)
        .get('/pengelola/dataPenghuni/get/1')
        .set('Accept', 'application/json');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockMahasiswa);
      expect(prisma.mahasiswa.findUnique).toHaveBeenCalledWith({
        where: { mahasiswa_id: 1 },
        include: {
          user: {
            select: {
              email: true,
            },
          },
        },
      });
    });
  });

  // ==============================================
  // TEST: Error Handling
  // ==============================================
  describe('Error Handling', () => {
    test('❌ Menangani error database saat tambah penghuni', async () => {
      prisma.mahasiswa.findUnique.mockResolvedValue(null);
      prisma.user.create.mockRejectedValue(
        new Error('Database connection error')
      );

      const res = await request(app)
        .post('/pengelola/dataPenghuni/tambah')
        .send({
          nama: 'Test User',
          nim: '2111999',
          jurusan: 'Test Major',
          status: 'aktif',
        });

      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toMatch(/error=/);
      const decodedLocation = decodeURIComponent(res.headers.location);
      expect(decodedLocation).toMatch(/Terjadi kesalahan/i);
    });

    test('❌ Menangani error database saat edit penghuni', async () => {
      prisma.mahasiswa.findUnique.mockResolvedValue({
        mahasiswa_id: 1,
        nim: '2111001',
        user_id: 'mahasiswa_001',
      });
      prisma.mahasiswa.findFirst.mockResolvedValue(null);
      prisma.mahasiswa.update.mockRejectedValue(
        new Error('Update failed')
      );

      const res = await request(app)
        .post('/pengelola/dataPenghuni/edit')
        .send({
          mahasiswa_id: '1',
          nama: 'Updated Name',
          nim: '2111001',
          jurusan: 'Updated Major',
          status: 'aktif',
        });

      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toMatch(/error=/);
    });

    test('❌ Menangani error saat get penghuni by ID', async () => {
      prisma.mahasiswa.findUnique.mockRejectedValue(
        new Error('Database error')
      );

      const res = await request(app)
        .get('/pengelola/dataPenghuni/get/1')
        .set('Accept', 'application/json');

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBeTruthy();
    });
  });
});