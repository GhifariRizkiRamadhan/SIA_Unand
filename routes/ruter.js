const express = require("express");
const router = express.Router();
const { authMiddleware, redirectIfAuthenticated, requireRole } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const validateEmail = require("../middlewares/validateEmail");
const forgotPasswordLimiter = require("../middlewares/rateLimiter");

// Redirect root to login
router.get("/", (req, res) => {
  res.redirect("/login");
});

// Auth Controllers
const controller1 = require("../controller/conLogin");
const controller2 = require("../controller/conRegis");


// Public routes (redirect if authenticated)
router.get("/login", redirectIfAuthenticated, controller1.showLogin);
router.post('/login', redirectIfAuthenticated, controller1.authController.login);
router.get("/register", redirectIfAuthenticated, controller2.regcon.showRegis);
router.post("/register", redirectIfAuthenticated, controller2.regcon.register);
router.get("/logout", controller1.authController.logout);

//mahasiswa
const controller3 = require("../controller/conDshMhs");
const controller5 = require("../controller/conPbyr");
const controller6 = require("../controller/conBbsAsr");
router.get("/mahasiswa/dashboard", authMiddleware, controller3.showDashboard);  
router.get("/mahasiswa/pembayaran", authMiddleware, controller5.showPembayaran);
router.get("/mahasiswa/bebas-asrama", authMiddleware, controller6.showBebasAsrama);


//pengelola
const controller4 = require("../controller/conDhsPnl");
const controller7 = require("../controller/conBbsAsrPnl");
router.get("/pengelola/dashboard", authMiddleware, controller4.showDashboard);
router.get("/pengelola/pengelola-bebas-asrama", authMiddleware, controller7.showBebasAsramaPengelola);

module.exports = router;