/**
 * @file tests/unit/conPelaporan.unit.test.js
 * Unit tests for controllers/conPelaporan.js
 */

process.env.NODE_ENV = "test";

// Mock dependencies
jest.mock("../../config/database", () => ({
    prisma: {
        pelaporankerusakan: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    },
}));
jest.mock("../../controller/notification", () => ({
    createKerusakanNotification: jest.fn().mockResolvedValue({}),
}));
jest.mock("ejs");

const ejs = require("ejs");
const { prisma } = require("../../config/database");
const { createKerusakanNotification } = require("../../controller/notification");
const controller = require("../../controller/conPelaporan");

// Helper to create mock response
function makeRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.render = jest.fn().mockReturnValue(res);
    return res;
}

describe("Unit: conPelaporan", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("showFormPelaporan", () => {
        test("should render form", async () => {
            const req = { user: { name: "Mhs", role: "mahasiswa" } };
            const res = makeRes();
            ejs.renderFile.mockResolvedValue("<html>Form</html>");
            await controller.showFormPelaporan(req, res);
            expect(res.render).toHaveBeenCalledWith("layouts/main", expect.anything());
        });

        test("should handle errors", async () => {
            const req = { user: {} };
            const res = makeRes();
            ejs.renderFile.mockRejectedValue(new Error("Err"));
            await controller.showFormPelaporan(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe("submitPelaporan", () => {
        test("should return 400 if jenis invalid", async () => {
            const req = { user: { mahasiswa_id: 1 }, body: { jenis: "A" } };
            const res = makeRes();
            await controller.submitPelaporan(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("Jenis") }));
        });

        test("should return 400 if description too short", async () => {
            const req = { user: { mahasiswa_id: 1 }, body: { jenis: "Pintu", description: "Short" } };
            const res = makeRes();
            await controller.submitPelaporan(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        test("should return 400 if location too short", async () => {
            const req = { user: { mahasiswa_id: 1 }, body: { jenis: "Pintu", description: "Long enough description", location: "A" } };
            const res = makeRes();
            await controller.submitPelaporan(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        test("should create laporan and notify", async () => {
            const req = {
                user: { mahasiswa_id: 1 },
                body: { jenis: "Pintu", description: "Long enough description", location: "Room 101" },
                file: { path: "public/img.jpg" }
            };
            const res = makeRes();
            prisma.pelaporankerusakan.create.mockResolvedValue({ laporan_id: 100 });

            await controller.submitPelaporan(req, res);

            expect(prisma.pelaporankerusakan.create).toHaveBeenCalled();
            expect(createKerusakanNotification).toHaveBeenCalledWith(1, 100);
            expect(res.status).toHaveBeenCalledWith(201);
        });

        test("should handle errors", async () => {
            const req = {
                user: { mahasiswa_id: 1 },
                body: { jenis: "Pintu", description: "Long enough description", location: "Room 101" }
            };
            const res = makeRes();
            prisma.pelaporankerusakan.create.mockRejectedValue(new Error("DB Err"));
            await controller.submitPelaporan(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe("listPelaporanMahasiswa", () => {
        test("should return list", async () => {
            const req = { user: { mahasiswa_id: 1 } };
            const res = makeRes();
            prisma.pelaporankerusakan.findMany.mockResolvedValue([]);
            await controller.listPelaporanMahasiswa(req, res);
            expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
        });

        test("should handle errors", async () => {
            const req = { user: { mahasiswa_id: 1 } };
            const res = makeRes();
            prisma.pelaporankerusakan.findMany.mockRejectedValue(new Error("Err"));
            await controller.listPelaporanMahasiswa(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe("showPelaporanPengelola", () => {
        test("should render admin view", async () => {
            const req = { user: { name: "Admin", role: "pengelola" } };
            const res = makeRes();
            ejs.renderFile.mockResolvedValue("<html>Admin</html>");
            await controller.showPelaporanPengelola(req, res);
            expect(res.render).toHaveBeenCalledWith("layouts/main", expect.anything());
        });

        test("should handle errors", async () => {
            const req = { user: {} };
            const res = makeRes();
            ejs.renderFile.mockRejectedValue(new Error("Err"));
            await controller.showPelaporanPengelola(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe("listPelaporanPengelola", () => {
        test("should return list", async () => {
            const req = {};
            const res = makeRes();
            prisma.pelaporankerusakan.findMany.mockResolvedValue([]);
            await controller.listPelaporanPengelola(req, res);
            expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
        });

        test("should handle errors", async () => {
            const req = {};
            const res = makeRes();
            prisma.pelaporankerusakan.findMany.mockRejectedValue(new Error("Err"));
            await controller.listPelaporanPengelola(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe("updateStatusPelaporan", () => {
        test("should return 400 if status invalid", async () => {
            const req = { params: { id: "1" }, body: { status: "invalid" } };
            const res = makeRes();
            await controller.updateStatusPelaporan(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        test("should return 404 if not found", async () => {
            const req = { params: { id: "1" }, body: { status: "ditinjau" } };
            const res = makeRes();
            prisma.pelaporankerusakan.findUnique.mockResolvedValue(null);
            await controller.updateStatusPelaporan(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });

        test("should update status and notify", async () => {
            const req = { params: { id: "1" }, body: { status: "ditinjau" } };
            const res = makeRes();
            prisma.pelaporankerusakan.findUnique.mockResolvedValue({ laporan_id: 1, mahasiswa_id: 10 });
            prisma.pelaporankerusakan.update.mockResolvedValue({ laporan_id: 1, status: "ditinjau" });

            await controller.updateStatusPelaporan(req, res);

            expect(prisma.pelaporankerusakan.update).toHaveBeenCalledWith(expect.objectContaining({
                data: { status: "ditinjau" }
            }));
            expect(createKerusakanNotification).toHaveBeenCalledWith(10, 1, "ditinjau");
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        });

        test("should handle errors", async () => {
            const req = { params: { id: "1" }, body: { status: "ditinjau" } };
            const res = makeRes();
            prisma.pelaporankerusakan.findUnique.mockRejectedValue(new Error("Err"));
            await controller.updateStatusPelaporan(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });
});
