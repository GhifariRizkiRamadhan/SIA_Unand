require('dotenv').config();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/userModels');

const showLogin = async (req, res) => {
  try {
    res.render("login", { 
      activePage: "login",
      error: null,
      success: null
    });
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ message: error });
  }
};

// Helper function untuk redirect berdasarkan role
const redirectByRole = (res, user) => {
  if (user.role === 'mahasiswa') {
    return res.redirect('/mahasiswa/dashboard');
  } else if (user.role === 'pengelola') {
    return res.redirect('/pengelola/dashboard');
  } else {
    return res.redirect('/'); // Fallback redirect
  }
};

const authController = {
    async login(req, res) {
    // FIX: deklarasi di luar try agar tersedia di catch
    let isApiRequest = false;

    try {
      const { email, password, remember } = req.body;

      // Tentukan apakah request adalah API/JSON
      isApiRequest = (
        (req.originalUrl && req.originalUrl.startsWith('/api/')) ||
        (req.get && typeof req.get === 'function' && (req.get('accept') || '').includes('application/json')) ||
        (req.is && req.is('application/json')) ||
        (req.xhr === true)
      );

      // ============================
      // Validation
      // ============================
      if (!email || !password) {
        if (isApiRequest) {
          return res.status(400).json({
            success: false,
            message: "Email dan password harus diisi"
          });
        }
        return res.render("login", {
          activePage: "login",
          error: "Email dan password harus diisi",
          success: null
        });
      }

      // ============================
      // Find user
      // ============================
      const user = await User.findByEmail(email);
      if (!user) {
        if (isApiRequest) {
          return res.status(401).json({
            success: false,
            message: "Email atau password salah"
          });
        }
        return res.render("login", {
          activePage: "login",
          error: "Email atau password salah",
          success: null
        });
      }

      // ============================
      // Verify password
      // ============================
      const isValidPassword = await User.verifyPassword(password, user.password);
      if (!isValidPassword) {
        if (isApiRequest) {
          return res.status(401).json({
            success: false,
            message: "Email atau password salah"
          });
        }
        return res.render("login", {
          activePage: "login",
          error: "Email atau password salah",
          success: null
        });
      }

      // ============================
      // Generate JWT
      // ============================
      const tokenPayload = {
        user_id: user.user_id,
        email: user.email,
        role: user.role,
        name: user.name
      };

      const tokenOptions = remember ? { expiresIn: '30d' } : { expiresIn: '1d' };
      const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, tokenOptions);

      // Set cookie
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: remember
          ? 30 * 24 * 60 * 60 * 1000
          : 24 * 60 * 60 * 1000
      };

      res.cookie('token', token, cookieOptions);

      // ============================
      // Response
      // ============================
      if (isApiRequest) {
        return res.status(200).json({
          message: "Login berhasil",
          token,
          role: user.role
        });
      }

      return redirectByRole(res, user);

    } catch (error) {
      console.error('Login error:', error);

      // ============================
      // FIX: sekarang isApiRequest aman
      // ============================
      if (isApiRequest) {
        return res.status(500).json({
          success: false,
          message: "Terjadi kesalahan server"
        });
      }

      return res.render("login", {
        activePage: "login",
        error: "Terjadi kesalahan server",
        success: null
      });
    }
  },

  async logout(req, res) {
    try {
      res.clearCookie('token');
      res.redirect('/login');
    } catch (error) {
      console.error('Logout error:', error);
      res.redirect('/login');
    }
  }
};

module.exports = {
  showLogin,
  authController,
  redirectByRole
};