require('dotenv').config();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs');
const { prisma } = require('../config/database');
const User = require('../models/userModels');

const showPemberitahuanPengelola = async (req, res) => {
  try {
    const userId = req.session?.user_id || req.user?.user_id;
    if (!userId) return res.redirect('/login');

    const user = await User.findById(userId);
    if (user.role !== 'pengelola') {
      return res.status(403).render('error', { message: 'Akses ditolak' });
    }

    // Paginasi
    const page = parseInt(req.query.page) || 1;
    const limit = 20; // 20 items per page
    const skip = (page - 1) * limit;

    // Hitung total items untuk paginasi
    const totalItems = await prisma.pemberitahuan.count();
    const totalPages = Math.ceil(totalItems / limit);

    // Ambil pemberitahuan dengan paginasi
    const pemberitahuanList = await prisma.pemberitahuan.findMany({
      orderBy: { date: 'desc' },
      skip: skip,
      take: limit,
      include: {
        pengelolaasrama: {
          include: { 
            user: { 
              select: { name: true } 
            } 
          }
        }
      }
    });

    const body = await ejs.renderFile(
      path.join(__dirname, '../views/pengelola/pemberitahuan.ejs'),
      { 
        user, 
        pemberitahuanList,
        pagination: {
          page,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
          totalItems
        }
      }
    );

    res.render('layouts/main', {
      title: 'Kelola Pemberitahuan',
      pageTitle: 'Kelola Pemberitahuan',
      activeMenu: 'pemberitahuan',
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
    console.error('Error showPemberitahuanPengelola:', error);
    res.status(500).render('error', { message: error.message });
  }
};

const tambahPemberitahuan = async (req, res) => {
  try {
    console.log("📩 Body:", req.body);
    console.log("📸 File:", req.file);

    const userId = req.session?.user_id || req.user?.user_id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ success: false, message: "Judul dan isi harus diisi" });
    }

    // Cari pengelola berdasarkan user_id
    const pengelola = await prisma.pengelolaasrama.findFirst({
      where: { user_id: userId },
    });

    if (!pengelola) {
      return res.status(404).json({ success: false, message: "Pengelola tidak ditemukan" });
    }

    // Siapkan data untuk create
    const createData = {
      title: title.trim(),
      content: content.trim(),
      Pengelola_id: pengelola.Pengelola_id,
    };

    // Tambahkan image jika ada
    if (req.file) {
      createData.image = `/uploads/pemberitahuan/${req.file.filename}`;
    }

    const newPemberitahuan = await prisma.pemberitahuan.create({
      data: createData,
      include: {
        pengelolaasrama: {
          include: { user: { select: { name: true } } }
        }
      }
    });

    // Import notification controller di awal file
    const notificationController = require('./notification');
    
    // Kirim notifikasi ke semua mahasiswa
    const allMahasiswa = await prisma.mahasiswa.findMany({
      select: {
        user_id: true
      }
    });
    
    // Kirim notifikasi ke setiap mahasiswa
    for (const mahasiswa of allMahasiswa) {
      await notificationController.createNotification(
        mahasiswa.user_id,
        newPemberitahuan.title,
        newPemberitahuan.content,
        'pemberitahuan',
        newPemberitahuan.pemberitahuan_id
      );
    }

    console.log("✅ Berhasil simpan:", newPemberitahuan);

    res.json({ 
      success: true, 
      message: "Pemberitahuan berhasil ditambahkan", 
      data: newPemberitahuan 
    });

  } catch (err) {
    console.error("❌ Error tambah pemberitahuan:", err);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: err.message 
    });
  }
};

const editPemberitahuan = async (req, res) => {
  try {
    const userId = req.session?.user_id || req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { id } = req.params;
    const { title, content } = req.body;

    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      return res.status(400).json({ success: false, message: 'ID tidak valid' });
    }

    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Judul dan isi harus diisi' });
    }

    // Cari pengelola
    const pengelola = await prisma.pengelolaasrama.findFirst({
      where: { user_id: userId }
    });

    if (!pengelola) {
      return res.status(404).json({ success: false, message: 'Pengelola tidak ditemukan' });
    }

    // Cek apakah pemberitahuan ada dan milik pengelola ini
    const existing = await prisma.pemberitahuan.findFirst({
      where: {
        pemberitahuan_id: parsedId,
        Pengelola_id: pengelola.Pengelola_id
      }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Pemberitahuan tidak ditemukan atau bukan milik Anda' });
    }

    // Siapkan data update
    const updateData = {
      title: title.trim(),
      content: content.trim()
    };

    // Handle image upload
    if (req.file) {
      // Hapus gambar lama jika ada
      if (existing.image) {
        const oldImagePath = path.join(__dirname, '../public', existing.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      updateData.image = `/uploads/pemberitahuan/${req.file.filename}`;
    }

    // Update data
    const updated = await prisma.pemberitahuan.update({
      where: { pemberitahuan_id: parsedId },
      data: updateData,
      include: {
        pengelolaasrama: {
          include: { user: { select: { name: true } } }
        }
      }
    });

    return res.json({
      success: true,
      message: 'Pemberitahuan berhasil diperbarui',
      data: updated
    });

  } catch (err) {
    console.error('Error editPemberitahuan:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: err.message 
    });
  }
};

const hapusPemberitahuan = async (req, res) => {
  try {
    const userId = req.session?.user_id || req.user?.user_id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const user = await User.findById(userId);
    if (user.role !== 'pengelola') {
      return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }

    const { id } = req.params;
    const parsedId = parseInt(id);
    
    if (isNaN(parsedId)) {
      return res.status(400).json({ success: false, message: 'ID tidak valid' });
    }

    // Gunakan transaksi untuk memastikan konsistensi data
    const result = await prisma.$transaction(async (prisma) => {
      // Cari pengelola berdasarkan user_id
      const pengelola = await prisma.pengelolaasrama.findFirst({
        where: { 
          user: {
            user_id: userId
          }
        }
      });

      if (!pengelola) {
        throw new Error('Pengelola tidak ditemukan');
      }

      // Cek apakah pemberitahuan ada dan milik pengelola ini
      const existing = await prisma.pemberitahuan.findFirst({
        where: {
          pemberitahuan_id: parsedId,
          Pengelola_id: pengelola.Pengelola_id
        }
      });

      if (!existing) {
        throw new Error('Pemberitahuan tidak ditemukan atau bukan milik Anda');
      }

      // Hapus notifikasi terkait terlebih dahulu
      await prisma.notification.deleteMany({
        where: {
          type: 'pemberitahuan',
          reference_id: parsedId.toString()
        }
      });

      // Hapus gambar jika ada
      if (existing.image) {
        const imagePath = path.join(__dirname, '../public', existing.image);
        if (fs.existsSync(imagePath)) {
          try {
            fs.unlinkSync(imagePath);
          } catch (err) {
            console.error('Error deleting image:', err);
            // Lanjutkan eksekusi meskipun gagal menghapus file
          }
        }
      }

      // Hapus pemberitahuan dari database
      return await prisma.pemberitahuan.delete({ 
        where: { pemberitahuan_id: parsedId } 
      });
    });

    // Emit socket event untuk memberitahu client bahwa ada pemberitahuan yang dihapus
    if (global.io) {
      global.io.emit('notification_deleted', {
        type: 'pemberitahuan',
        id: parsedId
      });
    }

    res.json({ 
      success: true, 
      message: 'Pemberitahuan berhasil dihapus',
      data: result
    });

  } catch (error) {
    console.error('Error hapusPemberitahuan:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Terjadi kesalahan server',
      error: error.message 
    });
  }
};

const getPemberitahuan = async (req, res) => {
  try {
    const userId = req.session?.user_id || req.user?.user_id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const user = await User.findById(userId);
    if (user.role !== 'pengelola') {
      return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }

    const { id } = req.params;
    const parsedId = parseInt(id);
    
    if (isNaN(parsedId)) {
      return res.status(400).json({ success: false, message: 'ID tidak valid' });
    }

    const pemberitahuan = await prisma.pemberitahuan.findUnique({
      where: { pemberitahuan_id: parsedId },
      include: {
        pengelolaasrama: {
          include: { user: { select: { name: true } } }
        }
      }
    });

    if (!pemberitahuan) {
      return res.status(404).json({ success: false, message: 'Pemberitahuan tidak ditemukan' });
    }

    res.json({ success: true, data: pemberitahuan });

  } catch (error) {
    console.error('Error getPemberitahuan:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Terjadi kesalahan server',
      error: error.message 
    });
  }
};

module.exports = {
  showPemberitahuanPengelola,
  tambahPemberitahuan,
  editPemberitahuan,
  hapusPemberitahuan,
  getPemberitahuan
};