/**
 * @file tests/unit/conDtPnghni.unit.test.js
 * Unit tests untuk controller conDtPnghni.js
 */

process.env.NODE_ENV = "test";

// -----------------------------
// MOCKS (harus di-declare dulu)
// -----------------------------

// Mock Prisma-like object (dipakai oleh controller via require('../config/database').prisma)
const mockPrisma = {
  mahasiswa: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  user: {
    create: jest.fn(),
    update: jest.fn(),
  },
};
jest.mock("../../config/database", () => ({ prisma: mockPrisma }));

// Mock userModels (User.findById)
const mockUserModel = {
  findById: jest.fn(),
};
jest.mock("../../models/userModels", () => mockUserModel);

// Mock bcrypt (untuk hash)
jest.mock("bcrypt", () => ({
  hash: jest.fn().mockResolvedValue("hashedPassword"),
}));

// Mock ejs.renderFile supaya tidak membaca file ejs asli
jest.mock("ejs", () => ({
  renderFile: jest.fn().mockResolvedValue("<div>body-html</div>"),
}));

// Mock fs (unlinkSync, existsSync)
jest.mock("fs", () => {
  const realFs = jest.requireActual("fs");
  return {
    ...realFs,
    unlinkSync: jest.fn(),
    existsSync: jest.fn().mockReturnValue(false),
  };
});

// -----------------------------
// require setelah mocks
// -----------------------------
const bcrypt = require("bcrypt");
const ejs = require("ejs");
const fs = require("fs");
const User = require("../../models/userModels");
const { prisma } = require("../../config/database");
const {
  showDtPenghuni,
  tambahPenghuni,
  editPenghuni,
  toggleStatusPenghuni,
  getPenghuniById,
} = require("../../controller/conDtPnghni");

// helper: mock response object (chainable)
function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.render = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  return res;
}

// helper: make request skeletons
function makeReq(body = {}, opts = {}) {
  const req = { body, params: opts.params || {}, query: opts.query || {}, file: opts.file || null, session: opts.session || {}, user: opts.user || null };
  // convenience for originalUrl / get / is / xhr used in some controllers: not required here but safe
  req.get = opts.get || (() => null);
  req.is = opts.is || (() => false);
  return req;
}

// -----------------------------
// Test suite
// -----------------------------
describe("Unit: conDtPnghni controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // ensure default mock returns
    mockPrisma.mahasiswa.findMany.mockResolvedValue([]);
    mockPrisma.mahasiswa.findUnique.mockResolvedValue(null);
    mockPrisma.mahasiswa.findFirst.mockResolvedValue(null);
    mockPrisma.mahasiswa.create.mockResolvedValue(null);
    mockPrisma.mahasiswa.update.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(null);
    mockPrisma.user.update.mockResolvedValue(null);
    User.findById.mockResolvedValue(null);
    ejs.renderFile.mockResolvedValue("<div>body-html</div>");
    fs.existsSync.mockReturnValue(false);
  });

  // -------------------------
  // showDtPenghuni
  // -------------------------
  test("redirect to /login if no user in session or req.user", async () => {
    const req = makeReq();
    const res = makeRes();

    await showDtPenghuni(req, res);

    expect(res.redirect).toHaveBeenCalledWith("/login");
  });

  test("render layouts/main with body when user present", async () => {
    // prepare
    const fakeUser = { user_id: "pengelola_123", name: "Admin", role: "pengelola", avatar: null };
    User.findById.mockResolvedValue(fakeUser);

    const aktif = [{ mahasiswa_id: 1, nama: "A", user: { email: "a@mail" } }];
    const tidakAktif = [{ mahasiswa_id: 2, nama: "B", user: { email: "b@mail" } }];
    mockPrisma.mahasiswa.findMany
      .mockResolvedValueOnce(aktif) // first call for aktif
      .mockResolvedValueOnce(tidakAktif); // second call for tidak aktif

    const req = makeReq({}, { session: { user_id: "pengelola_123" }, query: {} });
    const res = makeRes();

    await showDtPenghuni(req, res);

    expect(User.findById).toHaveBeenCalledWith("pengelola_123");
    expect(mockPrisma.mahasiswa.findMany).toHaveBeenCalledTimes(2);
    expect(ejs.renderFile).toHaveBeenCalled();
    expect(res.render).toHaveBeenCalledWith("layouts/main", expect.objectContaining({
      title: expect.any(String),
      body: "<div>body-html</div>",
      user: expect.objectContaining({ name: "Admin", role: "pengelola" })
    }));
  });

  // -------------------------
  // tambahPenghuni
  // -------------------------
  test("tambahPenghuni: redirect error if missing required fields (and unlink file)", async () => {
    const file = { path: "/tmp/upload.png", filename: "upload.png" };
    const req = makeReq({ nama: "", nim: "", jurusan: "" }, { file });
    const res = makeRes();

    await tambahPenghuni(req, res);

    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/upload.png");
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("/pengelola/dataPenghuni?error="));
  });

  test("tambahPenghuni: redirect error if nim already exists", async () => {
    const file = { path: "/tmp/upload.png", filename: "upload.png" };
    mockPrisma.mahasiswa.findUnique.mockResolvedValue({ mahasiswa_id: 1, nim: "2111001" });

    const req = makeReq({ nama: "X", nim: "2111001", jurusan: "TI" }, { file });
    const res = makeRes();

    await tambahPenghuni(req, res);

    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/upload.png");
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("NIM%20sudah%20terdaftar"));
  });

  test("tambahPenghuni: success creates user and mahasiswa and redirects success", async () => {
    // mocks
    mockPrisma.mahasiswa.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ user_id: "maha_1" });
    mockPrisma.mahasiswa.create.mockResolvedValue({ mahasiswa_id: 10 });

    // spy on bcrypt.hash mock already returns "hashedPassword"
    const file = { path: "/tmp/upload.png", filename: "upload.png" };
    const req = makeReq({ nama: "Citra", nim: "2111003", jurusan: "TE", status: "aktif", kipk: "ya" }, { file });
    const res = makeRes();

    await tambahPenghuni(req, res);

    expect(bcrypt.hash).toHaveBeenCalledWith("2111003", 10);
    expect(mockPrisma.user.create).toHaveBeenCalled();
    expect(mockPrisma.mahasiswa.create).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("success="));
  });

  // -------------------------
  // editPenghuni
  // -------------------------
  test("editPenghuni: missing fields -> unlink and redirect error", async () => {
    const file = { path: "/tmp/f.png", filename: "f.png" };
    const req = makeReq({ mahasiswa_id: "", nama: "", nim: "", jurusan: "", status: "" }, { file });
    const res = makeRes();

    await editPenghuni(req, res);

    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/f.png");
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("Semua%20field%20harus%20diisi"));
  });

  test("editPenghuni: mahasiswa not found -> unlink and redirect error", async () => {
    mockPrisma.mahasiswa.findUnique.mockResolvedValue(null);
    const file = { path: "/tmp/f2.png", filename: "f2.png" };
    const req = makeReq({ mahasiswa_id: "999", nama: "U", nim: "2111999", jurusan: "Test", status: "aktif" }, { file });
    const res = makeRes();

    await editPenghuni(req, res);

    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/f2.png");
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("tidak%20ditemukan"));
  });

  test("editPenghuni: nim used by other -> unlink and redirect error", async () => {
    // existing mahasiswa being edited
    mockPrisma.mahasiswa.findUnique.mockResolvedValue({ mahasiswa_id: 1, nim: "2111001", user_id: "u1" });
    // findFirst finds another mahasiswa with same nim
    mockPrisma.mahasiswa.findFirst.mockResolvedValue({ mahasiswa_id: 2, nim: "2111002" });

    const req = makeReq({ mahasiswa_id: "1", nama: "New", nim: "2111002", jurusan: "TI", status: "aktif" }, {});
    const res = makeRes();

    await editPenghuni(req, res);

    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("NIM%20sudah%20digunakan"));
  });

  test("editPenghuni: success update mahasiswa and user, redirect success", async () => {
    mockPrisma.mahasiswa.findUnique.mockResolvedValue({
      mahasiswa_id: 1,
      nim: "2111001",
      nama: "Old Name",
      jurusan: "Old Major",
      status: "aktif",
      foto: null,
      user_id: "mahasiswa_001",
    });
    mockPrisma.mahasiswa.findFirst.mockResolvedValue(null);
    mockPrisma.mahasiswa.update.mockResolvedValue({ mahasiswa_id: 1 });
    mockPrisma.user.update.mockResolvedValue({ user_id: "mahasiswa_001" });

    const req = makeReq({ mahasiswa_id: "1", nama: "New Name", nim: "2111001", jurusan: "New Major", status: "aktif", kipk: "ya" }, {});
    const res = makeRes();

    await editPenghuni(req, res);

    expect(mockPrisma.mahasiswa.update).toHaveBeenCalled();
    expect(mockPrisma.user.update).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("success="));
  });

  // -------------------------
  // toggleStatusPenghuni
  // -------------------------
  test("toggleStatusPenghuni: mahasiswa not found -> redirect error", async () => {
    mockPrisma.mahasiswa.findUnique.mockResolvedValue(null);

    const req = makeReq({}, { params: { mahasiswa_id: "999" } });
    const res = makeRes();

    await toggleStatusPenghuni(req, res);

    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("tidak%20ditemukan"));
  });

  test("toggleStatusPenghuni: aktif -> tidak aktif", async () => {
    mockPrisma.mahasiswa.findUnique.mockResolvedValue({ mahasiswa_id: 1, status: "aktif" });
    mockPrisma.mahasiswa.update.mockResolvedValue({ mahasiswa_id: 1, status: "tidak aktif" });

    const req = makeReq({}, { params: { mahasiswa_id: "1" } });
    const res = makeRes();

    await toggleStatusPenghuni(req, res);

    expect(mockPrisma.mahasiswa.update).toHaveBeenCalledWith({
      where: { mahasiswa_id: 1 },
      data: { status: "tidak aktif" },
    });
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("tidak%20aktif"));
  });

  test("toggleStatusPenghuni: tidak aktif -> aktif", async () => {
    mockPrisma.mahasiswa.findUnique.mockResolvedValue({ mahasiswa_id: 2, status: "tidak aktif" });
    mockPrisma.mahasiswa.update.mockResolvedValue({ mahasiswa_id: 2, status: "aktif" });

    const req = makeReq({}, { params: { mahasiswa_id: "2" } });
    const res = makeRes();

    await toggleStatusPenghuni(req, res);

    expect(mockPrisma.mahasiswa.update).toHaveBeenCalledWith({
      where: { mahasiswa_id: 2 },
      data: { status: "aktif" },
    });
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("aktif"));
  });

  // -------------------------
  // getPenghuniById
  // -------------------------
  test("getPenghuniById: 404 when not found", async () => {
    mockPrisma.mahasiswa.findUnique.mockResolvedValue(null);

    const req = makeReq({}, { params: { id: "999" } });
    const res = makeRes();

    await getPenghuniById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  test("getPenghuniById: success returns mahasiswa", async () => {
    const mockMahasiswa = {
      mahasiswa_id: 1,
      nim: "2111001",
      nama: "Budi",
      user: { email: "2111001@student.unand.ac.id" },
    };
    mockPrisma.mahasiswa.findUnique.mockResolvedValue(mockMahasiswa);

    const req = makeReq({}, { params: { id: "1" } });
    const res = makeRes();

    await getPenghuniById(req, res);

    expect(res.json).toHaveBeenCalledWith({ success: true, data: mockMahasiswa });
    expect(res.status).not.toHaveBeenCalledWith(500);
  });

  // -------------------------
  // error handling branches (example: prisma throws)
  // -------------------------
  test("tambahPenghuni: error during create -> unlink and redirect with error", async () => {
    mockPrisma.mahasiswa.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockRejectedValue(new Error("DB fail"));

    const file = { path: "/tmp/err_create.png", filename: "err_create.png" };
    const req = makeReq({ nama: "Err", nim: "999", jurusan: "TI" }, { file });
    const res = makeRes();

    await tambahPenghuni(req, res);

    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/err_create.png");
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("Terjadi%20kesalahan"));
  });

});