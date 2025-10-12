require('dotenv').config();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const ejs = require('ejs');
const User = require('../models/userModels');
const { prisma } = require('../config/database');
const path = require('path');
const fs = require('fs');

const showDtPenghuni = async (req, res) => {
  try {
    // Ambil user_id dari session atau JWT
    const userId = req.session?.user_id || req.user?.user_id;
    if (!userId) {
      return res.redirect('/login');
    }

    // Ambil data user dari database
    const user = await User.findById(userId);

    // Ambil semua data mahasiswa dengan relasi ke user
    const penghuniAktif = await prisma.mahasiswa.findMany({
      where: {
        status: 'aktif'
      },
      include: {
        user: {
          select: {
            email: true
          }
        }
      },
      orderBy: {
        nama: 'asc'
      }
    });

    const penghuniTidakAktif = await prisma.mahasiswa.findMany({
      where: {
        status: {
          not: 'aktif'
        }
      },
      include: {
        user: {
          select: {
            email: true
          }
        }
      },
      orderBy: {
        nama: 'asc'
      }
    });

    // Render isi dataPenghuni.ejs sebagai body
    const body = await ejs.renderFile(
      path.join(__dirname, '../views/pengelola/dataPenghuni.ejs'),
      {
        user,
        penghuniAktif,
        penghuniTidakAktif,
        error: req.query.error || null,
        success: req.query.success || null
      }
    );

    res.render('layouts/main', {
      title: 'Data Penghuni',
      pageTitle: 'Data Penghuni',
      activeMenu: 'pengelola-data-penghuni',
      body,
      user: {
        name: user.name,
        role: user.role,
        avatar: user.avatar || user.name.charAt(0)
      },
      activePage: "",
      error: null,
      success: null
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { message: error.message });
  }
};

const tambahPenghuni = async (req, res) => {
  try {
    const { nama, nim, jurusan, status, kipk } = req.body;

    // Validasi
    if (!nama || !nim || !jurusan) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.redirect('/pengelola/dataPenghuni?error=' + encodeURIComponent('Semua field harus diisi'));
    }

    // Cek apakah NIM sudah ada
    const nimExists = await prisma.mahasiswa.findUnique({
      where: { nim }
    });

    if (nimExists) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.redirect('/pengelola/dataPenghuni?error=' + encodeURIComponent('NIM sudah terdaftar'));
    }

    // Generate user_id dan email default
    const timestamp = Date.now();
    const user_id = `mahasiswa_${timestamp}`;
    const defaultEmail = `${nim}@student.unand.ac.id`;
    const defaultPassword = nim; // Password default = NIM

    // Path foto
    const fotoPath = req.file ? `/image/mahasiswa/${req.file.filename}` : null;

    // Hash password
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // Buat user terlebih dahulu
    await prisma.user.create({
      data: {
        user_id,
        name: nama,
        email: defaultEmail,
        password: hashedPassword,
        role: 'mahasiswa'
      }
    });

    // Buat data mahasiswa
    await prisma.mahasiswa.create({
      data: {
        nim,
        nama,
        jurusan,
        foto: fotoPath,
        status: status || 'aktif',
        kipk: kipk || 'ya', // Default KIP-K adalah "ya"
        user_id
      }
    });

    res.redirect('/pengelola/dataPenghuni?success=' + encodeURIComponent('Data penghuni berhasil ditambahkan'));
  } catch (error) {
    console.error('Error tambah penghuni:', error);
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }
    res.redirect('/pengelola/dataPenghuni?error=' + encodeURIComponent('Terjadi kesalahan: ' + error.message));
  }
};

const editPenghuni = async (req, res) => {
  try {
    const { mahasiswa_id, nama, nim, jurusan, status, kipk } = req.body;

    // Validasi
    if (!mahasiswa_id || !nama || !nim || !jurusan || !status) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.redirect('/pengelola/dataPenghuni?error=' + encodeURIComponent('Semua field harus diisi'));
    }

    // Cek apakah mahasiswa ada
    const mahasiswa = await prisma.mahasiswa.findUnique({
      where: { mahasiswa_id: parseInt(mahasiswa_id) }
    });

    if (!mahasiswa) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.redirect('/pengelola/dataPenghuni?error=' + encodeURIComponent('Data mahasiswa tidak ditemukan'));
    }

    // Cek apakah NIM sudah digunakan mahasiswa lain
    const nimExists = await prisma.mahasiswa.findFirst({
      where: {
        nim,
        mahasiswa_id: {
          not: parseInt(mahasiswa_id)
        }
      }
    });

    if (nimExists) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.redirect('/pengelola/dataPenghuni?error=' + encodeURIComponent('NIM sudah digunakan mahasiswa lain'));
    }

    // Siapkan data update
    const updateData = {
      nim,
      nama,
      jurusan,
      status,
      kipk: kipk || 'ya'
    };

    // Jika ada foto baru
    if (req.file) {
      // Hapus foto lama jika ada
      if (mahasiswa.foto) {
        const oldPhotoPath = path.join(__dirname, '../public', mahasiswa.foto);
        if (fs.existsSync(oldPhotoPath)) {
          fs.unlinkSync(oldPhotoPath);
        }
      }
      updateData.foto = `/image/mahasiswa/${req.file.filename}`;
    }

    // Update data mahasiswa
    await prisma.mahasiswa.update({
      where: { mahasiswa_id: parseInt(mahasiswa_id) },
      data: updateData
    });

    // Update nama di tabel user
    await prisma.user.update({
      where: { user_id: mahasiswa.user_id },
      data: { name: nama }
    });

    res.redirect('/pengelola/dataPenghuni?success=' + encodeURIComponent('Data penghuni berhasil diupdate'));
  } catch (error) {
    console.error('Error edit penghuni:', error);
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }
    res.redirect('/pengelola/dataPenghuni?error=' + encodeURIComponent('Terjadi kesalahan: ' + error.message));
  }
};

const toggleStatusPenghuni = async (req, res) => {
  try {
    const { mahasiswa_id } = req.params;

    // Cek apakah mahasiswa ada
    const mahasiswa = await prisma.mahasiswa.findUnique({
      where: { mahasiswa_id: parseInt(mahasiswa_id) }
    });

    if (!mahasiswa) {
      return res.redirect('/pengelola/dataPenghuni?error=' + encodeURIComponent('Data mahasiswa tidak ditemukan'));
    }

    // Toggle status
    const newStatus = mahasiswa.status === 'aktif' ? 'tidak aktif' : 'aktif';

    await prisma.mahasiswa.update({
      where: { mahasiswa_id: parseInt(mahasiswa_id) },
      data: { status: newStatus }
    });

    res.redirect('/pengelola/dataPenghuni?success=' + encodeURIComponent(`Status penghuni berhasil diubah menjadi ${newStatus}`));
  } catch (error) {
    console.error('Error toggle status:', error);
    res.redirect('/pengelola/dataPenghuni?error=' + encodeURIComponent('Terjadi kesalahan: ' + error.message));
  }
};

const getPenghuniById = async (req, res) => {
  try {
    const { id } = req.params;

    const mahasiswa = await prisma.mahasiswa.findUnique({
      where: { mahasiswa_id: parseInt(id) },
      include: {
        user: {
          select: {
            email: true
          }
        }
      }
    });

    if (!mahasiswa) {
      return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
    }

    res.json({ success: true, data: mahasiswa });
  } catch (error) {
    console.error('Error get penghuni:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  showDtPenghuni,
  tambahPenghuni,
  editPenghuni,
  toggleStatusPenghuni,
  getPenghuniById
};