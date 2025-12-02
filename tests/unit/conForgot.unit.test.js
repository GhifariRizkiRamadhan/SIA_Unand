/**
 * @file tests/unit/conForgot.unit.test.js
 * Unit tests for controllers/conForgot.js
 */

process.env.NODE_ENV = "test";

// Mock dependencies
const mockPrisma = {
    user: {
        findUnique: jest.fn(),
        update: jest.fn(),
    },
};

// Mock @prisma/client constructor
jest.mock("@prisma/client", () => {
    return {
        PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
    };
});

jest.mock("bcrypt");

const bcrypt = require("bcrypt");
const { showForgotPassword, resetPassword } = require("../../controller/conForgot");

// Helper to create mock response
function makeRes() {
    const res = {};
    res.render = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
    return res;
}

describe("Unit: conForgot", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("showForgotPassword", () => {
        test("should render forgotPassword page", () => {
            const req = {};
            const res = makeRes();

            showForgotPassword(req, res);

            expect(res.render).toHaveBeenCalledWith("forgotPassword", {
                error: null,
                success: null,
            });
        });
    });

    describe("resetPassword", () => {
        test("should return error if fields are missing", async () => {
            const req = { body: { email: "", newPassword: "", confirmPassword: "" } };
            const res = makeRes();

            await resetPassword(req, res);

            expect(res.render).toHaveBeenCalledWith("forgotPassword", expect.objectContaining({
                error: "Semua field harus diisi!",
            }));
        });

        test("should return error if passwords do not match", async () => {
            const req = { body: { email: "test@mail.com", newPassword: "123", confirmPassword: "456" } };
            const res = makeRes();

            await resetPassword(req, res);

            expect(res.render).toHaveBeenCalledWith("forgotPassword", expect.objectContaining({
                error: "Password baru dan konfirmasi password tidak cocok!",
            }));
        });

        test("should return error if password is too short", async () => {
            const req = { body: { email: "test@mail.com", newPassword: "short", confirmPassword: "short" } };
            const res = makeRes();

            await resetPassword(req, res);

            expect(res.render).toHaveBeenCalledWith("forgotPassword", expect.objectContaining({
                error: "Password harus minimal 8 karakter!",
            }));
        });

        test("should return error if user not found", async () => {
            const req = { body: { email: "notfound@mail.com", newPassword: "password123", confirmPassword: "password123" } };
            const res = makeRes();

            mockPrisma.user.findUnique.mockResolvedValue(null);

            await resetPassword(req, res);

            expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { email: "notfound@mail.com" } });
            expect(res.render).toHaveBeenCalledWith("forgotPassword", expect.objectContaining({
                error: "Email tidak terdaftar dalam sistem!",
            }));
        });

        test("should reset password and redirect on success", async () => {
            const req = { body: { email: "ok@mail.com", newPassword: "password123", confirmPassword: "password123" } };
            const res = makeRes();

            mockPrisma.user.findUnique.mockResolvedValue({ id: 1, email: "ok@mail.com" });
            bcrypt.hash.mockResolvedValue("hashedPass");
            mockPrisma.user.update.mockResolvedValue({});

            await resetPassword(req, res);

            expect(bcrypt.hash).toHaveBeenCalledWith("password123", 10);
            expect(mockPrisma.user.update).toHaveBeenCalledWith({
                where: { email: "ok@mail.com" },
                data: { password: "hashedPass" },
            });
            expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("/login?success="));
        });

        test("should handle errors and render error message", async () => {
            const req = { body: { email: "err@mail.com", newPassword: "password123", confirmPassword: "password123" } };
            const res = makeRes();

            mockPrisma.user.findUnique.mockRejectedValue(new Error("DB Error"));

            await resetPassword(req, res);

            expect(res.render).toHaveBeenCalledWith("forgotPassword", expect.objectContaining({
                error: "Terjadi kesalahan saat mereset password. Silakan coba lagi.",
            }));
        });
    });
});
