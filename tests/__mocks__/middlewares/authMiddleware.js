// Mock untuk semua middleware autentikasi
module.exports = {
  authMiddleware: (req, res, next) => next(),
  redirectIfAuthenticated: (req, res, next) => next(),
  requireMahasiswa: (req, res, next) => next(),
  requirePengelola: (req, res, next) => next(),
};