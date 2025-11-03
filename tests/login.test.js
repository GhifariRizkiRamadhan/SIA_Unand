/**
 * @file tests/login.test.js
 * Menguji endpoint POST /login
 */
const request = require('supertest');
const { app }= require('../app'); // app.js ada di root

// 🧩 Mock semua dependency internal
jest.mock('../models/userModels');
jest.mock('../config/database', () => ({
  prisma: require('./__mocks__/prisma'),
}));
jest.mock('bcrypt'); // ✅ cukup begini — Jest otomatis cari di __mocks__/bcrypt.js

const User = require('../models/userModels');

describe('🔐 Login API Test (Jest + Supertest)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('❌ Gagal jika email/password kosong', async () => {
    const res = await request(app)
      .post('/login')
      .set('Accept', 'application/json')
      .send({ email: '', password: '' });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/harus diisi/i);
  });

  test('❌ Gagal jika user tidak ditemukan', async () => {
    User.findByEmail.mockResolvedValue(null);

    const res = await request(app)
      .post('/login')
      .set('Accept', 'application/json')
      .send({ email: 'notfound@mail.com', password: '1234' });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/salah/i);
  });

  test('❌ Gagal jika password salah', async () => {
    const fakeUser = {
      user_id: 1,
      email: 'test@mail.com',
      password: 'hashedPassword',
      role: 'mahasiswa',
      name: 'Ghifari',
    };
    User.findByEmail.mockResolvedValue(fakeUser);
    User.verifyPassword.mockResolvedValue(false);

    const res = await request(app)
      .post('/login')
      .set('Accept', 'application/json')
      .send({ email: 'test@mail.com', password: 'salah' });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('✅ Berhasil login jika email dan password benar', async () => {
    const fakeUser = {
      user_id: 1,
      email: 'admin@mail.com',
      password: 'hashedPassword',
      role: 'pengelola',
      name: 'Admin',
    };
    User.findByEmail.mockResolvedValue(fakeUser);
    User.verifyPassword.mockResolvedValue(true);

    const res = await request(app)
      .post('/login')
      .set('Accept', 'application/json')
      .send({ email: 'admin@mail.com', password: '1234' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.role).toBe('pengelola');
  });
});