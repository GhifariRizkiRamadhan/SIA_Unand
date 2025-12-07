/**
 * @file tests/unit/conDshMhs.unit.test.js
 * Unit tests for controllers/conDshMhs.js
 */

process.env.NODE_ENV = "test";

// Mock dependencies
jest.mock("../../models/userModels");
jest.mock("../../config/database", () => ({
    prisma: {
        izinkeluar: { count: jest.fn() },
        pelaporankerusakan: { count: jest.fn() },
        suratbebasasrama: { count: jest.fn() },
        pemberitahuan: { count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    },
}));
jest.mock("ejs");

const ejs = require("ejs");
const path = require("path");
const User = require("../../models/userModels");
const { prisma } = require("../../config/database");
const { showDashboard, getPemberitahuanDetail } = require("../../controller/conDshMhs");

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

describe("Unit: conDshMhs", () => {
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

        test("should return 403 if mahasiswa_id is missing", async () => {
            const req = {
                session: { user_id: 1 },
                user: { user_id: 1 }, // missing mahasiswa_id
            };
            const res = makeRes();
            User.findById = jest.fn().mockResolvedValue({ id: 1, name: "Test User" });
            await showDashboard(req, res);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.send).toHaveBeenCalledWith(expect.stringContaining("Forbidden"));
        });

        test("should render dashboard with correct data", async () => {
            const req = {
                session: { user_id: 1 },
                user: { user_id: 1, mahasiswa_id: 100 },
                query: { page: 1 },
            };
            const res = makeRes();

            const mockUser = { id: 1, name: "Mhs", role: "mahasiswa" };
            User.findById = jest.fn().mockResolvedValue(mockUser);
            User.countAll = jest.fn().mockResolvedValue(50);

            // Mock prisma counts
            prisma.izinkeluar.count.mockResolvedValue(5);
            prisma.pelaporankerusakan.count.mockResolvedValue(2);
            prisma.suratbebasasrama.count.mockResolvedValue(1);

            // Mock pagination counts
            prisma.pemberitahuan.count.mockResolvedValue(10);
            prisma.pemberitahuan.findMany.mockResolvedValue([
                { id: 1, title: "Info 1", image: "img1.jpg", pengelolaasrama: { user: { name: "Admin" } } },
                { id: 2, title: "Info 2", image: "/img2.jpg", pengelolaasrama: { user: { name: "Admin" } } },
                { id: 3, title: "Info 3", image: null, pengelolaasrama: { user: { name: "Admin" } } }
            ]);

            ejs.renderFile.mockResolvedValue("<html>Dashboard</html>");
            await showDashboard(req, res);
            expect(User.findById).toHaveBeenCalledWith(1);

            // Verify query filters
            const sevenDaysAgo = expect.any(Date);
            expect(prisma.izinkeluar.count).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.objectContaining({
                    mahasiswa_id: 100,
                    submitted_at: { gte: sevenDaysAgo }
                })
            }));
            expect(prisma.pelaporankerusakan.count).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.objectContaining({
                    mahasiswa_id: 100,
                    date_submitted: { gte: sevenDaysAgo }
                })
            }));
            expect(prisma.suratbebasasrama.count).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.objectContaining({
                    mahasiswa_id: 100,
                    tanggal_pengajuan: { gte: sevenDaysAgo }
                })
            }));

            expect(ejs.renderFile).toHaveBeenCalled();

            // Verify image path normalization in the data passed to view
            const renderData = ejs.renderFile.mock.calls[0][1];
            const notifications = renderData.pemberitahuanList;
            expect(notifications[0].image).toBe("/img1.jpg"); // Added slash
            expect(notifications[1].image).toBe("/img2.jpg"); // Kept slash
            expect(notifications[2].image).toBeNull(); // Handle null

            expect(res.render).toHaveBeenCalledWith("layouts/main", expect.objectContaining({
                body: "<html>Dashboard</html>",
                user: expect.objectContaining({ name: "Mhs" }),
            }));
        });

        test("should use req.user.user_id if req.session.user_id is missing", async () => {
            const req = {
                session: {}, // Empty session
                user: { user_id: 99, mahasiswa_id: 200 }, // Auth via JWT/Passport
                query: {},
            };
            const res = makeRes();

            User.findById.mockResolvedValue({ id: 99, name: "User 99" });
            User.countAll.mockResolvedValue(0);
            prisma.izinkeluar.count.mockResolvedValue(0);
            prisma.pelaporankerusakan.count.mockResolvedValue(0);
            prisma.suratbebasasrama.count.mockResolvedValue(0);
            prisma.pemberitahuan.count.mockResolvedValue(0);
            prisma.pemberitahuan.findMany.mockResolvedValue([]);
            ejs.renderFile.mockResolvedValue("");
            await showDashboard(req, res);
            expect(User.findById).toHaveBeenCalledWith(99);
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

    describe("getPemberitahuanDetail", () => {
        test("should return 400 if ID is invalid", async () => {
            const req = { params: { id: "abc" } };
            const res = makeRes();
            await getPemberitahuanDetail(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
        });

        test("should return 404 if notification not found", async () => {
            const req = { params: { id: "999" } };
            const res = makeRes();
            prisma.pemberitahuan.findUnique.mockResolvedValue(null);
            await getPemberitahuanDetail(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
        });

        test("should return notification data if found", async () => {
            const req = { params: { id: "1" } };
            const res = makeRes();
            const mockData = { id: 1, title: "Test" };
            prisma.pemberitahuan.findUnique.mockResolvedValue(mockData);
            await getPemberitahuanDetail(req, res);
            expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData });
        });

        test("should handle errors and return 500", async () => {
            const req = { params: { id: "1" } };
            const res = makeRes();
            prisma.pemberitahuan.findUnique.mockRejectedValue(new Error("DB Error"));
            await getPemberitahuanDetail(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
        });
    });
});
