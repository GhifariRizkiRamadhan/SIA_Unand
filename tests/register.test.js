/**
 * @file tests/register.test.js
 * Pengujian endpoint POST /register menggunakan Jest + Supertest
 */

process.env.NODE_ENV = 'test'; // Nonaktifkan EJS render saat testing

const path = require('path');
const request = require('supertest');
const fs = require('fs');

// Mock res.render supaya tidak benar-benar merender file EJS
jest.spyOn(require('express').response, 'render').mockImplementation(function (view, options) {
  // kirim text kecil agar Supertest tidak error ECONNRESET
  const msg = options?.error || options?.success || '';
  this.status(200).send(`Render: ${view} - ${msg}`);
});


let app;
let User;

// =============================
// 🚀 Inisialisasi Mock & App
// =============================
beforeAll(() => {
  jest.isolateModules(() => {
    // Mock auth middleware
    jest.mock('../middlewares/authMiddleware', () =>
      require('./__mocks__/middlewares/authMiddleware.js')
    );

    // Mock multer config
    jest.mock('../config/multerConfig', () =>
      require('./__mocks__/config/multerConfig.js')
    );

    // Mock userModels
    jest.mock('../models/userModels', () =>
      require('./__mocks__/models/userModels.js')
    );

    // Mock prisma
    jest.mock('../config/database', () => ({
      prisma: require('./__mocks__/prisma'),
    }));

    // Mock fs
    jest.mock('fs', () => {
      const originalFs = jest.requireActual('fs');
      return {
        ...originalFs,
        unlinkSync: jest.fn(),
      };
    });

    ({ app } = require('../app'));
    User = require('../models/userModels');
  });
});

// Patch response.end supaya ECONNRESET tidak muncul
const resProto = require('express').response;
const originalEnd = resProto.end;
resProto.end = function (...args) {
  try { return originalEnd.apply(this, args); } catch { return; }
};

jest.setTimeout(10000);


// =============================
// 🚀 TEST SUITE
// =============================
describe('🧍‍♂️ Register API Test (Jest + Supertest)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------
  // TEST 1 - Field kosong
  // ---------------------------
  test('❌ Gagal jika ada field kosong', async () => {
    const res = await request(app)
      .post('/register')
      .field('name', '')
      .field('email', 'test@mail.com')
      .field('password', '123456')
      .field('confirmPassword', '123456')
      .field('nim', '123')
      .field('jurusan', 'SI');

    expect(res.statusCode).toBe(200);
    expect(res.text).toMatch(/Semua field harus diisi/i);
  });

  // ---------------------------
  // TEST 2 - Tidak upload foto
  // ---------------------------
  test('❌ Gagal jika tidak upload foto', async () => {
    const res = await request(app)
      .post('/register')
      .field('name', 'Ghifari')
      .field('email', 'test@mail.com')
      .field('password', '123456')
      .field('confirmPassword', '123456')
      .field('nim', '123')
      .field('jurusan', 'Sistem Informasi'); // semua field lengkap

    expect(res.statusCode).toBe(200);
    expect(res.text).toMatch(/Foto mahasiswa wajib diupload/i);
  });

  // ---------------------------
  // TEST 3 - Password tidak cocok
  // ---------------------------
  test('❌ Gagal jika password dan konfirmasi tidak cocok', async () => {
    const res = await request(app)
      .post('/register')
      .field('name', 'Ghifari')
      .field('email', 'test@mail.com')
      .field('password', '123456')
      .field('confirmPassword', '654321')
      .field('nim', '123')
      .field('jurusan', 'SI')
      .attach('foto', path.resolve(__dirname, '__mocks__/dummy.png'));

    expect(res.text).toMatch(/Password dan konfirmasi password tidak cocok/i);
    expect(fs.unlinkSync).toHaveBeenCalled();
  });

  // ---------------------------
  // TEST 4 - Email sudah terdaftar
  // ---------------------------
  test('❌ Gagal jika email sudah terdaftar', async () => {
    User.emailExists.mockResolvedValue(true);
    User.nimExists.mockResolvedValue(false);

    const res = await request(app)
      .post('/register')
      .field('name', 'Ghifari')
      .field('email', 'sudah@mail.com')
      .field('password', '123456')
      .field('confirmPassword', '123456')
      .field('nim', '123')
      .field('jurusan', 'SI')
      .attach('foto', path.resolve(__dirname, '__mocks__/dummy.png'));

    expect(res.text).toMatch(/Email sudah terdaftar/i);
    expect(fs.unlinkSync).toHaveBeenCalled();
  });

  // ---------------------------
  // TEST 5 - NIM sudah terdaftar
  // ---------------------------
  test('❌ Gagal jika NIM sudah terdaftar', async () => {
    User.emailExists.mockResolvedValue(false);
    User.nimExists.mockResolvedValue(true);

    const res = await request(app)
      .post('/register')
      .field('name', 'Ghifari')
      .field('email', 'baru@mail.com')
      .field('password', '123456')
      .field('confirmPassword', '123456')
      .field('nim', '123')
      .field('jurusan', 'SI')
      .attach('foto', path.resolve(__dirname, '__mocks__/dummy.png'));

    expect(res.text).toMatch(/NIM sudah terdaftar/i);
    expect(fs.unlinkSync).toHaveBeenCalled();
  });

  // ---------------------------
  // TEST 6 - Registrasi berhasil
  // ---------------------------
  test('✅ Berhasil registrasi dengan data valid', async () => {
    User.emailExists.mockResolvedValue(false);
    User.nimExists.mockResolvedValue(false);
    User.create.mockResolvedValue({
      user_id: 'mahasiswa_123',
      name: 'Ghifari',
      email: 'baru@mail.com',
    });

    const res = await request(app)
      .post('/register')
      .field('name', 'Ghifari')
      .field('email', 'baru@mail.com')
      .field('password', '123456')
      .field('confirmPassword', '123456')
      .field('nim', '321')
      .field('jurusan', 'SI')
      .attach('foto', path.resolve(__dirname, '__mocks__/dummy.png'));

    expect(User.create).toHaveBeenCalled();
    expect(res.text).toMatch(/Registrasi berhasil/i);
  });
});