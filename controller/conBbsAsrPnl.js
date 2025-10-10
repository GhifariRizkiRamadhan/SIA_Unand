require('dotenv').config();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const ejs = require('ejs');
const User = require('../models/userModels');
const path = require('path');
const BebasAsrama = require('../models/bebasAsramaModel');
const Pembayaran = require('../models/pembayaranModel');
const { createNotification } = require('./notification');
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

    const result = await prisma.$transaction(async (tx) => {
      console.log('--- [TRANSAKSI DIMULAI] ---');

      await tx.kerusakanFasilitas.deleteMany({
        where: { surat_id: numericId }
      });
      console.log('1. Data kerusakan lama berhasil dihapus.');

      const updatedSurat = await tx.suratbebasasrama.update({
        where: { Surat_id: numericId },
        data: {
          fasilitas_status: fasilitas_status,
          biaya_tambahan: totalBiayaTambahan,
          total_biaya: 2000000 + totalBiayaTambahan,
          status_pengajuan: "MENUNGGU_PEMBAYARAN",
          tanggal_update: new Date()
        }
      });
      console.log('2. Data surat utama berhasil diupdate.');

      await tx.pembayaran.create({
        data: {
          amount: updatedSurat.total_biaya,
          mahasiswa_id: updatedSurat.mahasiswa_id,
          surat_id: updatedSurat.Surat_id,
          status_bukti: 'BELUM_DIVERIFIKASI'
        }
      });
      console.log('3. Record pembayaran BERHASIL DIBUAT di dalam transaksi.');

      if (fasilitas_status === 'TIDAK_LENGKAP' && Array.isArray(kerusakan) && kerusakan.length > 0) {
        await tx.kerusakanFasilitas.createMany({
          data: kerusakan.map(item => ({
            nama_fasilitas: item.nama_fasilitas,
            biaya_kerusakan: item.biaya_kerusakan,
            surat_id: numericId
          }))
        });
        console.log('4. Data kerusakan baru berhasil dibuat.');
      }
      
      console.log('--- [TRANSAKSI SELESAI SUKSES] ---');
      // Ambil data mahasiswa untuk notifikasi
      const mahasiswa = await tx.mahasiswa.findUnique({
        where: { mahasiswa_id: updatedSurat.mahasiswa_id },
        include: { user: true }
      });

      // Kirim notifikasi ke mahasiswa
      if (mahasiswa && mahasiswa.user) {
        await createNotification(
            mahasiswa.user.user_id,
            'Status Surat Bebas Asrama Diperbarui',
            // PERBAIKAN: Gunakan 'updatedSurat' yang sudah ada
            `Status surat Anda telah diperbarui menjadi "Menunggu Pembayaran". Total tagihan: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(updatedSurat.total_biaya)}`,
            'status_update',
            updatedSurat.Surat_id.toString()
        );
    }

      return updatedSurat;
    });

    res.json({ success: true, message: "Verifikasi fasilitas berhasil diperbarui", data: result });
  } catch (err) {
    // LOG PALING PENTING ADA DI SINI
    console.error("!!! TRANSAKSI GAGAL, SEMUA DIBATALKAN (ROLLBACK) !!!");
    console.error("Penyebab Error:", err);
    
    res.status(500).json({ success: false, message: "Gagal verifikasi fasilitas" });
  }
};


const getBuktiPembayaran = async (req, res) => {
  try {
    const { id } = req.params;

    // Panggil fungsi dari model, bukan 'prisma' langsung
    const pengajuan = await BebasAsrama.findByIdWithPembayaran(id);

    if (!pengajuan) {
      return res.status(404).json({ success: false, message: "Pengajuan tidak ditemukan." });
    }

    const pembayaran = pengajuan.pembayaran[0];
    if (!pembayaran || !pembayaran.bukti_pembayaran) {
      return res.status(404).json({ success: false, message: "Bukti pembayaran untuk pengajuan ini tidak ditemukan." });
    }

    const filePath = pembayaran.bukti_pembayaran;
    const absolutePath = path.join(process.cwd(), filePath);
    
    res.sendFile(absolutePath, (err) => {
      if (err) {
        console.error("File tidak ditemukan di server:", err);
        res.status(404).json({ success: false, message: "File fisik tidak ditemukan di server." });
      }
    });

  } catch (err) {
    console.error("Gagal mengambil bukti pembayaran:", err);
    res.status(500).json({ success: false, message: "Gagal mengambil bukti pembayaran." });
  }
};

module.exports = {
  showBebasAsramaPengelola,
  getAllBebasAsrama,
  getDetailBebasAsrama,
  verifikasiFasilitas,
  getBuktiPembayaran
};
