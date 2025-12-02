/**
 * @file tests/unit/conLogin.unit.test.js
 * Unit tests untuk controllers/conLogin.js (authController.login)
 */

process.env.JWT_SECRET = "testsecret";
process.env.NODE_ENV = "test";

jest.mock("../../models/userModels"); // mock modul User
jest.mock("jsonwebtoken"); // mock jwt

const jwt = require("jsonwebtoken");
const User = require("../../models/userModels");
const { authController, redirectByRole, showLogin } = require("../../controller/conLogin");

// Helper untuk membuat mock res (chainable)
function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.render = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
}

describe("Unit: authController.login", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("render showLogin tanpa error (showLogin)", async () => {
    const req = {};
    const res = makeRes();

    await showLogin(req, res);

    expect(res.render).toHaveBeenCalledWith("login", {
      activePage: "login",
      error: null,
      success: null,
    });
  });

  test("❌ Jika email/password kosong -> render (web) error", async () => {
    const req = { body: { email: "", password: "" }, originalUrl: "/login", get: () => null };
    const res = makeRes();

    await authController.login(req, res);

    expect(res.render).toHaveBeenCalledWith(
      "login",
      expect.objectContaining({
        error: "Email dan password harus diisi",
      })
    );
  });

  test("❌ Jika email/password kosong -> JSON 400 (api)", async () => {
    const req = {
      body: { email: "", password: "" },
      originalUrl: "/api/auth/login",
      get: () => "application/json",
      is: () => false,
      xhr: false,
    };
    const res = makeRes();

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Email dan password harus diisi",
    });
  });

  test("❌ User tidak ditemukan -> render (web) error", async () => {
    User.findByEmail.mockResolvedValue(null);

    const req = { body: { email: "no@mail", password: "123" }, originalUrl: "/login", get: () => null };
    const res = makeRes();

    await authController.login(req, res);

    expect(res.render).toHaveBeenCalled();
    expect(res.render.mock.calls[0][1]).toMatchObject({
      error: "Email atau password salah",
    });
  });

  test("❌ User tidak ditemukan -> JSON 401 (api)", async () => {
    User.findByEmail.mockResolvedValue(null);

    const req = {
      body: { email: "no@mail", password: "123" },
      originalUrl: "/api/auth/login",
      get: () => "application/json",
      is: () => false,
      xhr: false,
    };
    const res = makeRes();

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Email atau password salah",
    });
  });

  test("❌ Password salah -> render error", async () => {
    const fakeUser = { user_id: 1, email: "a@mail", password: "hashed", role: "mahasiswa", name: "A" };

    User.findByEmail.mockResolvedValue(fakeUser);
    User.verifyPassword.mockResolvedValue(false);

    const req = { body: { email: "a@mail", password: "wrong" }, originalUrl: "/login", get: () => null };
    const res = makeRes();

    await authController.login(req, res);

    expect(res.render).toHaveBeenCalledWith("login", expect.objectContaining({
      error: "Email atau password salah",
    }));
  });

  test("❌ Password salah -> JSON 401 (api)", async () => {
    const fakeUser = { user_id: 1, email: "a@mail", password: "hashed", role: "mahasiswa", name: "A" };

    User.findByEmail.mockResolvedValue(fakeUser);
    User.verifyPassword.mockResolvedValue(false);

    const req = {
      body: { email: "a@mail", password: "wrong" },
      originalUrl: "/api/auth/login",
      get: () => "application/json",
      is: () => false,
      xhr: false,
    };
    const res = makeRes();

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Email atau password salah",
    });
  });

  test("✅ Login API berhasil -> JSON response + cookie", async () => {
    const fakeUser = { user_id: "u1", email: "ok@mail", password: "hashed", role: "pengelola", name: "Admin" };

    User.findByEmail.mockResolvedValue(fakeUser);
    User.verifyPassword.mockResolvedValue(true);
    jwt.sign.mockReturnValue("signed.token");

    const req = {
      body: { email: "ok@mail", password: "1234", remember: true },
      originalUrl: "/api/auth/login",
      get: () => "application/json",
      is: () => false,
      xhr: false,
    };

    const res = makeRes();

    await authController.login(req, res);

    expect(jwt.sign).toHaveBeenCalled();
    expect(res.cookie).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Login berhasil",
      token: "signed.token",
      role: "pengelola",
    });
  });

  test("✅ Login Web -> redirect by role mahasiswa", async () => {
    const fakeUser = { user_id: "u2", email: "s@mail", password: "hashed", role: "mahasiswa", name: "M" };

    User.findByEmail.mockResolvedValue(fakeUser);
    User.verifyPassword.mockResolvedValue(true);
    jwt.sign.mockReturnValue("token2");

    const req = {
      body: { email: "s@mail", password: "1234" },
      originalUrl: "/login",
      get: () => null,
      is: () => false,
    };
    const res = makeRes();

    await authController.login(req, res);

    expect(res.redirect).toHaveBeenCalledWith("/mahasiswa/dashboard");
  });

  test("❌ Exception saat login -> render + JSON 500", async () => {
    User.findByEmail.mockRejectedValue(new Error("DB down"));

    // WEB
    const reqWeb = { body: { email: "x@mail", password: "1" }, originalUrl: "/login", get: () => null };
    const resWeb = makeRes();
    await authController.login(reqWeb, resWeb);
    expect(resWeb.render).toHaveBeenCalledWith("login", expect.objectContaining({
      error: "Terjadi kesalahan server",
    }));

    // API
    const reqApi = {
      body: { email: "x@mail", password: "1" },
      originalUrl: "/api/auth/login",
      get: () => "application/json",
      is: () => false,
    };
    const resApi = makeRes();
    await authController.login(reqApi, resApi);
    expect(resApi.status).toHaveBeenCalledWith(500);
    expect(resApi.json).toHaveBeenCalledWith({
      success: false,
      message: "Terjadi kesalahan server",
    });
  });
});

describe("Unit: redirectByRole", () => {
  test("redirect mahasiswa", () => {
    const res = makeRes();
    redirectByRole(res, { role: "mahasiswa" });
    expect(res.redirect).toHaveBeenCalledWith("/mahasiswa/dashboard");
  });

  test("redirect pengelola", () => {
    const res = makeRes();
    redirectByRole(res, { role: "pengelola" });
    expect(res.redirect).toHaveBeenCalledWith("/pengelola/dashboard");
  });

  test("redirect unknown role -> fallback to /", () => {
    const res = makeRes();
    redirectByRole(res, { role: "unknown" });
    expect(res.redirect).toHaveBeenCalledWith("/");
  });
});

describe("Unit: authController.logout", () => {
  test("logout success", async () => {
    const req = {};
    const res = makeRes();
    await authController.logout(req, res);
    expect(res.clearCookie).toHaveBeenCalledWith("token");
    expect(res.redirect).toHaveBeenCalledWith("/login");
  });

  test("logout error -> log error and redirect", async () => {
    const req = {};
    const res = makeRes();
    res.clearCookie.mockImplementation(() => { throw new Error("Cookie error"); });

    await authController.logout(req, res);

    expect(res.redirect).toHaveBeenCalledWith("/login");
  });
});

describe("Unit: showLogin error", () => {
  test("showLogin error -> 500 json", async () => {
    const req = {};
    const res = makeRes();
    res.render.mockImplementation(() => { throw new Error("Render error"); });

    await showLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.anything() }));
  });
});
