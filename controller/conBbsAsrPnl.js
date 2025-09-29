require('dotenv').config();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const ejs = require('ejs');
const User = require('../models/userModels');
const path = require('path');
const BebasAsrama = require('../models/bebasAsramaModel');
const Pembayaran = require('../models/pembayaranModel');
const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient();    

const showBebasAsramaPengelola = async (req, res) => {
  try {
    const userId = req.session?.user_id || req.user?.user_id;
    if (!userId) return res.redirect('/login');

    const user = await User.findById(userId);

    const body = await ejs.renderFile(
      path.join(__dirname, '../views/pengelola/bebasAsrama.ejs'),
      { user }
    );

    res.render('layouts/main', {
      title: 'Surat Bebas Asrama',
      pageTitle: 'Surat Bebas Asrama',
      activeMenu: 'pengelola-bebas-asrama',
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

// Pengelola lihat semua pengajuan
const getAllBebasAsrama = async (req, res) => {
  try {
    const data = await BebasAsrama.findAll();
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Gagal ambil semua pengajuan" });
  }
};

// Detail pengajuan (modal detail)
const getDetailBebasAsrama = async (req, res) => {
  try {
    const pengajuan = await BebasAsrama.findById(req.params.id);
    if (!pengajuan) return res.status(404).json({ success: false, message: "Tidak ditemukan" });
    res.json({ success: true, data: pengajuan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Gagal ambil detail pengajuan" });
  }
};

const verifikasiFasilitas = async (req, res) => {
  try {
    const { id } = req.params;
    // Mengharapkan 'fasilitas_status' dan 'kerusakan' (array) dari body
    const { fasilitas_status, kerusakan } = req.body; 

    // Validasi input
    if (!fasilitas_status || !['LENGKAP', 'TIDAK_LENGKAP'].includes(fasilitas_status)) {
      return res.status(400).json({ 
        success: false, 
        message: "Input 'fasilitas_status' wajib diisi dengan 'LENGKAP' atau 'TIDAK_LENGKAP'." 
      });
    }

    // Hitung total biaya tambahan dari array kerusakan
    let totalBiayaTambahan = 0;
    if (fasilitas_status === 'TIDAK_LENGKAP' && Array.isArray(kerusakan)) {
      totalBiayaTambahan = kerusakan.reduce((sum, item) => sum + (Number(item.biaya_kerusakan) || 0), 0);
    }
    
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
        return res.status(400).json({ success: false, message: "ID pengajuan tidak valid." });
    }

    // Gunakan Transaksi Prisma untuk memastikan semua operasi database berhasil atau gagal bersamaan
    const result = await prisma.$transaction(async (tx) => {
      // 1. Hapus data kerusakan lama untuk menghindari duplikasi jika ada edit ulang
      await tx.kerusakanFasilitas.deleteMany({
        where: { surat_id: numericId }
      });
      
      // 2. Update surat bebas asrama dengan status dan total biaya baru
      const updatedSurat = await tx.suratbebasasrama.update({
        where: { Surat_id: numericId },
        data: {
          fasilitas_status: fasilitas_status,
          biaya_tambahan: totalBiayaTambahan,
          total_biaya: 2000000 + totalBiayaTambahan, // Asumsi biaya dasar 2 juta
          status_pengajuan: "MENUNGGU_PEMBAYARAN",
          tanggal_update: new Date()
        }
      });
      
      // 3. Jika ada kerusakan, buat entri baru untuk setiap item di tabel KerusakanFasilitas
      if (fasilitas_status === 'TIDAK_LENGKAP' && Array.isArray(kerusakan) && kerusakan.length > 0) {
        await tx.kerusakanFasilitas.createMany({
          data: kerusakan.map(item => ({
            nama_fasilitas: item.nama_fasilitas,
            biaya_kerusakan: item.biaya_kerusakan,
            surat_id: numericId // Hubungkan ke surat pengajuan yang sedang diupdate
          }))
        });
      }
      
      return updatedSurat;
    });

    res.json({ success: true, message: "Verifikasi fasilitas berhasil diperbarui", data: result });
  } catch (err) {
    console.error("Gagal verifikasi fasilitas:", err);
    res.status(500).json({ success: false, message: "Gagal verifikasi fasilitas" });
  }
};

module.exports = {
  showBebasAsramaPengelola,
  getAllBebasAsrama,
  getDetailBebasAsrama,
  verifikasiFasilitas
};
