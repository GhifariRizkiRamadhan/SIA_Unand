/**
 * @file tests/unit/conRegis.unit.test.js
 * Unit tests untuk controller conRegis.js (regcon)
 */

process.env.NODE_ENV = "test";

// --- MOCKS ---
const mockUser = {
  emailExists: jest.fn(),
  nimExists: jest.fn(),
  create: jest.fn(),
};
jest.mock("../../models/userModels", () => mockUser);

// Mock fs explicitly using the factory correctly
jest.mock("fs", () => {
  return {
    unlinkSync: jest.fn(),
    // Include other methods if needed, or use requireActual if the controller uses other fs methods
    // ...jest.requireActual("fs"),
  };
});

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

  // Covers Line 25: if (req.file) inside validation error
  test("❌ Field kosong -> render error and unlink if file present", async () => {
    const file = { path: "/tmp/uploaded.png", filename: "uploaded.png" };
    // Missing 'jurusan' to trigger validation error
    const req = makeReq({ name: "A", email: "a@b", password: "123", confirmPassword: "123", nim: "11" }, file);
    const res = makeRes();

    await regcon.register(req, res);

    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/uploaded.png");
    expect(res.render).toHaveBeenCalledWith("register", expect.objectContaining({
      error: "Semua field harus diisi",
    }));
  });

  // Covers Line 46: if (req.file) inside password mismatch
  test("❌ Password tidak cocok -> render error and unlink", async () => {
    const file = { path: "/tmp/p.png", filename: "p.png" };
    const req = makeReq({
      name: "A",
      email: "a@mail",
      password: "123",
      confirmPassword: "321",
      nim: "11",
      jurusan: "SI"
    }, file);
    const res = makeRes();

    await regcon.register(req, res);

    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/p.png");
    expect(res.render).toHaveBeenCalledWith("register", expect.objectContaining({
      error: "Password dan konfirmasi password tidak cocok",
    }));
  });

  // Covers Line 58: if (req.file) inside password length check
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

    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/short.png");
    expect(res.render).toHaveBeenCalledWith("register", expect.objectContaining({
      error: "Password minimal 6 karakter",
    }));
  });

  // Covers Line 71: if (req.file) inside email exists check
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

    await regcon.register(req, res);

    expect(User.emailExists).toHaveBeenCalledWith("exist@mail");
    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/e.png");
    expect(res.render).toHaveBeenCalledWith("register", expect.objectContaining({
      error: "Email sudah terdaftar",
    }));
  });

  // Covers Lines 84-127: NIM exists check and Success Flow
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
    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/n.png");
    expect(res.render).toHaveBeenCalledWith("register", expect.objectContaining({
      error: "NIM sudah terdaftar",
    }));
  });

  test("✅ Registrasi berhasil -> create user and render login success", async () => {
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

    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
      name: "Ghifari",
      email: "baru@mail.com",
      role: "mahasiswa",
      foto: "/image/mahasiswa/succ.png"
    }));
    expect(res.render).toHaveBeenCalledWith("login", {
      activePage: "login",
      error: null,
      success: "Registrasi berhasil! Silakan login dengan akun Anda."
    });
    // Should NOT unlink on success
    expect(fs.unlinkSync).not.toHaveBeenCalled();
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

    expect(res.render).toHaveBeenCalledWith("register", expect.objectContaining({
      error: "Foto mahasiswa wajib diupload",
    }));
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
    expect(res.render).toHaveBeenCalledWith("register", expect.objectContaining({
      error: expect.stringContaining("Terjadi kesalahan server"),
    }));
  });

  test("❌ Error saat create -> unlink gagal -> log error (catch block)", async () => {
    const file = { path: "/tmp/err2.png", filename: "err2.png" };
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

    // Mock unlinkSync to throw error ONLY for this test
    fs.unlinkSync.mockImplementationOnce(() => { throw new Error("Unlink Fail"); });

    await regcon.register(req, res);

    expect(res.render).toHaveBeenCalledWith("register", expect.objectContaining({
      error: expect.stringContaining("Terjadi kesalahan server"),
    }));
  });

  test("showRegis error -> 500 json", async () => {
    const req = {};
    const res = makeRes();
    res.render.mockImplementation(() => { throw new Error("Render error"); });

    await regcon.showRegis(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: "Render error" }));
  });

});
