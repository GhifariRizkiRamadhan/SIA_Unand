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

//mahasiswa
const controller3 = require("../controller/conDshMhs");
router.get("/mahasiswa/dashboard", authMiddleware, controller3.showDashboard);  


//pengelola
const controller4 = require("../controller/conDhsPnl");
router.get("/pengelola/dashboard", authMiddleware, controller4.showDashboard);

module.exports = router;