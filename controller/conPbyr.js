require('dotenv').config();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const ejs = require('ejs');
const path = require('path');
const User = require('../models/userModels');
const Pembayaran = require('../models/pembayaranModel');
const BebasAsrama = require('../models/bebasAsramaModel');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const showPembayaran = async (req, res) => {
  try {
    // 1. Ambil ID pengajuan dari parameter URL
    const pengajuanId = req.params.id;
    if (!pengajuanId) return res.redirect('/mahasiswa/bebas-asrama');

    // 2. Ambil data pengajuan spesifik dari database
    const pengajuan = await BebasAsrama.findById(pengajuanId);

    // TAMBAHKAN BLOK LOG INI DAN KIRIMKAN HASILNYA
    // ===============================================
    // console.log('===== DATA YANG AKAN DIKIRIM KE VIEW =====');
    // console.log(JSON.stringify(pengajuan, null, 2));
    // console.log('========================================');
    // ===============================================

    // VALIDASI: Pastikan ada record pembayaran
    if (!pengajuan.pembayaran || pengajuan.pembayaran.length === 0) {
      return res.status(500).render('error', { 
        message: "Data pembayaran tidak ditemukan. Hubungi administrator." 
      });
    }

    // 3. Handle jika pengajuan dengan ID tersebut tidak ditemukan
    if (!pengajuan) {
      return res.status(404).render('error', { message: "Data pengajuan tidak ditemukan." });
    }

    // Ambil data user yang sedang login (kode Anda sebelumnya)
    const user = await User.findById(req.user.user_id);

    // 4. Kirim data 'pengajuan' ke view saat me-render body
    const body = await ejs.renderFile(
      path.join(__dirname, '../views/mahasiswa/pembayaran.ejs'),
      { 
        user: user,
        pengajuan: pengajuan // <-- Data pengajuan dikirim ke view
      }
    );

    res.render('layouts/main', {
      title: 'Pembayaran',
      pageTitle: `Pembayaran `,
      activeMenu: 'bebas-asrama', // Tetap aktifkan menu bebas asrama
      body,
      user: {
        name: user.name,
        role: user.role,
        avatar: user.avatar || user.name.charAt(0)
      }
    });
  } catch (error) {
    console.error("Gagal menampilkan halaman pembayaran:", error);
    res.status(500).render('error', { message: error.message });
  }
};

const uploadBuktiPembayaran = async (req, res) => {
  try {
    const { id } = req.body; // id pembayaran
    const buktiPath = req.file?.path || null;

    if (!buktiPath) {
      return res.status(400).json({ 
        success: false, 
        message: "File bukti tidak ditemukan" 
      });
    }

    // Cek apakah pembayaran dengan ID ini sudah ada
    const existingPembayaran = await Pembayaran.findById(id);

    let updated;
    if (existingPembayaran) {
      // Jika sudah ada, lakukan UPDATE (re-upload)
      updated = await Pembayaran.findByIdAndUpdate(
        id,
        {
          bukti_pembayaran: buktiPath,
          status_bukti: "BELUM_DIVERIFIKASI"
        },
        { new: true }
      );
    } else {
      // Jika belum ada, buat baru (seharusnya tidak terjadi jika flow benar)
      return res.status(404).json({
        success: false,
        message: "Data pembayaran tidak ditemukan"
      });
    }

    // Update status pengajuan
    if (updated && updated.surat_id) {
      await BebasAsrama.updateStatus(updated.surat_id, "VERIFIKASI_PEMBAYARAN");
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error("Gagal upload bukti:", err);
    res.status(500).json({ 
      success: false, 
      message: "Gagal upload bukti pembayaran" 
    });
  }
};

// Detail status pembayaran (Mahasiswa)
const getDetailPembayaran = async (req, res) => {
  try {
    const pembayaran = await Pembayaran.findById(req.params.id);
    if (!pembayaran) return res.status(404).json({ success: false, message: "Data tidak ditemukan" });
    res.json({ success: true, data: pembayaran });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Gagal ambil detail pembayaran" });
  }
};

// Update pembayaran (re-upload bukti)
const updatePembayaran = async (req, res) => {
  try {
    const buktiPath = req.file?.path || null;
    const updated = await Pembayaran.findByIdAndUpdate(
      req.params.id,
      {
        bukti_pembayaran: buktiPath,
        status_bukti: "BELUM_DIVERIFIKASI"
      },
      { new: true }
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Gagal update pembayaran" });
  }
};

// ====================== Pengelola ======================

const getAllPembayaran = async (req, res) => {
  try {
    const data = await Pembayaran.findAll();
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Gagal ambil semua pembayaran" });
  }
};

const approvePembayaran = async (req, res) => {
    try {
        const suratId = req.params.id; // Ini adalah ID Pengajuan/Surat

        // Panggil fungsi baru untuk update status pembayaran
        await Pembayaran.updateStatusBySuratId(suratId, "VALID");

        // Lanjutkan status pengajuan menjadi SELESAI
        await BebasAsrama.updateStatus(suratId, "SELESAI");

        res.json({ success: true, message: "Pembayaran disetujui." });
    } catch (err) {
      console.error("Gagal approve pembayaran:", err);
      res.status(500).json({ success: false, message: "Terjadi kesalahan pada server." });
    }
};

const rejectPembayaran = async (req, res) => {
  try {
    const suratId = req.params.id;

    // Panggil fungsi baru untuk mereset pembayaran
    await Pembayaran.resetPaymentStatusBySuratId(suratId);

    // Kembalikan status pengajuan ke MENUNGGU_PEMBAYARAN
    await BebasAsrama.updateStatus(suratId, "MENUNGGU_PEMBAYARAN");

    res.json({ success: true, message: "Pembayaran telah ditolak dan mahasiswa diminta untuk mengunggah ulang." });
  } catch (err) {
    console.error("Gagal reject pembayaran:", err);
    res.status(500).json({ success: false, message: "Gagal reject pembayaran" });
  }
};

const reuploadBuktiPembayaran = async (req, res) => {
  try {
    const { id } = req.params;
    const buktiPath = req.file?.path || null;

    if (!buktiPath) {
      return res.status(400).json({ success: false, message: "File tidak ditemukan" });
    }

    const updated = await Pembayaran.findByIdAndUpdate(id, {
      bukti_pembayaran: buktiPath,
      status_bukti: "BELUM_DIVERIFIKASI"
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: "Pembayaran tidak ditemukan" });
    }

    if (updated.surat_id) {
      await BebasAsrama.updateStatus(updated.surat_id, "VERIFIKASI_PEMBAYARAN");
    }

    res.json({ success: true, message: "Bukti berhasil diunggah ulang", data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Gagal re-upload" });
  }
};


module.exports = {
  showPembayaran,
  uploadBuktiPembayaran,
  getDetailPembayaran,
  updatePembayaran,
  getAllPembayaran,
  approvePembayaran,
  rejectPembayaran,
  reuploadBuktiPembayaran
};
