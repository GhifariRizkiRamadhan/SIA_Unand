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

const authController = {
  async login(req, res) {
    try {
      const { email, password, remember } = req.body;

      // Validation
      if (!email || !password) {
        return res.render("login", {
          activePage: "login",
          error: "Email dan password harus diisi",
          success: null
        });
      }

      // Find user
      const user = await User.findByEmail(email);
      if (!user) {
        return res.render("login", {
          activePage: "login",
          error: "Email atau password salah",
          success: null
        });
      }

      // Verify password
      const isValidPassword = await User.verifyPassword(password, user.password);
      if (!isValidPassword) {
        return res.render("login", {
          activePage: "login",
          error: "Email atau password salah",
          success: null
        });
      }

      // Generate JWT token
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
        maxAge: remember ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
      };

      res.cookie('token', token, cookieOptions);

      // Redirect based on role
      if (user.role === 'mahasiswa') {
        res.redirect('/mahasiswa/dashboard');
      } else if (user.role === 'pengelola') {
        res.redirect('/pengelola/dashboard');
      } else {
        res.redirect('/dashboard');
      }

    } catch (error) {
      console.error('Login error:', error);
      res.render("login", {
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
  authController
};