/**
 * @file tests/unit/conProfile.unit.test.js
 * Unit tests for controllers/conProfile.js
 */

process.env.NODE_ENV = "test";

// Mock dependencies
jest.mock("../../models/userModels");
jest.mock("../../config/database", () => ({
    prisma: {
        user: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
        mahasiswa: { findFirst: jest.fn(), update: jest.fn() },
    },
}));
jest.mock("bcrypt");
jest.mock("ejs");
jest.mock("fs");
jest.mock("path", () => ({
    join: jest.fn((...args) => args.join("/")),
    resolve: jest.fn((...args) => args.join("/")),
    dirname: jest.fn(() => "/mock/dir"),
}));

const bcrypt = require("bcrypt");
const ejs = require("ejs");
const fs = require("fs");
const { showProfile, updateProfile } = require("../../controller/conProfile");
const { prisma } = require("../../config/database");

// Helper to create mock response
function makeRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.render = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
    return res;
}

describe("Unit: conProfile", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("showProfile", () => {
        test("should redirect to login if no session", async () => {
            const req = { session: {}, user: {} };
            const res = makeRes();

            await showProfile(req, res);

            expect(res.redirect).toHaveBeenCalledWith("/login");
        });

        test("should redirect to login if user not found in db", async () => {
            const req = { session: { user_id: 999 } };
            const res = makeRes();

            prisma.user.findUnique.mockResolvedValue(null);

            await showProfile(req, res);

            expect(res.redirect).toHaveBeenCalledWith("/login");
        });

        test("should render profile for pengelola", async () => {
            const req = { session: { user_id: 1 }, query: {} };
            const res = makeRes();

            prisma.user.findUnique.mockResolvedValue({ user_id: 1, role: "pengelola", name: "Admin" });
            ejs.renderFile.mockResolvedValue("<html>Profile</html>");

            await showProfile(req, res);

            expect(res.render).toHaveBeenCalledWith("layouts/main", expect.objectContaining({
                activeMenu: "pengelola-profile",
                body: "<html>Profile</html>"
            }));
        });

        test("should render profile for mahasiswa with mahasiswa data", async () => {
            const req = { session: { user_id: 2 }, query: {} };
            const res = makeRes();

            prisma.user.findUnique.mockResolvedValue({ user_id: 2, role: "mahasiswa", name: "Mhs" });
            prisma.mahasiswa.findFirst.mockResolvedValue({ nim: "123" });
            ejs.renderFile.mockResolvedValue("<html>Profile</html>");

            await showProfile(req, res);

            expect(prisma.mahasiswa.findFirst).toHaveBeenCalledWith({ where: { user_id: 2 } });
            expect(res.render).toHaveBeenCalledWith("layouts/main", expect.objectContaining({
                activeMenu: "mahasiswa-profile"
            }));
        });
        test("should handle errors", async () => {
            const req = { session: { user_id: 1 } };
            const res = makeRes();

            prisma.user.findUnique.mockRejectedValue(new Error("DB Error"));

            await showProfile(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.render).toHaveBeenCalledWith("error", expect.anything());
        });
    });

    describe("updateProfile", () => {
        test("should return 401 if not authorized", async () => {
            const req = { session: {} };
            const res = makeRes();

            await updateProfile(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
        });

        test("should update basic profile info", async () => {
            const req = {
                session: { user_id: 1 },
                body: { name: "New Name", email: "new@mail.com" }
            };
            const res = makeRes();

            prisma.user.findUnique.mockResolvedValue({ user_id: 1, email: "old@mail.com", role: "pengelola" });
            prisma.user.findFirst.mockResolvedValue(null); // No email conflict
            prisma.user.update.mockResolvedValue({});

            await updateProfile(req, res);

            expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ name: "New Name", email: "new@mail.com" })
            }));
            expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("success"));
        });

        test("should handle password update with validation", async () => {
            const req = {
                session: { user_id: 1 },
                body: {
                    name: "Name", email: "mail@mail.com",
                    oldPassword: "old", newPassword: "newpass", confirmPassword: "newpass"
                }
            };
            const res = makeRes();

            prisma.user.findUnique.mockResolvedValue({ user_id: 1, email: "mail@mail.com", password: "hashedOld", role: "pengelola" });
            bcrypt.compare.mockResolvedValue(true);
            bcrypt.hash.mockResolvedValue("hashedNew");

            await updateProfile(req, res);

            expect(bcrypt.compare).toHaveBeenCalledWith("old", "hashedOld");
            expect(bcrypt.hash).toHaveBeenCalledWith("newpass", 10);
            expect(prisma.user.update).toHaveBeenCalled();
            expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("success"));
        });

        test("should update mahasiswa data including photo", async () => {
            const req = {
                session: { user_id: 2 },
                body: { name: "Mhs", email: "m@mail.com", nim: "999" },
                file: { filename: "new.jpg", path: "temp/new.jpg" }
            };
            const res = makeRes();

            const mockUser = {
                user_id: 2, role: "mahasiswa", email: "m@mail.com",
                mahasiswa: [{ mahasiswa_id: 10, nim: "888", foto: "/old.jpg" }]
            };

            prisma.user.findUnique.mockResolvedValue(mockUser);
            prisma.mahasiswa.findFirst.mockResolvedValue(null); // NIM unique
            fs.existsSync.mockReturnValue(true);
            fs.unlinkSync.mockImplementation(() => { });

            await updateProfile(req, res);

            expect(prisma.mahasiswa.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { mahasiswa_id: 10 },
                data: expect.objectContaining({ nim: "999", foto: "/image/mahasiswa/new.jpg" })
            }));
            expect(fs.unlinkSync).toHaveBeenCalled(); // Should delete old photo
        });

        test("should handle errors and clean up uploaded file", async () => {
            const req = {
                session: { user_id: 1 },
                body: { name: "Name", email: "mail@mail.com" },
                file: { path: "temp/fail.jpg" }
            };
            const res = makeRes();

            prisma.user.findUnique.mockRejectedValue(new Error("DB Error"));
            fs.unlinkSync.mockImplementation(() => { });

            await updateProfile(req, res);

            expect(fs.unlinkSync).toHaveBeenCalledWith("temp/fail.jpg");
            expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("error"));
        });
        test("should redirect error if name or email missing", async () => {
            const req = { session: { user_id: 1 }, body: {} };
            const res = makeRes();
            await updateProfile(req, res);
            expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent("Nama dan email harus diisi")));
        });

        test("should redirect error if user not found", async () => {
            const req = { session: { user_id: 1 }, body: { name: "N", email: "E" } };
            const res = makeRes();
            prisma.user.findUnique.mockResolvedValue(null);
            await updateProfile(req, res);
            expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent("User tidak ditemukan")));
        });

        test("should redirect error if email exists", async () => {
            const req = { session: { user_id: 1 }, body: { name: "N", email: "E" } };
            const res = makeRes();
            prisma.user.findUnique.mockResolvedValue({ user_id: 1, email: "Old" });
            prisma.user.findFirst.mockResolvedValue({ user_id: 2 });
            await updateProfile(req, res);
            expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent("Email sudah digunakan")));
        });

        test("should redirect error if password fields missing", async () => {
            const req = { session: { user_id: 1 }, body: { name: "N", email: "E", oldPassword: "old" } };
            const res = makeRes();
            prisma.user.findUnique.mockResolvedValue({ user_id: 1, email: "E" });
            await updateProfile(req, res);
            expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent("Semua field password harus diisi")));
        });

        test("should redirect error if password mismatch", async () => {
            const req = { session: { user_id: 1 }, body: { name: "N", email: "E", oldPassword: "old", newPassword: "new", confirmPassword: "diff" } };
            const res = makeRes();
            prisma.user.findUnique.mockResolvedValue({ user_id: 1, email: "E" });
            await updateProfile(req, res);
            expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent("tidak cocok")));
        });

        test("should redirect error if password too short", async () => {
            const req = { session: { user_id: 1 }, body: { name: "N", email: "E", oldPassword: "old", newPassword: "short", confirmPassword: "short" } };
            const res = makeRes();
            prisma.user.findUnique.mockResolvedValue({ user_id: 1, email: "E" });
            await updateProfile(req, res);
            expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent("minimal 6 karakter")));
        });

        test("should redirect error if old password wrong", async () => {
            const req = { session: { user_id: 1 }, body: { name: "N", email: "E", oldPassword: "wrong", newPassword: "valid1", confirmPassword: "valid1" } };
            const res = makeRes();
            prisma.user.findUnique.mockResolvedValue({ user_id: 1, email: "E", password: "hash" });
            bcrypt.compare.mockResolvedValue(false);
            await updateProfile(req, res);
            expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent("Password lama tidak benar")));
        });

        test("should update jurusan and handle NIM conflict", async () => {
            const req = {
                session: { user_id: 1 },
                body: { name: "N", email: "E", jurusan: "SI", nim: "999" }
            };
            const res = makeRes();
            const mockUser = { user_id: 1, role: "mahasiswa", email: "E", mahasiswa: [{ mahasiswa_id: 10, nim: "888" }] };

            prisma.user.findUnique.mockResolvedValue(mockUser);
            prisma.mahasiswa.findFirst.mockResolvedValue({ mahasiswa_id: 11 }); // Conflict

            await updateProfile(req, res);

            expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent("NIM sudah digunakan")));
        });

        test("should handle error deleting old photo", async () => {
            const req = {
                session: { user_id: 1 },
                body: { name: "N", email: "E" },
                file: { filename: "new.jpg" }
            };
            const res = makeRes();
            const mockUser = { user_id: 1, role: "mahasiswa", email: "E", mahasiswa: [{ mahasiswa_id: 10, foto: "old.jpg" }] };

            prisma.user.findUnique.mockResolvedValue(mockUser);
            fs.existsSync.mockReturnValue(true);
            fs.unlinkSync.mockImplementation(() => { throw new Error("Delete fail"); });

            await updateProfile(req, res);

            // Should still proceed to update
            expect(prisma.mahasiswa.update).toHaveBeenCalled();
        });

        test("should update without photo", async () => {
            const req = {
                session: { user_id: 2 },
                body: { name: "Mhs", email: "m@mail.com" }
                // no file
            };
            const res = makeRes();
            const mockUser = { user_id: 2, role: "mahasiswa", email: "m@mail.com", mahasiswa: [{ mahasiswa_id: 10, nim: "888", foto: "old.jpg" }] };

            prisma.user.findUnique.mockResolvedValue(mockUser);

            await updateProfile(req, res);

            expect(prisma.mahasiswa.update).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.not.objectContaining({ foto: expect.anything() })
            }));
        });

        test("should update photo when no old photo exists", async () => {
            const req = {
                session: { user_id: 2 },
                body: { name: "Mhs", email: "m@mail.com" },
                file: { filename: "new.jpg" }
            };
            const res = makeRes();
            const mockUser = { user_id: 2, role: "mahasiswa", email: "m@mail.com", mahasiswa: [{ mahasiswa_id: 10, nim: "888", foto: null }] };

            prisma.user.findUnique.mockResolvedValue(mockUser);

            await updateProfile(req, res);

            expect(fs.unlinkSync).not.toHaveBeenCalled();
            expect(prisma.mahasiswa.update).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ foto: "/image/mahasiswa/new.jpg" })
            }));
        });

        test("should update photo when old photo file is missing", async () => {
            const req = {
                session: { user_id: 2 },
                body: { name: "Mhs", email: "m@mail.com" },
                file: { filename: "new.jpg" }
            };
            const res = makeRes();
            const mockUser = { user_id: 2, role: "mahasiswa", email: "m@mail.com", mahasiswa: [{ mahasiswa_id: 10, nim: "888", foto: "old.jpg" }] };

            prisma.user.findUnique.mockResolvedValue(mockUser);
            fs.existsSync.mockReturnValue(false); // File missing

            await updateProfile(req, res);

            expect(fs.unlinkSync).not.toHaveBeenCalled();
            expect(prisma.mahasiswa.update).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ foto: "/image/mahasiswa/new.jpg" })
            }));
        });

        test("should handle error deleting uploaded file on failure", async () => {
            const req = {
                session: { user_id: 1 },
                body: { name: "N", email: "E" },
                file: { path: "temp.jpg" }
            };
            const res = makeRes();
            prisma.user.findUnique.mockRejectedValue(new Error("Fail"));
            fs.unlinkSync.mockImplementation(() => { throw new Error("Cleanup fail"); });

            await updateProfile(req, res);

            expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent("Terjadi kesalahan")));
        });
        test("should handle errors without file upload", async () => {
            const req = {
                session: { user_id: 1 },
                body: { name: "Name", email: "mail@mail.com" }
                // no file
            };
            const res = makeRes();

            prisma.user.findUnique.mockRejectedValue(new Error("DB Error"));

            await updateProfile(req, res);

            expect(fs.unlinkSync).not.toHaveBeenCalled();
            expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent("Terjadi kesalahan")));
        });
    });
});
