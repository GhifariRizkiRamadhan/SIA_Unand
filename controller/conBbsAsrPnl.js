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
      title: 'Surat Bebas Asrama Pengelola - MYASRAMA',
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

    // 1. Validasi input
    if (!fasilitas_status || !['LENGKAP', 'TIDAK_LENGKAP'].includes(fasilitas_status)) {
      return res.status(400).json({ 
        success: false, 
        message: "Input 'fasilitas_status' wajib diisi dengan 'LENGKAP' atau 'TIDAK_LENGKAP'." 
      });
    }

    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
        return res.status(400).json({ success: false, message: "ID pengajuan tidak valid." });
    }

    // 2. Ambil data pengajuan dan mahasiswa (untuk cek KIPK)
    const pengajuan = await prisma.suratbebasasrama.findUnique({
      where: { Surat_id: numericId },
      include: { mahasiswa: true } 
    });

    if (!pengajuan) {
      return res.status(404).json({ success: false, message: "Pengajuan tidak ditemukan." });
    }

    // Pastikan data mahasiswa ada untuk cek KIPK
    if (!pengajuan.mahasiswa) {
        return res.status(404).json({ success: false, message: "Data mahasiswa terkait pengajuan ini tidak ditemukan." });
    }

    // 3. Logika perhitungan biaya dan status
    const isKipk = String(pengajuan.mahasiswa.kipk).toLowerCase().trim() === 'ya';
    const biayaPokok = isKipk ? 0 : 2000000;
    
    let totalBiayaTambahan = 0;
    if (fasilitas_status === 'TIDAK_LENGKAP' && Array.isArray(kerusakan)) {
      totalBiayaTambahan = kerusakan.reduce((sum, item) => sum + (Number(item.biaya_kerusakan) || 0), 0);
    }
    
    const totalBiayaAkhir = biayaPokok + totalBiayaTambahan;
    
    // Tentukan status akhir dan pesan notifikasi
    let statusAkhir;
    let notifMessage;

    // --- PERBAIKAN BUG #2 & #3 START ---
    if (totalBiayaAkhir === 0) {
      // Jika total biaya adalah 0 (misal: KIPK & Fasilitas Lengkap)
      statusAkhir = "SELESAI";
      notifMessage = `Status surat Anda telah diperbarui menjadi "SELESAI". Anda tidak memiliki tagihan.`;
    } else {
      // Jika ada biaya (Non-KIPK atau KIPK+Kerusakan)
      statusAkhir = "MENUNGGU_PEMBAYARAN";
      notifMessage = `Status surat Anda telah diperbarui menjadi "Menunggu Pembayaran". Total tagihan: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(totalBiayaAkhir)}`;
    }
    // --- PERBAIKAN BUG #2 & #3 END ---


    // 4. Jalankan Transaksi Database
    const result = await prisma.$transaction(async (tx) => {
      console.log('--- [TRANSAKSI DIMULAI] ---');

      // Hapus data kerusakan lama (jika ada)
      await tx.kerusakanFasilitas.deleteMany({
        where: { surat_id: numericId }
      });
      console.log('1. Data kerusakan lama berhasil dihapus.');

      // Update surat utama dengan status dan biaya baru
      const updatedSurat = await tx.suratbebasasrama.update({
        where: { Surat_id: numericId },
        data: {
          fasilitas_status: fasilitas_status,
          biaya_tambahan: totalBiayaTambahan,
          total_biaya: totalBiayaAkhir,
          status_pengajuan: statusAkhir, // Gunakan status dinamis
          tanggal_update: new Date()
        }
      });
      console.log('2. Data surat utama berhasil diupdate.');

      // --- PERBAIKAN BUG #2 START ---
      // HANYA buat record pembayaran jika statusnya MENUNGGU_PEMBAYARAN
      if (statusAkhir === "MENUNGGU_PEMBAYARAN") {
        await tx.pembayaran.create({
          data: {
            amount: updatedSurat.total_biaya,
            mahasiswa_id: updatedSurat.mahasiswa_id,
            surat_id: updatedSurat.Surat_id,
            status_bukti: 'BELUM_DIVERIFIKASI'
          }
        });
        console.log('3. Record pembayaran BERHASIL DIBUAT di dalam transaksi.');
      } else {
        console.log('3. Record pembayaran DILEWATI (status SELESAI).');
      }
      // --- PERBAIKAN BUG #2 END ---

      // Jika ada kerusakan, buat record baru
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
            // --- PERBAIKAN BUG #3 ---
            notifMessage, // Gunakan pesan notifikasi dinamis
            'status_update',
            updatedSurat.Surat_id.toString()
        );
      }

      return updatedSurat;
    });

    // 5. Kirim respon sukses
    res.json({ success: true, message: "Verifikasi fasilitas berhasil diperbarui", data: result });

  } catch (err) {
    // Tangkap error jika transaksi gagal
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
