// ==========================================================
// FILE: controller/conDshMhs.js (LENGKAP & DIPERBAIKI)
// ==========================================================

require('dotenv').config();
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

    const mahasiswaId = req.user?.mahasiswa_id;
    if (!mahasiswaId) {
      return res.status(403).render('error', { 
        message: 'Forbidden: Akun Anda tidak terhubung dengan data mahasiswa.' 
      });
    }

    // --- PANGGILAN DI LUAR TRANSAKSI ---
    const user = await User.findById(userId);
    const totalUsers = await User.countAll();
    // --- AKHIR PANGGILAN DI LUAR TRANSAKSI ---

    const sevenDaysAgo = new Date(new Date().setDate(new Date().getDate() - 7));
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;

    // --- TRANSAKSI HANYA UNTUK QUERY PRISMA MURNI ---
    const results = await prisma.$transaction([
      // 0: Total Izin
      prisma.izinkeluar.count({ where: { mahasiswa_id: mahasiswaId } }),
      // 1: Total Laporan
      prisma.pelaporankerusakan.count({ where: { mahasiswa_id: mahasiswaId } }),
      // 2: Total Bebas Asrama
      prisma.suratbebasasrama.count({ where: { mahasiswa_id: mahasiswaId } }),
      // 3: Perubahan Izin (7 hari)
      prisma.izinkeluar.count({
        where: { mahasiswa_id: mahasiswaId, submitted_at: { gte: sevenDaysAgo } }
      }),
      // 4: Perubahan Laporan (7 hari)
      prisma.pelaporankerusakan.count({
        where: { mahasiswa_id: mahasiswaId, date_submitted: { gte: sevenDaysAgo } }
      }),
      // 5: Perubahan Bebas Asrama (7 hari)
      prisma.suratbebasasrama.count({
        where: { mahasiswa_id: mahasiswaId, tanggal_pengajuan: { gte: sevenDaysAgo } }
      }),
      // 6: Total Pemberitahuan (untuk paginasi)
      prisma.pemberitahuan.count(),
      // 7: List Pemberitahuan (untuk paginasi)
      prisma.pemberitahuan.findMany({
        orderBy: { date: 'desc' },
        skip: skip,
        take: limit,
        include: {
          pengelolaasrama: {
            include: { user: { select: { name: true } } }
          }
        }
      })
    ]);

    // Ekstrak hasil dari array (8 item)
    const totalIzin = results[0];
    const totalLaporan = results[1];
    const totalBebasAsrama = results[2];
    const perubahanIzin = results[3];
    const perubahanLaporan = results[4];
    const perubahanBebasAsrama = results[5];
    const totalItems = results[6];
    const pemberitahuanList = results[7];
    
    const totalPages = Math.ceil(totalItems / limit);

    pemberitahuanList.forEach(item => {
      if (item.image) {
        item.image = item.image.startsWith('/') ? item.image : '/' + item.image;
      }
    });

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
    res.status(500).render('error', { message: error.message || "Terjadi kesalahan pada server" });
  }
};

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