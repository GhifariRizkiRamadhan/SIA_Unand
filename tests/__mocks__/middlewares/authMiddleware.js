// Mock untuk semua middleware autentikasi
module.exports = {
  authMiddleware: (req, res, next) => {
    // Simulasikan user sudah login
    req.session = req.session || {};
    req.session.user_id = req.session.user_id || 'pengelola_123';
    req.user = req.user || { user_id: 'pengelola_123', role: 'pengelola' };
    next();
  },
  redirectIfAuthenticated: (req, res, next) => next(),
  requireMahasiswa: (req, res, next) => next(),
  requirePengelola: (req, res, next) => next(),
};