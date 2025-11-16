require('dotenv').config();
const bcrypt = require('bcrypt'); // (Tidak terpakai di sini)
const jwt = require('jsonwebtoken'); // (Tidak terpakai di sini)
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

    // --- PERBAIKAN: Panggil query non-Prisma SEBELUM transaksi ---
    const user = await User.findById(userId);
    // --- AKHIR PERBAIKAN ---

    const sevenDaysAgo = new Date(new Date().setDate(new Date().getDate() - 7));

    // --- PERBAIKAN: Transaksi sekarang HANYA berisi query Prisma murni ---
    const results = await prisma.$transaction([
      // 0: Total Mahasiswa Aktif
      prisma.mahasiswa.count({ where: { status: 'aktif' } }),
      // 1: Total Surat Selesai
      prisma.suratbebasasrama.count({ where: { status_pengajuan: 'SELESAI' } }),
      // 2: Total Laporan Selesai
      prisma.pelaporankerusakan.count({ where: { status: 'selesai' } }),
      // 3: Perubahan Surat Selesai (7 hari)
      prisma.suratbebasasrama.count({
        where: { status_pengajuan: 'SELESAI', tanggal_update: { gte: sevenDaysAgo } }
      }),
      // 4: Perubahan Laporan Selesai (7 hari)
      prisma.pelaporankerusakan.count({
        where: { status: "selesai", updatedAt: { gte: sevenDaysAgo } }
      }),
      // 5: Mahasiswa Baru (7 hari)
      prisma.mahasiswa.count({
        where: { createdAt: { gte: sevenDaysAgo } }
      }),
      // 6: Mahasiswa Non-aktif (7 hari)
      prisma.mahasiswa.count({
        where: { status: 'tidak aktif', updatedAt: { gte: sevenDaysAgo } }
      }),
      // 7: Data Group By Jurusan
      prisma.mahasiswa.groupBy({
        by: ['jurusan'],
        _count: { jurusan: true },
        where: { status: 'aktif', NOT: { jurusan: null } },
        orderBy: { _count: { jurusan: 'desc' } }
      })
    ]);
    // --- AKHIR PERBAIKAN ---

    // Ekstrak hasil dari array (urutan berubah)
    const totalMahasiswaAktif = results[0];
    const totalSelesai = results[1];
    const totalPelaporan = results[2];
    const perubahanSelesai = results[3];
    const perubahanPelaporan = results[4];
    const penambahan = results[5];
    const pengurangan = results[6];
    const dataJurusan = results[7];
    
    const perubahan = penambahan - pengurangan;
    const labelsJurusan = dataJurusan.map(item => item.jurusan);
    const countsJurusan = dataJurusan.map(item => item._count.jurusan);

    // Render isi dashboard.ejs sebagai body
    const body = await ejs.renderFile(
      path.join(__dirname, '../views/pengelola/dashboard.ejs'),
      { 
        user, 
        totalMahasiswaAktif,
        perubahanPenghuni: perubahan,
        totalSelesai,
        perubahanSelesai,
        perubahanPelaporan,
        totalPelaporan,
        labelsJurusan,
        countsJurusan
       }
    );

    res.render("layouts/main", { 
      title: 'Dashboard Pengelola - MYASRAMA',
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

module.exports = {
    showDashboard
};