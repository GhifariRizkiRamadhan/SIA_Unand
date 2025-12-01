/**
 * @file tests/unit/conRegis.unit.test.js
 * Unit tests untuk controller conRegis.js (regcon)
 */

process.env.NODE_ENV = "test";

// --- MOCKS harus dideklarasikan SEBELUM require controller yang memakai User ---
// Mock manual untuk models/userModels supaya Prisma tidak ter-load
const mockUser = {
  emailExists: jest.fn(),
  nimExists: jest.fn(),
  create: jest.fn(),
};
jest.mock("../../models/userModels", () => mockUser);

// Mock fs: gunakan actual fs tetapi override unlinkSync
jest.mock("fs", () => {
  const realFs = jest.requireActual("fs");
  return {
    ...realFs,
    unlinkSync: jest.fn(),
  };
});

// Sekarang require module yang akan diuji
const fs = require("fs");
const User = require("../../models/userModels");
const { regcon } = require("../../controller/conRegis");

// helper mock res
function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.render = jest.fn().mockReturnValue(res);
  return res;
}

// helper req factory
function makeReq(body = {}, file = null) {
  const req = { body };
  if (file) req.file = file;
  return req;
}

describe("Unit: regcon (register controller)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // pastikan unlinkSync adalah mock (dari jest.mock('fs',...))
    fs.unlinkSync = fs.unlinkSync || jest.fn();
  });

  test("showRegis -> render register page", async () => {
    const req = {};
    const res = makeRes();

    await regcon.showRegis(req, res);

    expect(res.render).toHaveBeenCalledWith("register", {
      activePage: "register",
      error: null,
      success: null,
    });
  });

  test("❌ Field kosong -> render error and unlink if file present", async () => {
    const file = { path: "/tmp/uploaded.png", filename: "uploaded.png" };
    const req = makeReq({ name: "", email: "a@b", password: "123", confirmPassword: "123", nim: "11", jurusan: "SI" }, file);
    const res = makeRes();

    await regcon.register(req, res);

    expect(res.render).toHaveBeenCalledWith("register", {
      activePage: "register",
      error: "Semua field harus diisi",
      success: null,
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/uploaded.png");
  });

  test("❌ Tidak upload foto -> render error", async () => {
    const req = makeReq({
      name: "A",
      email: "a@mail",
      password: "123456",
      confirmPassword: "123456",
      nim: "11",
      jurusan: "SI"
    }, null);
    const res = makeRes();

    await regcon.register(req, res);

    expect(res.render).toHaveBeenCalledWith("register", {
      activePage: "register",
      error: "Foto mahasiswa wajib diupload",
      success: null,
    });
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });

  test("❌ Password tidak cocok -> render error and unlink", async () => {
    const file = { path: "/tmp/p.png", filename: "p.png" };
    const req = makeReq({
      name: "A",
      email: "a@mail",
      password: "123456",
      confirmPassword: "654321",
      nim: "11",
      jurusan: "SI"
    }, file);
    const res = makeRes();

    await regcon.register(req, res);

    expect(res.render).toHaveBeenCalledWith("register", {
      activePage: "register",
      error: "Password dan konfirmasi password tidak cocok",
      success: null,
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/p.png");
  });

  test("❌ Password terlalu pendek -> render error and unlink", async () => {
    const file = { path: "/tmp/short.png", filename: "short.png" };
    const req = makeReq({
      name: "A",
      email: "a@mail",
      password: "123",
      confirmPassword: "123",
      nim: "11",
      jurusan: "SI"
    }, file);
    const res = makeRes();

    await regcon.register(req, res);

    expect(res.render).toHaveBeenCalledWith("register", {
      activePage: "register",
      error: "Password minimal 6 karakter",
      success: null,
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/short.png");
  });

  test("❌ Email sudah terdaftar -> render error and unlink", async () => {
    const file = { path: "/tmp/e.png", filename: "e.png" };
    const req = makeReq({
      name: "A",
      email: "exist@mail",
      password: "123456",
      confirmPassword: "123456",
      nim: "11",
      jurusan: "SI"
    }, file);
    const res = makeRes();

    User.emailExists.mockResolvedValue(true);
    User.nimExists.mockResolvedValue(false);

    await regcon.register(req, res);

    expect(User.emailExists).toHaveBeenCalledWith("exist@mail");
    expect(res.render).toHaveBeenCalledWith("register", {
      activePage: "register",
      error: "Email sudah terdaftar",
      success: null,
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/e.png");
  });

  test("❌ NIM sudah terdaftar -> render error and unlink", async () => {
    const file = { path: "/tmp/n.png", filename: "n.png" };
    const req = makeReq({
      name: "A",
      email: "new@mail",
      password: "123456",
      confirmPassword: "123456",
      nim: "existnim",
      jurusan: "SI"
    }, file);
    const res = makeRes();

    User.emailExists.mockResolvedValue(false);
    User.nimExists.mockResolvedValue(true);

    await regcon.register(req, res);

    expect(User.nimExists).toHaveBeenCalledWith("existnim");
    expect(res.render).toHaveBeenCalledWith("register", {
      activePage: "register",
      error: "NIM sudah terdaftar",
      success: null,
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/n.png");
  });

  test("✅ Registrasi berhasil -> create dipanggil dan render login success", async () => {
    const file = { path: "/tmp/succ.png", filename: "succ.png" };
    const req = makeReq({
      name: "Ghifari",
      email: "baru@mail.com",
      password: "123456",
      confirmPassword: "123456",
      nim: "321",
      jurusan: "SI"
    }, file);
    const res = makeRes();

    User.emailExists.mockResolvedValue(false);
    User.nimExists.mockResolvedValue(false);
    User.create.mockResolvedValue({
      user_id: "mahasiswa_123",
      name: "Ghifari",
      email: "baru@mail.com",
    });

    await regcon.register(req, res);

    // after success should render login with success message
    expect(User.create).toHaveBeenCalled();
    expect(res.render).toHaveBeenCalledWith("login", {
      activePage: "login",
      error: null,
      success: "Registrasi berhasil! Silakan login dengan akun Anda."
    });
    // tidak harus menghapus file pada flow sukses
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });

  test("❌ Error saat create -> unlink dipanggil dan render error", async () => {
    const file = { path: "/tmp/err.png", filename: "err.png" };
    const req = makeReq({
      name: "A",
      email: "err@mail",
      password: "123456",
      confirmPassword: "123456",
      nim: "999",
      jurusan: "SI"
    }, file);
    const res = makeRes();

    User.emailExists.mockResolvedValue(false);
    User.nimExists.mockResolvedValue(false);
    User.create.mockRejectedValue(new Error("DB error"));

    await regcon.register(req, res);

    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/err.png");
    expect(res.render).toHaveBeenCalledWith("register", {
      activePage: "register",
      error: expect.stringContaining("Terjadi kesalahan server"),
      success: null,
    });
  });
});
