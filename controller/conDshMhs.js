require('dotenv').config();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const ejs = require('ejs');
const User = require('../models/userModels');
const path = require('path');
const { prisma } = require('../config/database');

const showDashboard = async (req, res) => {
   try {
    const userId = req.session?.user_id || req.user?.user_id;
    if (!userId) {
      return res.redirect('/login');
    }

    const user = await User.findById(userId);
    const mahasiswaId = req.user?.mahasiswa_id;
    if (!mahasiswaId) {
      return res.status(403).send('Forbidden: Akun Anda tidak terhubung dengan data mahasiswa.');
    }
    const totalUsers = await User.countAll();
    const totalIzin = await prisma.izinkeluar.count({
      where: { mahasiswa_id: mahasiswaId }
    });

    // Hitung total laporan kerusakan
    const totalLaporan = await prisma.pelaporankerusakan.count({
      where: { mahasiswa_id: mahasiswaId }
    });

    // Hitung total pengajuan surat bebas asrama
    const totalBebasAsrama = await prisma.suratbebasasrama.count({
      where: { mahasiswa_id: mahasiswaId }
    });

    const sevenDaysAgo = new Date(new Date().setDate(new Date().getDate() - 7));

    const perubahanIzin = await prisma.izinkeluar.count({
      where: {
        mahasiswa_id: mahasiswaId,
        submitted_at: { gte: sevenDaysAgo } // gte = greater than or equal
      }
    });

    const perubahanLaporan = await prisma.pelaporankerusakan.count({
      where: {
        mahasiswa_id: mahasiswaId,
        date_submitted: { gte: sevenDaysAgo }
      }
    });

    const perubahanBebasAsrama = await prisma.suratbebasasrama.count({
      where: {
        mahasiswa_id: mahasiswaId,
        tanggal_pengajuan: { gte: sevenDaysAgo }
      }
    });

    // Paginasi
    const page = parseInt(req.query.page) || 1;
    const limit = 9; // items per page
    const skip = (page - 1) * limit;

    // Ambil total count untuk paginasi
    const totalItems = await prisma.pemberitahuan.count();
    const totalPages = Math.ceil(totalItems / limit);

    // Ambil data pemberitahuan dengan paginasi
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

    // Tambahkan base URL ke path gambar
    pemberitahuanList.forEach(item => {
      if (item.image) {
        item.image = item.image.startsWith('/') ? item.image : '/' + item.image;
      }
    });

    // Render isi dashboard.ejs sebagai body
    const body = await ejs.renderFile(
      path.join(__dirname, '../views/mahasiswa/dashboard.ejs'),
      { 
        user, 
        totalUsers,
        pemberitahuanList,
        stats: { 
            izin: totalIzin,
            laporan: totalLaporan,
            bebasAsrama: totalBebasAsrama,
            perubahanIzin: perubahanIzin,
            perubahanLaporan: perubahanLaporan,
            perubahanBebasAsrama: perubahanBebasAsrama
        },
        pagination: {
          page,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    );
    
    res.render("layouts/main", { 
      title: 'Dashboard - MYASRAMA',
      pageTitle: 'Dashboard',
      activeMenu: 'dashboard',
      user: {
        name: user.name,
        role: user.role,
        avatar: user.avatar || user.name.charAt(0)
      },
      body,
      activePage: "",
      error: null,
      success: null
    });
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ message: error });
  }
};

// API endpoint untuk mengambil detail pemberitahuan
const getPemberitahuanDetail = async (req, res) => {
  try {
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
    console.error('Error getPemberitahuanDetail:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Terjadi kesalahan server',
      error: error.message 
    });
  }
};

module.exports = {
    showDashboard,
    getPemberitahuanDetail
};