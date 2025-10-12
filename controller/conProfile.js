require('dotenv').config();
const bcrypt = require('bcrypt');
const ejs = require('ejs');
const { prisma } = require('../config/database');
const User = require('../models/userModels');
const path = require('path');
const fs = require('fs');

const showProfile = async (req, res) => {
  try {
    const userId = req.session?.user_id || req.user?.user_id;
    
    if (!userId) {
      return res.redirect('/login');
    }

    // Ambil data user
    const user = await prisma.user.findUnique({
      where: { user_id: userId }
    });

    if (!user) {
      return res.redirect('/login');
    }

    // Jika user adalah mahasiswa, ambil juga data mahasiswa
    let mahasiswaData = null;
    if (user.role === 'mahasiswa') {
      mahasiswaData = await prisma.mahasiswa.findFirst({
        where: { user_id: userId }
      });
    }

    // Render isi profile.ejs sebagai body
    const body = await ejs.renderFile(
      path.join(__dirname, '../views/profile.ejs'),
      {
        user,
        profileData: {
          ...user,
          mahasiswa: mahasiswaData
        },
        error: req.query.error || null,
        success: req.query.success || null
      }
    );

    // Tentukan activeMenu berdasarkan role
    const activeMenu = user.role === 'mahasiswa' ? 'mahasiswa-profile' : 'pengelola-profile';

    res.render('layouts/main', {
      title: 'Profile Saya',
      pageTitle: 'Profile Saya',
      activeMenu: activeMenu,
      body,
      user: {
        name: user.name,
        role: user.role,
        avatar: user.avatar || user.name.charAt(0)
      },
      activePage: "profile",
      error: null,
      success: null
    });

  } catch (error) {
    console.error('Error showing profile:', error);
    res.status(500).render('error', { message: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.session?.user_id || req.user?.user_id;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized' 
      });
    }

    const { name, email, nim, jurusan, oldPassword, newPassword, confirmPassword } = req.body;

    // Validasi input
    if (!name || !email) {
      return res.redirect('/profile?error=' + encodeURIComponent('Nama dan email harus diisi'));
    }

    // Ambil data user saat ini
    const currentUser = await prisma.user.findUnique({
      where: { user_id: userId },
      include: {
        mahasiswa: true
      }
    });

    if (!currentUser) {
      return res.redirect('/profile?error=' + encodeURIComponent('User tidak ditemukan'));
    }

    // Cek apakah email sudah digunakan user lain
    if (email !== currentUser.email) {
      const emailExists = await prisma.user.findFirst({
        where: {
          email: email,
          user_id: { not: userId }
        }
      });

      if (emailExists) {
        return res.redirect('/profile?error=' + encodeURIComponent('Email sudah digunakan'));
      }
    }

    // Persiapkan data update untuk user
    const updateUserData = {
      name,
      email
    };

    // Jika ada perubahan password
    if (oldPassword || newPassword || confirmPassword) {
      // Validasi semua field password terisi
      if (!oldPassword || !newPassword || !confirmPassword) {
        return res.redirect('/profile?error=' + encodeURIComponent('Semua field password harus diisi'));
      }

      // Validasi password baru dan konfirmasi cocok
      if (newPassword !== confirmPassword) {
        return res.redirect('/profile?error=' + encodeURIComponent('Password baru dan konfirmasi tidak cocok'));
      }

      // Validasi panjang password baru
      if (newPassword.length < 6) {
        return res.redirect('/profile?error=' + encodeURIComponent('Password baru minimal 6 karakter'));
      }

      // Verifikasi password lama
      const isPasswordValid = await bcrypt.compare(oldPassword, currentUser.password);
      if (!isPasswordValid) {
        return res.redirect('/profile?error=' + encodeURIComponent('Password lama tidak benar'));
      }

      // Hash password baru
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      updateUserData.password = hashedPassword;
    }

    // Update data user
    await prisma.user.update({
      where: { user_id: userId },
      data: updateUserData
    });

    // Jika user adalah mahasiswa, update data mahasiswa
    if (currentUser.role === 'mahasiswa' && currentUser.mahasiswa.length > 0) {
      const mahasiswaId = currentUser.mahasiswa[0].mahasiswa_id;
      
      // Persiapkan data update mahasiswa
      const updateMahasiswaData = {
        nama: name
      };

      // Update jurusan jika ada
      if (jurusan) {
        updateMahasiswaData.jurusan = jurusan;
      }

      // Update NIM jika ada dan berbeda
      if (nim && nim !== currentUser.mahasiswa[0].nim) {
        // Cek apakah NIM sudah digunakan mahasiswa lain
        const nimExists = await prisma.mahasiswa.findFirst({
          where: {
            nim: nim,
            mahasiswa_id: { not: mahasiswaId }
          }
        });

        if (nimExists) {
          return res.redirect('/profile?error=' + encodeURIComponent('NIM sudah digunakan'));
        }

        updateMahasiswaData.nim = nim;
      }

      // Jika ada upload foto baru
      if (req.file) {
        // Hapus foto lama jika ada
        const oldFoto = currentUser.mahasiswa[0].foto;
        if (oldFoto) {
          const oldPhotoPath = path.join(__dirname, '../public', oldFoto);
          if (fs.existsSync(oldPhotoPath)) {
            try {
              fs.unlinkSync(oldPhotoPath);
            } catch (err) {
              console.error('Error deleting old photo:', err);
            }
          }
        }

        updateMahasiswaData.foto = `/image/mahasiswa/${req.file.filename}`;
      }

      // Update data mahasiswa
      await prisma.mahasiswa.update({
        where: { mahasiswa_id: mahasiswaId },
        data: updateMahasiswaData
      });
    }

    res.redirect('/profile?success=' + encodeURIComponent('Profile berhasil diperbarui'));

  } catch (error) {
    console.error('Error updating profile:', error);
    
    // Hapus file jika terjadi error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }

    res.redirect('/profile?error=' + encodeURIComponent('Terjadi kesalahan: ' + error.message));
  }
};

module.exports = {
  showProfile,
  updateProfile
};