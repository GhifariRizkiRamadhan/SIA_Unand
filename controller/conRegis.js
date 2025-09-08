const User = require('../models/userModels');

const regcon = {
  showRegis: async (req, res) => {
    try {
      res.render("register", { 
        activePage: "register",
        error: null,
        success: null
      });
    } catch (error) {
      console.log("error", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  register: async (req, res) => {
    try {
      // Registrasi hanya untuk mahasiswa, jadi hardcode role
      const { name, email, password, confirmPassword, nim } = req.body;

      // Basic validation
      if (!name || !email || !password || !confirmPassword || !nim) {
        return res.render("register", {
          activePage: "register",
          error: "Semua field harus diisi",
          success: null
        });
      }

      // Validate password match
      if (password !== confirmPassword) {
        return res.render("register", {
          activePage: "register",
          error: "Password dan konfirmasi password tidak cocok",
          success: null
        });
      }

      // Validate password length
      if (password.length < 6) {
        return res.render("register", {
          activePage: "register",
          error: "Password minimal 6 karakter",
          success: null
        });
      }

      // Check if email already exists
      const emailExists = await User.emailExists(email);
      if (emailExists) {
        return res.render("register", {
          activePage: "register",
          error: "Email sudah terdaftar",
          success: null
        });
      }

      // Check if NIM already exists
      const nimExists = await User.nimExists(nim);
      if (nimExists) {
        return res.render("register", {
          activePage: "register",
          error: "NIM sudah terdaftar",
          success: null
        });
      }

      // Generate user_id
      const timestamp = Date.now();
      const user_id = `mahasiswa_${timestamp}`;

      // Prepare user data - PERBAIKAN: pastikan semua field ada
      const userData = {
        user_id,
        name,
        email,
        password,
        role: 'mahasiswa', // Hardcode untuk mahasiswa saja
        nim
      };

      // Create user
      const newUser = await User.create(userData);

      res.render("login", {
        activePage: "login",
        error: null,
        success: "Registrasi berhasil! Silakan login dengan akun Anda."
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.render("register", {
        activePage: "register",
        error: "Terjadi kesalahan server",
        success: null
      });
    }
  }
};

module.exports = { regcon };