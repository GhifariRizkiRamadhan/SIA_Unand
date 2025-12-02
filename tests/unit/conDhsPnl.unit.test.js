/**
 * @file tests/unit/conDhsPnl.unit.test.js
 * Unit tests for controllers/conDhsPnl.js
 */

process.env.NODE_ENV = "test";

// Mock dependencies
jest.mock("../../models/userModels");
jest.mock("../../config/database", () => ({
    prisma: {
        mahasiswa: { count: jest.fn(), groupBy: jest.fn() },
        suratbebasasrama: { count: jest.fn() },
        pelaporankerusakan: { count: jest.fn() },
    },
}));
jest.mock("ejs");

const ejs = require("ejs");
const path = require("path");
const User = require("../../models/userModels");
const { prisma } = require("../../config/database");
const { showDashboard } = require("../../controller/conDhsPnl");

// Helper to create mock response
function makeRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.render = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    return res;
}

describe("Unit: conDhsPnl", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("showDashboard", () => {
        test("should redirect to /login if no user session", async () => {
            const req = { session: {}, user: {} };
            const res = makeRes();

            await showDashboard(req, res);

            expect(res.redirect).toHaveBeenCalledWith("/login");
        });

        test("should render dashboard with correct stats", async () => {
            const req = {
                session: { user_id: 1 },
                user: { user_id: 1 },
            };
            const res = makeRes();

            const mockUser = { id: 1, name: "Admin", role: "pengelola" };
            User.findById = jest.fn().mockResolvedValue(mockUser);

            // Mock prisma counts
            prisma.mahasiswa.count
                .mockResolvedValueOnce(100) // totalMahasiswaAktif
                .mockResolvedValueOnce(5)   // penambahan
                .mockResolvedValueOnce(2);  // pengurangan

            prisma.suratbebasasrama.count
                .mockResolvedValueOnce(10) // totalSelesai
                .mockResolvedValueOnce(3); // perubahanSelesai

            prisma.pelaporankerusakan.count
                .mockResolvedValueOnce(8)  // totalPelaporan
                .mockResolvedValueOnce(4); // perubahanPelaporan

            // Mock groupBy for jurusan
            prisma.mahasiswa.groupBy.mockResolvedValue([
                { jurusan: "TI", _count: { jurusan: 50 } },
                { jurusan: "SI", _count: { jurusan: 30 } },
            ]);

            ejs.renderFile.mockResolvedValue("<html>Dashboard</html>");

            await showDashboard(req, res);

            expect(User.findById).toHaveBeenCalledWith(1);

            // Verify calculations
            // Perubahan = penambahan (5) - pengurangan (2) = 3

            expect(ejs.renderFile).toHaveBeenCalledWith(
                expect.stringContaining("dashboard.ejs"),
                expect.objectContaining({
                    totalMahasiswaAktif: 100,
                    perubahanPenghuni: 3,
                    totalSelesai: 10,
                    perubahanSelesai: 3,
                    totalPelaporan: 8,
                    perubahanPelaporan: 4,
                    labelsJurusan: ["TI", "SI"],
                    countsJurusan: [50, 30],
                })
            );

            expect(res.render).toHaveBeenCalledWith("layouts/main", expect.objectContaining({
                body: "<html>Dashboard</html>",
                user: expect.objectContaining({ name: "Admin" }),
            }));
        });

        test("should handle errors and return 500", async () => {
            const req = { session: { user_id: 1 }, user: { user_id: 1 } };
            const res = makeRes();

            User.findById = jest.fn().mockRejectedValue(new Error("DB Error"));

            await showDashboard(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(Error) }));
        });
    });
});
