const express = require("express");
const router = express.Router();
const { authMiddleware, redirectIfAuthenticated,requireMahasiswa,requirePengelola } = require('../middlewares/authMiddleware');
const { upload, uploadImage,uploadBukti } = require('../middlewares/uploadMiddleware');
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

router.get("/mahasiswa/dashboard", authMiddleware, requireMahasiswa,controller3.showDashboard);  
router.get("/mahasiswa/pembayaran", authMiddleware, requireMahasiswa, controller5.showPembayaran);
router.get("/mahasiswa/bebas-asrama", authMiddleware,requireMahasiswa, controller6.showBebasAsrama);

// API endpoint untuk detail pemberitahuan di dashboard mahasiswa
router.get("/api/pemberitahuan-mahasiswa/:id", authMiddleware, controller3.getPemberitahuanDetail);

// ===================
// Pengelola
// ===================
const controller4 = require("../controller/conDhsPnl");
const controller7 = require("../controller/conBbsAsrPnl");
const controller8 = require("../controller/conPmbrthnPnl");
const controller9 = require("../controller/conDtPnghni");

router.get("/pengelola/dashboard", authMiddleware,requirePengelola, controller4.showDashboard);
router.get("/pengelola/pengelola-bebas-asrama", authMiddleware,requirePengelola, controller7.showBebasAsramaPengelola);

router.get("/pengelola/pemberitahuan", authMiddleware, requirePengelola, controller8.showPemberitahuanPengelola);
router.get("/pengelola/dataPenghuni", authMiddleware, requirePengelola, controller9.showDtPenghuni);

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

// ====================== PEMBAYARAN (Mahasiswa) ======================

// Mahasiswa upload bukti pembayaran
router.post("/api/pembayaran", authMiddleware, uploadBukti, controller5.uploadBuktiPembayaran);

// Mahasiswa cek detail status pembayaran
router.get("/api/pembayaran/:id", authMiddleware, controller5.getDetailPembayaran);


// ====================== BEBAS ASRAMA (Mahasiswa) ======================

// // Mahasiswa ajukan bebas asrama
router.post("/api/bebas-asrama", authMiddleware, controller6.ajukanBebasAsrama);

// // Mahasiswa cek status pengajuan
router.get("/api/bebas-asrama/:id", authMiddleware, controller6.getStatusBebasAsrama);

// // Mahasiswa batalkan (hapus) pengajuan bebas asrama
router.delete("/api/bebas-asrama/:id", authMiddleware, controller6.deleteBebasAsrama);

// Unduh surat bebas asrama
router.get("/api/bebas-asrama/:id/surat", authMiddleware, controller6.downloadSurat);

// // Lihat data tagihan mahasiswa
router.get("/api/tagihan/:id", authMiddleware, controller6.getTagihanMahasiswa);



// ====================== PEMBAYARAN (Pengelola) ======================

// Pengelola lihat semua pembayaran
router.get("/api/pengelola/pembayaran", authMiddleware, controller5.getAllPembayaran);

// // Pengelola approve pembayaran
router.post("/api/pengelola/pembayaran/:id/approve", authMiddleware, controller5.approvePembayaran);

// // Pengelola reject pembayaran
router.post("/api/pengelola/pembayaran/:id/reject", authMiddleware, controller5.rejectPembayaran);

// ====================== BEBAS ASRAMA (Pengelola) ======================

// // Pengelola lihat semua pengajuan
router.get("/api/pengelola/bebas-asrama", authMiddleware, controller7.getAllBebasAsrama);

// Lihat detail pengajuan (modal detail)
router.get("/api/pengelola/bebas-asrama/:id", authMiddleware, controller7.getDetailBebasAsrama);

// // Verifikasi fasilitas (isi kelengkapan & biaya tambahan)
router.post("/api/pengelola/bebas-asrama/:id/verifikasi-fasilitas", authMiddleware, controller7.verifikasiFasilitas);

module.exports = router;