require('dotenv').config();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const ejs = require('ejs');
const path = require('path');
const User = require('../models/userModels');
const Pembayaran = require('../models/pembayaranModel');
const BebasAsrama = require('../models/bebasAsramaModel');

// showPembayaran (tetap sama seperti sebelumnya jika ada)
const showPembayaran = async (req, res) => {
  try {
    const userId = req.session?.user_id || req.user?.user_id;
    if (!userId) return res.redirect('/login');

    const user = await User.findById(userId);

    const body = await ejs.renderFile(
      path.join(__dirname, '../views/mahasiswa/pembayaran.ejs'),
      { user }
    );

    res.render('layouts/main', {
      title: 'Pembayaran',
      pageTitle: 'Pembayaran',
      activeMenu: 'pembayaran',
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

// ===================
// API untuk pembayaran
// ===================

// Upload bukti pembayaran (Mahasiswa)
const uploadBuktiPembayaran = async (req, res) => {
  try {
    const { id } = req.body; // id pembayaran
    const buktiPath = req.file?.path || null;

    if (!buktiPath) return res.status(400).json({ success: false, message: "File bukti tidak ditemukan" });

    // update pembayaran: simpan path bukti dan status_bukti sesuai enum
    const updated = await Pembayaran.findByIdAndUpdate(
      id,
      {
        bukti_pembayaran: buktiPath,
        status_bukti: "BELUM_DIVERIFIKASI" // <- disesuaikan dengan enum
      },
      { new: true }
    );

    // update pengajuan terkait menjadi VERIFIKASI_PEMBAYARAN (sesuai fungsional)
    if (updated && updated.surat_id) {
      await BebasAsrama.updateStatus(updated.surat_id, "VERIFIKASI_PEMBAYARAN");
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Gagal upload bukti pembayaran" });
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
        status_bukti: "BELUM_DIVERIFIKASI" // tetap BELUM_DIVERIFIKASI sampai diverifikasi pengelola
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

// Pengelola lihat semua pembayaran
const getAllPembayaran = async (req, res) => {
  try {
    const data = await Pembayaran.findAll();
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Gagal ambil semua pembayaran" });
  }
};

// Pengelola approve pembayaran
const approvePembayaran = async (req, res) => {
  try {
    const pembayaranId = req.params.id;

    const pembayaranValid = await Pembayaran.findByIdAndUpdate(
      pembayaranId,
      { status_bukti: "VALID" },
      { new: true } 
    );

    if (!pembayaranValid) {
      return res.status(404).json({ success: false, message: "Data pembayaran tidak ditemukan." });
    }

    if (pembayaranValid.surat_id) {
      await BebasAsrama.updateStatus(pembayaranValid.surat_id, "SELESAI");
      console.log(`Status untuk surat_id: ${pembayaranValid.surat_id} telah diupdate menjadi SELESAI.`);
    } else {
      console.log(`Pembayaran ID: ${pembayaranValid.pembayaran_id} tidak memiliki surat_id terkait.`);
    }

    res.json({ success: true, data: pembayaranValid, message: "Pembayaran berhasil diapprove dan status pengajuan telah diperbarui." });

  } catch (err) {
    console.error("Gagal approve pembayaran:", err);
    res.status(500).json({ success: false, message: "Terjadi kesalahan pada server." });
  }
};

// Pengelola reject pembayaran
const rejectPembayaran = async (req, res) => {
  try {
    // set status bukti jadi TIDAK_VALID dan kembalikan pengajuan ke MENUNGGU_PEMBAYARAN
    const updated = await Pembayaran.findByIdAndUpdate(
      req.params.id,
      { status_bukti: "TIDAK_VALID" }, // <- enum
      { new: true }
    );

    if (updated && updated.surat_id) {
      await BebasAsrama.updateStatus(updated.surat_id, "MENUNGGU_PEMBAYARAN"); // <- enum
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Gagal reject pembayaran" });
  }
};

module.exports = {
  showPembayaran,
  uploadBuktiPembayaran,
  getDetailPembayaran,
  updatePembayaran,
  getAllPembayaran,
  approvePembayaran,
  rejectPembayaran
};
