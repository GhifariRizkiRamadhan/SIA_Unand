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
    const totalMahasiswaAktif = await prisma.mahasiswa.count({
      where: {
        status: 'aktif'
      }
    });

    const totalSelesai = await prisma.suratbebasasrama.count({
      where: {
        status_pengajuan: 'SELESAI'
      }
    });

    const totalPelaporan = await prisma.pelaporankerusakan.count({
      where: {
        status: 'selesai'
      }
    });

    const sevenDaysAgo = new Date(new Date().setDate(new Date().getDate() - 7));

    const perubahanSelesai = await prisma.suratbebasasrama.count({
      where: {
        status_pengajuan: 'SELESAI',
        tanggal_update: { // Gunakan 'tanggal_update'
          gte: sevenDaysAgo
        }
      }
    });

    const perubahanPelaporan = await prisma.pelaporankerusakan.count({
      where: {
        status: "selesai",
        updatedAt: { // Gunakan 'tanggal_update'
          gte: sevenDaysAgo
        }
      }
    });

    // Hitung mahasiswa baru dalam 7 hari terakhir
    const penambahan = await prisma.mahasiswa.count({
      where: {
        createdAt: {
          gte: sevenDaysAgo // gte = greater than or equal
        }
      }
    });

    // Hitung mahasiswa yang dinonaktifkan dalam 7 hari terakhir
    const pengurangan = await prisma.mahasiswa.count({
      where: {
        status: 'tidak aktif',
        updatedAt: {
          gte: sevenDaysAgo
        }
      }
    });

    const perubahan = penambahan - pengurangan;

    const dataJurusan = await prisma.mahasiswa.groupBy({
      by: ['jurusan'], // Kelompokkan berdasarkan kolom jurusan
      _count: {
        jurusan: true, // Hitung jumlah mahasiswa di setiap grup
      },
      where: {
        status: 'aktif', // Hanya hitung mahasiswa aktif
        NOT: {
          jurusan: null // Abaikan mahasiswa yang jurusannya kosong
        }
      },
      orderBy: {
        _count: {
          jurusan: 'desc' // Urutkan dari jurusan terbanyak
        }
      }
    });

    // Proses data agar mudah digunakan oleh Chart.js
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
    res.status(500).json({ message: error });
  }
};



module.exports = {

  showDashboard

};

