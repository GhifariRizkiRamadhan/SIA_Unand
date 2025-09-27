const express = require("express");
const router = express.Router();
const { authMiddleware, redirectIfAuthenticated } = require('../middlewares/authMiddleware');
const { upload, uploadImage } = require('../middlewares/uploadMiddleware');
const validateEmail = require("../middlewares/validateEmail");
const forgotPasswordLimiter = require("../middlewares/rateLimiter");

// Redirect root to login
router.get("/", (req, res) => {
  res.redirect("/login");
});

// ===================
// Auth Controllers
// ===================
const controller1 = require("../controller/conLogin");
const controller2 = require("../controller/conRegis");

// Public routes (redirect if authenticated)
router.get("/login", redirectIfAuthenticated, controller1.showLogin);
router.post('/login', redirectIfAuthenticated, controller1.authController.login);
router.get("/register", redirectIfAuthenticated, controller2.regcon.showRegis);
router.post("/register", redirectIfAuthenticated, controller2.regcon.register);
router.get("/logout", controller1.authController.logout);

// ===================
// Mahasiswa
// ===================
const controller3 = require("../controller/conDshMhs");
const controller5 = require("../controller/conPbyr");
const controller6 = require("../controller/conBbsAsr");

router.get("/mahasiswa/dashboard", authMiddleware, controller3.showDashboard);  
router.get("/mahasiswa/pembayaran", authMiddleware, controller5.showPembayaran);
router.get("/mahasiswa/bebas-asrama", authMiddleware, controller6.showBebasAsrama);

// API endpoint untuk detail pemberitahuan di dashboard mahasiswa
router.get("/api/pemberitahuan-mahasiswa/:id", authMiddleware, controller3.getPemberitahuanDetail);

// ===================
// Pengelola
// ===================
const controller4 = require("../controller/conDhsPnl");
const controller7 = require("../controller/conBbsAsrPnl");
const controller8 = require("../controller/conPmbrthnPnl");

router.get("/pengelola/dashboard", authMiddleware, controller4.showDashboard);
router.get("/pengelola/pengelola-bebas-asrama", authMiddleware, controller7.showBebasAsramaPengelola);

// Routes untuk pemberitahuan pengelola
router.get("/pengelola/pemberitahuan", authMiddleware, controller8.showPemberitahuanPengelola);

// API routes untuk pemberitahuan dengan error handling
router.post("/api/pemberitahuan", authMiddleware, (req, res, next) => {
  uploadImage(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({ 
        success: false, 
        message: 'Error upload file: ' + err.message 
      });
    }
    next();
  });
}, controller8.tambahPemberitahuan);

router.post("/api/pemberitahuan/:id", authMiddleware, (req, res, next) => {
  uploadImage(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({ 
        success: false, 
        message: 'Error upload file: ' + err.message 
      });
    }
    next();
  });
}, controller8.editPemberitahuan);

router.get("/api/pemberitahuan/:id", authMiddleware, controller8.getPemberitahuan);
router.delete("/api/pemberitahuan/:id", authMiddleware, controller8.hapusPemberitahuan);

module.exports = router;