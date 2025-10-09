const express = require("express");
const router = express.Router();
const { authMiddleware, redirectIfAuthenticated,requireMahasiswa,requirePengelola } = require('../middlewares/authMiddleware');
const { upload, uploadImage,uploadBukti } = require('../middlewares/uploadMiddleware');
const validateEmail = require("../middlewares/validateEmail");
const forgotPasswordLimiter = require("../middlewares/rateLimiter");
const { uploadMahasiswaFoto } = require('../config/multerConfig');

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
router.post("/register", redirectIfAuthenticated, uploadMahasiswaFoto.single('foto'), controller2.regcon.register);
router.get("/logout", controller1.authController.logout);

// ===================
// Mahasiswa
// ===================
const controller3 = require("../controller/conDshMhs");
const notifications = require("../controller/notification");

// ===================
// Notifications
// ===================
router.get("/api/notifications", authMiddleware, notifications.getNotifications);
router.put("/api/notifications/:id/read", authMiddleware, notifications.markAsRead);
router.put("/api/notifications/read-all", authMiddleware, notifications.markAllAsRead);

const controller5 = require("../controller/conPbyr");
const controller6 = require("../controller/conBbsAsr");

router.get("/mahasiswa/dashboard", authMiddleware, requireMahasiswa,controller3.showDashboard);  

// ====================== PEMBAYARAN (Mahasiswa) ======================

router.get("/mahasiswa/pembayaran/:id", authMiddleware, requireMahasiswa, controller5.showPembayaran);
router.post("/api/pembayaran", authMiddleware, uploadBukti, controller5.uploadBuktiPembayaran);
router.get("/api/pembayaran/:id", authMiddleware, controller5.getDetailPembayaran);
router.put("/api/pembayaran/:id/reupload", authMiddleware, uploadBukti, controller5.reuploadBuktiPembayaran);

// ====================== BEBAS ASRAMA (Mahasiswa) ======================

router.get("/mahasiswa/bebas-asrama", authMiddleware,requireMahasiswa, controller6.showBebasAsrama);
router.post("/api/bebas-asrama", authMiddleware, controller6.ajukanBebasAsrama);
router.get("/api/bebas-asrama/:id", authMiddleware, controller6.getStatusBebasAsrama);
router.delete("/api/bebas-asrama/:id", authMiddleware, controller6.deleteBebasAsrama);
router.get("/api/bebas-asrama/:id/surat", authMiddleware, controller6.downloadSurat);
router.get("/api/tagihan/:id", authMiddleware, controller6.getTagihanMahasiswa);
router.get("/api/bebas-asrama/mahasiswa/:id", authMiddleware, controller6.getRiwayatPengajuan);


// ====================== PEMBERITAHUAN (Mahasiswa) ======================
router.get("/api/pemberitahuan-mahasiswa/:id", authMiddleware, controller3.getPemberitahuanDetail);

// ===================
// Pengelola
// ===================
const controller4 = require("../controller/conDhsPnl");
const controller7 = require("../controller/conBbsAsrPnl");
const controller8 = require("../controller/conPmbrthnPnl");
const controller9 = require("../controller/conDtPnghni");

router.get("/pengelola/dashboard", authMiddleware,requirePengelola, controller4.showDashboard);
router.get("/pengelola/dataPenghuni", authMiddleware, requirePengelola, controller9.showDtPenghuni);


// ====================== PEMBAYARAN (Pengelola) ======================


router.get("/api/pengelola/pembayaran", authMiddleware, controller5.getAllPembayaran);

router.post("/api/pengelola/pembayaran/:id/approve", authMiddleware, controller5.approvePembayaran);
router.post("/api/pengelola/pembayaran/:id/reject", authMiddleware, controller5.rejectPembayaran);
router.get('/api/pengelola/surat/:id/bukti-pembayaran', authMiddleware, controller7.getBuktiPembayaran);

// ====================== BEBAS ASRAMA (Pengelola) ======================

router.get("/pengelola/pengelola-bebas-asrama", authMiddleware,requirePengelola, controller7.showBebasAsramaPengelola);
router.get("/api/pengelola/bebas-asrama", authMiddleware, controller7.getAllBebasAsrama);
router.get("/api/pengelola/bebas-asrama/:id", authMiddleware, controller7.getDetailBebasAsrama);
router.post("/api/pengelola/bebas-asrama/:id/verifikasi-fasilitas", authMiddleware, controller7.verifikasiFasilitas);

// ====================== PEMBERITAHUAN (Pengelola) ======================
router.get("/pengelola/pemberitahuan", authMiddleware, requirePengelola, controller8.showPemberitahuanPengelola);
router.get("/api/pemberitahuan/:id", authMiddleware, controller8.getPemberitahuan);
router.delete("/api/pemberitahuan/:id", authMiddleware, controller8.hapusPemberitahuan);

// Notification routes
const notificationController = require('../controller/notification');
router.get('/api/notifications', authMiddleware, notificationController.getNotifications);
router.put('/api/notifications/:notificationId/read', authMiddleware, notificationController.markAsRead);
router.put('/api/notifications/read-all', authMiddleware, notificationController.markAllAsRead);

router.get("/pengelola/dataPenghuni", authMiddleware, requirePengelola, controller9.showDtPenghuni);
router.post("/pengelola/dataPenghuni/tambah", authMiddleware, requirePengelola, uploadMahasiswaFoto.single('foto'), controller9.tambahPenghuni);
router.post("/pengelola/dataPenghuni/edit", authMiddleware, requirePengelola, uploadMahasiswaFoto.single('foto'), controller9.editPenghuni);
router.post("/pengelola/dataPenghuni/toggle/:mahasiswa_id", authMiddleware, requirePengelola, controller9.toggleStatusPenghuni);
router.get("/pengelola/dataPenghuni/get/:id", authMiddleware, requirePengelola, controller9.getPenghuniById);

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



module.exports = router;