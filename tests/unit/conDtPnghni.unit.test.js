/**
 * @file tests/unit/conDtPnghni.unit.test.js
 * Unit tests untuk controller conDtPnghni.js
 */

process.env.NODE_ENV = "test";

// -----------------------------
// MOCKS
// -----------------------------

const mockFindMany = jest.fn();
const mockFindUnique = jest.fn();
const mockFindFirst = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockUserCreate = jest.fn();
const mockUserUpdate = jest.fn();
const mockFindById = jest.fn();
const mockHash = jest.fn().mockResolvedValue("hashedPassword");
const mockRenderFile = jest.fn().mockResolvedValue("<div>body-html</div>");
const mockUnlinkSync = jest.fn();
const mockExistsSync = jest.fn().mockReturnValue(false);

jest.mock("../../config/database", () => ({
  prisma: {
    mahasiswa: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      findFirst: mockFindFirst,
      create: mockCreate,
      update: mockUpdate,
    },
    user: {
      create: mockUserCreate,
      update: mockUserUpdate,
    },
  },
}));

jest.mock("../../models/userModels", () => ({
  findById: mockFindById,
}));

jest.mock("bcrypt", () => ({
  hash: mockHash,
}));

jest.mock("ejs", () => ({
  renderFile: mockRenderFile,
}));

jest.mock("path", () => ({
  join: jest.fn((...args) => args.join("/")),
  resolve: jest.fn((...args) => args.join("/")),
  dirname: jest.fn(() => "/mock/dir"),
}));

jest.mock("fs", () => {
  const realFs = jest.requireActual("fs");
  return {
    ...realFs,
    unlinkSync: mockUnlinkSync,
    existsSync: mockExistsSync,
  };
});

// -----------------------------
// REQUIRE
// -----------------------------
const bcrypt = require("bcrypt");
const ejs = require("ejs");
const fs = require("fs");
const path = require("path");
const User = require("../../models/userModels");
const { prisma } = require("../../config/database");
const {
  showDtPenghuni,
  tambahPenghuni,
  editPenghuni,
  toggleStatusPenghuni,
  getPenghuniById,
} = require("../../controller/conDtPnghni");

// -----------------------------
// HELPERS
// -----------------------------
function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.render = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  return res;
}

function makeReq(body = {}, opts = {}) {
  const req = {
    body,
    params: opts.params || {},
    query: opts.query || {},
    file: opts.file || null,
    session: opts.session || {},
    user: opts.user || null
  };
  return req;
}

// -----------------------------
// TESTS
// -----------------------------
describe("Unit: conDtPnghni controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockFindUnique.mockResolvedValue(null);
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue(null);
    mockUpdate.mockResolvedValue(null);
    mockUserCreate.mockResolvedValue(null);
    mockUserUpdate.mockResolvedValue(null);
    mockFindById.mockResolvedValue(null);
    mockRenderFile.mockResolvedValue("<div>body-html</div>");
    mockExistsSync.mockReturnValue(false);
    mockUnlinkSync.mockImplementation(() => { }); // Reset to no-op
  });

  test("DEBUG: Prisma mock should work", async () => {
    mockFindUnique.mockResolvedValueOnce("DEBUG_VALUE");
    const result = await prisma.mahasiswa.findUnique({ where: { id: 1 } });
    expect(result).toBe("DEBUG_VALUE");
  });

  // --- showDtPenghuni ---
  test("showDtPenghuni: redirect to /login if no user", async () => {
    const req = makeReq();
    const res = makeRes();
    await showDtPenghuni(req, res);
    expect(res.redirect).toHaveBeenCalledWith("/login");
  });

  test("showDtPenghuni: render page if user exists", async () => {
    const fakeUser = { user_id: "u1", name: "Admin", role: "pengelola" };
    mockFindById.mockResolvedValue(fakeUser);
    const req = makeReq({}, { session: { user_id: "u1" } });
    const res = makeRes();

    await showDtPenghuni(req, res);

    expect(res.render).toHaveBeenCalledWith("layouts/main", expect.anything());
  });

  test("showDtPenghuni: handle errors", async () => {
    const req = makeReq({}, { session: { user_id: "u1" } });
    const res = makeRes();
    mockFindById.mockRejectedValue(new Error("DB Error"));

    await showDtPenghuni(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.render).toHaveBeenCalledWith("error", expect.anything());
  });

  // --- tambahPenghuni ---
  test("tambahPenghuni: validation error (missing fields) -> unlink file if present", async () => {
    const file = { path: "/tmp/f.png", filename: "f.png" };
    const req = makeReq({ nama: "" }, { file });
    const res = makeRes();

    await tambahPenghuni(req, res);

    expect(mockUnlinkSync).toHaveBeenCalledWith("/tmp/f.png");
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("error="));
  });

  test("tambahPenghuni: nim exists -> unlink file if present", async () => {
    const file = { path: "/tmp/f.png", filename: "f.png" };
    const req = makeReq({ nama: "A", nim: "123", jurusan: "SI" }, { file });
    const res = makeRes();
    mockFindUnique.mockResolvedValueOnce({ nim: "123" });

    await tambahPenghuni(req, res);

    expect(mockUnlinkSync).toHaveBeenCalledWith("/tmp/f.png");
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("NIM%20sudah%20terdaftar"));
  });

  test("tambahPenghuni: success with file", async () => {
    const file = { path: "/tmp/f.png", filename: "f.png" };
    const req = makeReq({ nama: "A", nim: "123", jurusan: "SI" }, { file });
    const res = makeRes();
    mockFindUnique.mockResolvedValueOnce(null);

    await tambahPenghuni(req, res);

    expect(mockUserCreate).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ foto: "/image/mahasiswa/f.png" })
    }));
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("success="));
  });

  test("tambahPenghuni: success without file", async () => {
    const req = makeReq({ nama: "A", nim: "123", jurusan: "SI" });
    const res = makeRes();
    mockFindUnique.mockResolvedValueOnce(null);

    await tambahPenghuni(req, res);

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ foto: null })
    }));
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("success="));
  });

  test("tambahPenghuni: error during create -> unlink file", async () => {
    const file = { path: "/tmp/f.png", filename: "f.png" };
    const req = makeReq({ nama: "A", nim: "123", jurusan: "SI" }, { file });
    const res = makeRes();
    mockFindUnique.mockResolvedValueOnce(null);
    mockUserCreate.mockRejectedValue(new Error("DB Error"));

    await tambahPenghuni(req, res);

    expect(mockUnlinkSync).toHaveBeenCalledWith("/tmp/f.png");
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("Terjadi%20kesalahan"));
  });

  test("tambahPenghuni: error during create -> unlink fails -> log error", async () => {
    const file = { path: "/tmp/f.png", filename: "f.png" };
    const req = makeReq({ nama: "A", nim: "123", jurusan: "SI" }, { file });
    const res = makeRes();
    mockFindUnique.mockResolvedValueOnce(null);
    mockUserCreate.mockRejectedValue(new Error("DB Error"));
    mockUnlinkSync.mockImplementationOnce(() => { throw new Error("Unlink Error"); });

    await tambahPenghuni(req, res);

    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("Terjadi%20kesalahan"));
  });

  // --- editPenghuni ---
  test("editPenghuni: validation error -> unlink file", async () => {
    const file = { path: "/tmp/f.png", filename: "f.png" };
    const req = makeReq({ nama: "" }, { file });
    const res = makeRes();

    await editPenghuni(req, res);

    expect(mockUnlinkSync).toHaveBeenCalledWith("/tmp/f.png");
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("error="));
  });

  test("editPenghuni: not found -> unlink file", async () => {
    const file = { path: "/tmp/f.png", filename: "f.png" };
    const req = makeReq({ mahasiswa_id: "99", nama: "A", nim: "1", jurusan: "SI", status: "aktif" }, { file });
    const res = makeRes();
    mockFindUnique.mockResolvedValueOnce(null);

    await editPenghuni(req, res);

    expect(mockUnlinkSync).toHaveBeenCalledWith("/tmp/f.png");
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("tidak%20ditemukan"));
  });

  test("editPenghuni: nim exists -> unlink file", async () => {
    const file = { path: "/tmp/f.png", filename: "f.png" };
    const req = makeReq({ mahasiswa_id: "1", nama: "A", nim: "2", jurusan: "SI", status: "aktif" }, { file });
    const res = makeRes();
    mockFindUnique.mockResolvedValueOnce({ mahasiswa_id: 1 });
    mockFindFirst.mockResolvedValueOnce({ mahasiswa_id: 2 });

    await editPenghuni(req, res);

    expect(mockUnlinkSync).toHaveBeenCalledWith("/tmp/f.png");
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("NIM%20sudah%20digunakan"));
  });

  test("editPenghuni: success with file -> delete old photo", async () => {
    const file = { path: "/tmp/new.png", filename: "new.png" };
    const req = makeReq({ mahasiswa_id: "1", nama: "A", nim: "1", jurusan: "SI", status: "aktif" }, { file });
    const res = makeRes();
    mockFindUnique.mockResolvedValueOnce({ mahasiswa_id: 1, foto: "old.png", user_id: "u1" });
    mockFindFirst.mockResolvedValueOnce(null);
    mockExistsSync.mockReturnValue(true);

    await editPenghuni(req, res);

    expect(mockUnlinkSync).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("success="));
  });

  test("editPenghuni: success with file -> old photo not found (no unlink)", async () => {
    const file = { path: "/tmp/new.png", filename: "new.png" };
    const req = makeReq({ mahasiswa_id: "1", nama: "A", nim: "1", jurusan: "SI", status: "aktif" }, { file });
    const res = makeRes();
    mockFindUnique.mockResolvedValueOnce({ mahasiswa_id: 1, foto: "old.png", user_id: "u1" });
    mockFindFirst.mockResolvedValueOnce(null);
    mockExistsSync.mockReturnValue(false); // Old file doesn't exist

    await editPenghuni(req, res);

    expect(mockUnlinkSync).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("success="));
  });

  test("editPenghuni: success with file -> no old photo (no unlink)", async () => {
    const file = { path: "/tmp/new.png", filename: "new.png" };
    const req = makeReq({ mahasiswa_id: "1", nama: "A", nim: "1", jurusan: "SI", status: "aktif" }, { file });
    const res = makeRes();
    mockFindUnique.mockResolvedValueOnce({ mahasiswa_id: 1, foto: null, user_id: "u1" }); // No old photo
    mockFindFirst.mockResolvedValueOnce(null);

    await editPenghuni(req, res);

    expect(mockUnlinkSync).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("success="));
  });

  test("editPenghuni: success without file", async () => {
    const req = makeReq({ mahasiswa_id: "1", nama: "A", nim: "1", jurusan: "SI", status: "aktif" });
    const res = makeRes();
    mockFindUnique.mockResolvedValueOnce({ mahasiswa_id: 1, foto: "old.png", user_id: "u1" });
    mockFindFirst.mockResolvedValueOnce(null);

    await editPenghuni(req, res);

    expect(mockUnlinkSync).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("success="));
  });

  test("editPenghuni: error -> unlink uploaded file", async () => {
    const file = { path: "/tmp/f.png", filename: "f.png" };
    const req = makeReq({ mahasiswa_id: "1", nama: "A", nim: "1", jurusan: "SI", status: "aktif" }, { file });
    const res = makeRes();
    mockFindUnique.mockRejectedValue(new Error("DB Error"));

    await editPenghuni(req, res);

    expect(mockUnlinkSync).toHaveBeenCalledWith("/tmp/f.png");
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("Terjadi%20kesalahan"));
  });

  test("editPenghuni: error -> unlink uploaded file fails -> log error", async () => {
    const file = { path: "/tmp/f.png", filename: "f.png" };
    const req = makeReq({ mahasiswa_id: "1", nama: "A", nim: "1", jurusan: "SI", status: "aktif" }, { file });
    const res = makeRes();
    mockFindUnique.mockRejectedValue(new Error("DB Error"));
    mockUnlinkSync.mockImplementationOnce(() => { throw new Error("Unlink Error"); });

    await editPenghuni(req, res);

    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("Terjadi%20kesalahan"));
  });

  // --- toggleStatusPenghuni ---
  test("toggleStatusPenghuni: not found", async () => {
    const req = makeReq({}, { params: { mahasiswa_id: "99" } });
    const res = makeRes();
    mockFindUnique.mockResolvedValueOnce(null);

    await toggleStatusPenghuni(req, res);

    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("tidak%20ditemukan"));
  });

  test("toggleStatusPenghuni: success", async () => {
    const req = makeReq({}, { params: { mahasiswa_id: "1" } });
    const res = makeRes();
    mockFindUnique.mockResolvedValueOnce({ mahasiswa_id: 1, status: "aktif" });

    await toggleStatusPenghuni(req, res);

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: "tidak aktif" }
    }));
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("success="));
  });

  test("toggleStatusPenghuni: error", async () => {
    const req = makeReq({}, { params: { mahasiswa_id: "1" } });
    const res = makeRes();
    mockFindUnique.mockRejectedValue(new Error("DB Error"));

    await toggleStatusPenghuni(req, res);

    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("Terjadi%20kesalahan"));
  });

  // --- getPenghuniById ---
  test("getPenghuniById: not found", async () => {
    const req = makeReq({}, { params: { id: "99" } });
    const res = makeRes();
    mockFindUnique.mockResolvedValueOnce(null);

    await getPenghuniById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("getPenghuniById: success", async () => {
    const req = makeReq({}, { params: { id: "1" } });
    const res = makeRes();
    mockFindUnique.mockResolvedValueOnce({ mahasiswa_id: 1 });

    await getPenghuniById(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test("getPenghuniById: error", async () => {
    const req = makeReq({}, { params: { id: "1" } });
    const res = makeRes();
    mockFindUnique.mockRejectedValue(new Error("DB Error"));

    await getPenghuniById(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});