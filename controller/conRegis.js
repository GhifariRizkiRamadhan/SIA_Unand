const User = require('../models/userModels');
const fs = require('fs');
const path = require('path');

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
      const { name, email, password, confirmPassword, nim, jurusan } = req.body;
      
      // Basic validation
      if (!name || !email || !password || !confirmPassword || !nim || !jurusan) {
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.render("register", {
          activePage: "register",
          error: "Semua field harus diisi",
          success: null
        });
      }
      
      // Validate foto
      if (!req.file) {
        return res.render("register", {
          activePage: "register",
          error: "Foto mahasiswa wajib diupload",
          success: null
        });
      }
      
      // Validate password match
      if (password !== confirmPassword) {
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.render("register", {
          activePage: "register",
          error: "Password dan konfirmasi password tidak cocok",
          success: null
        });
      }
      
      // Validate password length
      if (password.length < 6) {
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.render("register", {
          activePage: "register",
          error: "Password minimal 6 karakter",
          success: null
        });
      }
      
      // Check if email already exists
      const emailExists = await User.emailExists(email);
      if (emailExists) {
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.render("register", {
          activePage: "register",
          error: "Email sudah terdaftar",
          success: null
        });
      }
      
      // Check if NIM already exists
      const nimExists = await User.nimExists(nim);
      if (nimExists) {
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.render("register", {
          activePage: "register",
          error: "NIM sudah terdaftar",
          success: null
        });
      }
      
      // Generate user_id
      const timestamp = Date.now();
      const user_id = `mahasiswa_${timestamp}`;
      
      // Path foto relatif untuk disimpan di database
      const fotoPath = `/image/mahasiswa/${req.file.filename}`;
      
      // Prepare user data
      const userData = {
        user_id,
        name,
        email,
        password,
        role: 'mahasiswa',
        nim,
        jurusan,
        foto: fotoPath,
        kipk: 'ya' // Default status KIP-K adalah "ya"
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
      
      // Hapus file jika terjadi error
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.error('Error deleting file:', unlinkError);
        }
      }
      
      res.render("register", {
        activePage: "register",
        error: "Terjadi kesalahan server: " + error.message,
        success: null
      });
    }
  }
};

module.exports = { regcon };