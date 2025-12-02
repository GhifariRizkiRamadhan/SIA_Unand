/**
 * @file tests/unit/conIzinKeluar.unit.test.js
 * Unit tests for controllers/conIzinKeluar.js
 */

process.env.NODE_ENV = "test";

// Mock dependencies
jest.mock("../../models/userModels");
jest.mock("../../config/database", () => ({
    prisma: {
        mahasiswa: { findUnique: jest.fn() },
        izinkeluar: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    },
}));
jest.mock("../../controller/notification", () => ({
    createIzinKeluarNotification: jest.fn().mockResolvedValue({}),
}));
jest.mock("ejs");

const ejs = require("ejs");
const { prisma } = require("../../config/database");
const { createIzinKeluarNotification } = require("../../controller/notification");
const controller = require("../../controller/conIzinKeluar");

// Helper to create mock response
function makeRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.render = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
    return res;
}

describe("Unit: conIzinKeluar", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("showFormMahasiswa", () => {
        test("should render form for mahasiswa", async () => {
            const req = { user: { mahasiswa_id: 1, name: "Mhs", role: "mahasiswa" } };
            const res = makeRes();

            prisma.mahasiswa.findUnique.mockResolvedValue({ nama: "Mhs", nim: "123" });
            ejs.renderFile.mockResolvedValue("<html>Form</html>");

            await controller.showFormMahasiswa(req, res);

            expect(prisma.mahasiswa.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { mahasiswa_id: 1 } }));
            expect(res.render).toHaveBeenCalledWith("layouts/main", expect.objectContaining({
                body: "<html>Form</html>"
            }));
        });

        test("should handle errors", async () => {
            const req = { user: { mahasiswa_id: 1 } };
            const res = makeRes();

            prisma.mahasiswa.findUnique.mockRejectedValue(new Error("DB Error"));

            await controller.showFormMahasiswa(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.render).toHaveBeenCalledWith("error", expect.anything());
        });
    });

    describe("submitIzinMahasiswa", () => {
        test("should return 400 if mahasiswa_id missing", async () => {
            const req = { user: {}, body: {} };
            const res = makeRes();
            await controller.submitIzinMahasiswa(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        test("should return 400 if fields missing", async () => {
            const req = { user: { mahasiswa_id: 1 }, body: { reason: "Reason" } }; // Missing dates
            const res = makeRes();
            await controller.submitIzinMahasiswa(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Semua field wajib diisi" }));
        });

        test("should return 400 if file missing", async () => {
            const req = {
                user: { mahasiswa_id: 1 },
                body: { reason: "R", date_out: "2023-01-01", time_out: "10:00", date_return: "2023-01-02", time_return: "10:00" }
            };
            const res = makeRes();
            await controller.submitIzinMahasiswa(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Dokumen pendukung wajib diunggah" }));
        });

        test("should return 400 if dates invalid", async () => {
            const req = {
                user: { mahasiswa_id: 1 },
                body: { reason: "R", date_out: "invalid", time_out: "10:00", date_return: "2023-01-02", time_return: "10:00" },
                file: { path: "public/doc.pdf" }
            };
            const res = makeRes();
            await controller.submitIzinMahasiswa(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        test("should return 400 if return date before out date", async () => {
            const req = {
                user: { mahasiswa_id: 1 },
                body: { reason: "R", date_out: "2023-01-02", time_out: "10:00", date_return: "2023-01-01", time_return: "10:00" },
                file: { path: "public/doc.pdf" }
            };
            const res = makeRes();
            await controller.submitIzinMahasiswa(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        test("should create izin and notify", async () => {
            const req = {
                user: { mahasiswa_id: 1 },
                body: { reason: "Reason", date_out: "2023-01-01", time_out: "10:00", date_return: "2023-01-02", time_return: "10:00" },
                file: { path: "public/doc.pdf" }
            };
            const res = makeRes();

            prisma.izinkeluar.create.mockResolvedValue({ izin_id: 100 });

            await controller.submitIzinMahasiswa(req, res);

            expect(prisma.izinkeluar.create).toHaveBeenCalled();
            expect(createIzinKeluarNotification).toHaveBeenCalledWith(1, 100);
            expect(res.status).toHaveBeenCalledWith(201);
        });

        test("should handle errors", async () => {
            const req = { user: { mahasiswa_id: 1 }, body: {}, file: {} }; // Force error later
            const res = makeRes();
            // Bypass initial checks to trigger try-catch
            // Actually easier to just mock create rejection
            req.body = { reason: "R", date_out: "2023-01-01", time_out: "10:00", date_return: "2023-01-02", time_return: "10:00" };
            req.file = { path: "p" };

            prisma.izinkeluar.create.mockRejectedValue(new Error("DB Error"));

            await controller.submitIzinMahasiswa(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe("listIzinMahasiswa", () => {
        test("should return list", async () => {
            const req = { user: { mahasiswa_id: 1 } };
            const res = makeRes();
            prisma.izinkeluar.findMany.mockResolvedValue([]);
            await controller.listIzinMahasiswa(req, res);
            expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
        });

        test("should handle errors", async () => {
            const req = { user: { mahasiswa_id: 1 } };
            const res = makeRes();
            prisma.izinkeluar.findMany.mockRejectedValue(new Error("Err"));
            await controller.listIzinMahasiswa(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe("showIzinPengelola", () => {
        test("should render table", async () => {
            const req = { user: { name: "Admin", role: "pengelola" } };
            const res = makeRes();
            ejs.renderFile.mockResolvedValue("<html>Table</html>");
            await controller.showIzinPengelola(req, res);
            expect(res.render).toHaveBeenCalledWith("layouts/main", expect.anything());
        });

        test("should handle errors", async () => {
            const req = { user: {} };
            const res = makeRes();
            ejs.renderFile.mockRejectedValue(new Error("Err"));
            await controller.showIzinPengelola(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe("listIzinPengelola", () => {
        test("should return list", async () => {
            const req = {};
            const res = makeRes();
            prisma.izinkeluar.findMany.mockResolvedValue([]);
            await controller.listIzinPengelola(req, res);
            expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
        });

        test("should handle errors", async () => {
            const req = {};
            const res = makeRes();
            prisma.izinkeluar.findMany.mockRejectedValue(new Error("Err"));
            await controller.listIzinPengelola(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe("approveIzin", () => {
        test("should return 400 for invalid ID", async () => {
            const req = { params: { id: "abc" } };
            const res = makeRes();
            await controller.approveIzin(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        test("should return 404 if not found", async () => {
            const req = { params: { id: "1" }, user: { pengelola_id: 1 } };
            const res = makeRes();
            prisma.izinkeluar.findUnique.mockResolvedValue(null);
            await controller.approveIzin(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });

        test("should return 409 if not pending", async () => {
            const req = { params: { id: "1" }, user: { pengelola_id: 1 } };
            const res = makeRes();
            prisma.izinkeluar.findUnique.mockResolvedValue({ status: "approved" });
            await controller.approveIzin(req, res);
            expect(res.status).toHaveBeenCalledWith(409);
        });

        test("should approve and notify", async () => {
            const req = { params: { id: "1" }, user: { pengelola_id: 1 } };
            const res = makeRes();
            prisma.izinkeluar.findUnique.mockResolvedValue({ status: "pending", mahasiswa_id: 10 });
            prisma.izinkeluar.update.mockResolvedValue({ status: "approved" });

            await controller.approveIzin(req, res);

            expect(prisma.izinkeluar.update).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ status: "approved" })
            }));
            expect(createIzinKeluarNotification).toHaveBeenCalledWith(10, 1, "disetujui");
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        });

        test("should approve with null pengelola_id if missing in user", async () => {
            const req = { params: { id: "1" }, user: {} };
            const res = makeRes();
            prisma.izinkeluar.findUnique.mockResolvedValue({ status: "pending", mahasiswa_id: 10 });
            prisma.izinkeluar.update.mockResolvedValue({ status: "approved" });

            await controller.approveIzin(req, res);

            expect(prisma.izinkeluar.update).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ Pengelola_id: null })
            }));
        });

        test("should handle errors", async () => {
            const req = { params: { id: "1" }, user: { pengelola_id: 1 } };
            const res = makeRes();
            prisma.izinkeluar.findUnique.mockRejectedValue(new Error("Err"));
            await controller.approveIzin(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe("rejectIzin", () => {
        test("should return 400 for invalid ID", async () => {
            const req = { params: { id: "abc" } };
            const res = makeRes();
            await controller.rejectIzin(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        test("should return 400 if notes missing", async () => {
            const req = { params: { id: "1" }, body: { notes: "" } };
            const res = makeRes();
            await controller.rejectIzin(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        test("should return 404 if not found", async () => {
            const req = { params: { id: "1" }, body: { notes: "Reason" }, user: { pengelola_id: 1 } };
            const res = makeRes();
            prisma.izinkeluar.findUnique.mockResolvedValue(null);
            await controller.rejectIzin(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });

        test("should return 409 if not pending", async () => {
            const req = { params: { id: "1" }, body: { notes: "Reason" }, user: { pengelola_id: 1 } };
            const res = makeRes();
            prisma.izinkeluar.findUnique.mockResolvedValue({ status: "approved" });
            await controller.rejectIzin(req, res);
            expect(res.status).toHaveBeenCalledWith(409);
        });

        test("should reject and notify", async () => {
            const req = { params: { id: "1" }, body: { notes: "Reason" }, user: { pengelola_id: 1 } };
            const res = makeRes();
            prisma.izinkeluar.findUnique.mockResolvedValue({ status: "pending", mahasiswa_id: 10 });
            prisma.izinkeluar.update.mockResolvedValue({ status: "rejected" });

            await controller.rejectIzin(req, res);

            expect(prisma.izinkeluar.update).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ status: "rejected", notes: "Reason" })
            }));
            expect(createIzinKeluarNotification).toHaveBeenCalledWith(10, 1, "ditolak");
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        });

        test("should reject with null pengelola_id if missing in user", async () => {
            const req = { params: { id: "1" }, body: { notes: "Reason" }, user: {} };
            const res = makeRes();
            prisma.izinkeluar.findUnique.mockResolvedValue({ status: "pending", mahasiswa_id: 10 });
            prisma.izinkeluar.update.mockResolvedValue({ status: "rejected" });

            await controller.rejectIzin(req, res);

            expect(prisma.izinkeluar.update).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ Pengelola_id: null })
            }));
        });
        test("should handle errors", async () => {
            const req = { params: { id: "1" }, body: { notes: "Reason" }, user: { pengelola_id: 1 } };
            const res = makeRes();
            prisma.izinkeluar.findUnique.mockResolvedValue({ status: "pending", mahasiswa_id: 10 });
            prisma.izinkeluar.update.mockRejectedValue(new Error("DB Error"));

            await controller.rejectIzin(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
        });
    });

    describe("updateIzinNotes", () => {
        test("should return 400 for invalid ID", async () => {
            const req = { params: { id: "abc" } };
            const res = makeRes();
            await controller.updateIzinNotes(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        test("should return 400 if notes missing", async () => {
            const req = { params: { id: "1" }, body: { notes: "" } };
            const res = makeRes();
            await controller.updateIzinNotes(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        test("should return 404 if not found", async () => {
            const req = { params: { id: "1" }, body: { notes: "New" }, user: { pengelola_id: 1 } };
            const res = makeRes();
            prisma.izinkeluar.findUnique.mockResolvedValue(null);
            await controller.updateIzinNotes(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });

        test("should update notes", async () => {
            const req = { params: { id: "1" }, body: { notes: "New" }, user: { pengelola_id: 1 } };
            const res = makeRes();
            prisma.izinkeluar.findUnique.mockResolvedValue({ izin_id: 1 });
            prisma.izinkeluar.update.mockResolvedValue({ izin_id: 1, notes: "New" });

            await controller.updateIzinNotes(req, res);

            expect(prisma.izinkeluar.update).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ notes: "New" })
            }));
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        });

        test("should update notes with null pengelola_id if missing in user", async () => {
            const req = { params: { id: "1" }, body: { notes: "New" }, user: {} };
            const res = makeRes();
            prisma.izinkeluar.findUnique.mockResolvedValue({ izin_id: 1 });
            prisma.izinkeluar.update.mockResolvedValue({ izin_id: 1, notes: "New" });

            await controller.updateIzinNotes(req, res);

            expect(prisma.izinkeluar.update).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ Pengelola_id: null })
            }));
        });
        test("should handle errors", async () => {
            const req = { params: { id: "1" }, body: { notes: "New" }, user: { pengelola_id: 1 } };
            const res = makeRes();
            prisma.izinkeluar.findUnique.mockResolvedValue({ izin_id: 1 });
            prisma.izinkeluar.update.mockRejectedValue(new Error("DB Error"));

            await controller.updateIzinNotes(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
        });
    });

    describe("resetIzinStatus", () => {
        test("should return 400 for invalid ID", async () => {
            const req = { params: { id: "abc" } };
            const res = makeRes();
            await controller.resetIzinStatus(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        test("should return 404 if not found", async () => {
            const req = { params: { id: "1" } };
            const res = makeRes();
            prisma.izinkeluar.findUnique.mockResolvedValue(null);
            await controller.resetIzinStatus(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });

        test("should return 409 if already pending", async () => {
            const req = { params: { id: "1" } };
            const res = makeRes();
            prisma.izinkeluar.findUnique.mockResolvedValue({ status: "pending" });
            await controller.resetIzinStatus(req, res);
            expect(res.status).toHaveBeenCalledWith(409);
        });

        test("should reset status", async () => {
            const req = { params: { id: "1" } };
            const res = makeRes();
            prisma.izinkeluar.findUnique.mockResolvedValue({ status: "rejected" });
            prisma.izinkeluar.update.mockResolvedValue({ status: "pending" });

            await controller.resetIzinStatus(req, res);

            expect(prisma.izinkeluar.update).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ status: "pending", notes: null })
            }));
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        });
        test("should handle errors", async () => {
            const req = { params: { id: "1" } };
            const res = makeRes();
            prisma.izinkeluar.findUnique.mockResolvedValue({ status: "rejected" });
            prisma.izinkeluar.update.mockRejectedValue(new Error("DB Error"));

            await controller.resetIzinStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
        });
    });
});
