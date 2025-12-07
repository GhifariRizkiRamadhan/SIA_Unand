require('dotenv').config();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const ejs = require('ejs');
const User = require('../models/userModels');
const path = require('path');
const notificationController = require('./notification');
const PDFDocument = require('pdfkit');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();


const showBebasAsrama = async (req, res) => {
  try {
    const userId = req.session?.user_id || req.user?.user_id;
    if (!userId) return res.redirect('/login');

    const user = await User.findById(userId);

    const body = await ejs.renderFile(
      path.join(__dirname, '../views/mahasiswa/bebasAsrama.ejs'),
      {
        user: user,
        mahasiswaId: req.user.mahasiswa_id
      }
    );

    res.render('layouts/main', {
      title: 'Surat Bebas Asrama - MYASRAMA',
      pageTitle: 'Surat Bebas Asrama',
      activeMenu: 'bebas-asrama',
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

// Mahasiswa ajukan bebas asrama
const ajukanBebasAsrama = async (req, res) => {
  try {
    const mahasiswaId = req.user?.mahasiswa_id;

    if (!mahasiswaId) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Akun Anda tidak terhubung dengan data mahasiswa."
      });
    }

    const mahasiswa = await prisma.mahasiswa.findUnique({
      where: {
        // Change 'id' to 'mahasiswa_id' (or whatever your @id field is named)
        mahasiswa_id: mahasiswaId
      },
      include: {
        user: true // Include the related user to get the name
      }
    });

    // Handle case where mahasiswa is not found
    if (!mahasiswa) {
      return res.status(404).json({
        success: false,
        message: "Data mahasiswa tidak ditemukan."
      });
    }

    // REPLACED: const activeSubmission = await BebasAsrama.findActiveByMahasiswaId(mahasiswaId);
    const activeSubmission = await prisma.suratbebasasrama.findFirst({
      where: {
        mahasiswa_id: mahasiswaId,
        NOT: {
          status_pengajuan: 'SELESAI'
        }
      }
    });

    if (activeSubmission) {
      // Kirim status 409 Conflict jika sudah ada pengajuan aktif
      return res.status(409).json({
        success: false,
        message: "Anda sudah memiliki pengajuan yang sedang diproses. Silakan batalkan pengajuan sebelumnya untuk membuat yang baru."
      });
    }

    const BIAYA_DEFAULT = 2000000;
    const isKipk = String(mahasiswa.kipk).toLowerCase().trim() === 'ya';
    const totalBiaya = isKipk ? 0 : BIAYA_DEFAULT;

    // REPLACED: const pengajuan = await BebasAsrama.create({ ... });
    const pengajuan = await prisma.suratbebasasrama.create({
      data: {
        mahasiswa_id: mahasiswaId,
        nomor_pengajuan: `SB-${Date.now()}`,
        total_biaya: totalBiaya,
        status_pengajuan: "VERIFIKASI_FASILITAS"
      }
    });

    // Kirim notifikasi ke semua pengelola
    const allPengelola = await prisma.pengelolaasrama.findMany({
      include: { user: true }
    });

    // Kirim notifikasi ke setiap pengelola
    for (const pengelola of allPengelola) {
      await notificationController.createNotification(
        pengelola.user_id,
        'Pengajuan Surat Bebas Asrama Baru',
        `${mahasiswa.user.name} (${mahasiswa.nim}) mengajukan surat bebas asrama baru.`,
        'surat_bebas_asrama',
        pengajuan.Surat_id.toString()
      );
    }

    res.json({ success: true, data: pengajuan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Gagal ajukan bebas asrama" });
  }
};

// Mahasiswa cek status pengajuan
const getStatusBebasAsrama = async (req, res) => {
  try {
    // REPLACED: const pengajuan = await BebasAsrama.findById(req.params.id);
    const numericId = parseInt(req.params.id, 10);
    if (isNaN(numericId)) {
      return res.status(400).json({ success: false, message: "ID tidak valid" });
    }

    const pengajuan = await prisma.suratbebasasrama.findUnique({
      where: { Surat_id: numericId },
      include: {
        mahasiswa: {
          include: {
            user: true
          }
        },
        pengelolaasrama: true,
        pembayaran: true,
        kerusakanFasilitas: true
      }
    });

    if (!pengajuan) return res.status(404).json({ success: false, message: "Pengajuan tidak ditemukan" });
    res.json({ success: true, data: pengajuan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Gagal ambil status" });
  }
};


// Hapus pengajuan
const deleteBebasAsrama = async (req, res) => {
  try {
    const numericId = parseInt(req.params.id, 10);
    if (isNaN(numericId)) {
      return res.status(400).json({ success: false, message: "ID tidak valid" });
    }

    // 1. Cek dulu apakah pengajuan ada
    // REPLACED: const pengajuan = await BebasAsrama.findById(req.params.id);
    const pengajuan = await prisma.suratbebasasrama.findUnique({
      where: { Surat_id: numericId }
    });

    // 2. Jika tidak ada, kirim 404
    if (!pengajuan) {
      return res.status(404).json({ success: false, message: "Pengajuan tidak ditemukan" });
    }

    // 3. Jika ada, baru hapus
    // REPLACED: await BebasAsrama.findByIdAndDelete(req.params.id);
    await prisma.suratbebasasrama.delete({
      where: {
        Surat_id: numericId
      }
    });

    res.json({ success: true, message: "Pengajuan dihapus" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Gagal hapus pengajuan" });
  }
};

// Unduh surat bebas asrama (sementara dummy file)
const downloadSurat = async (req, res) => {
  try {
    const { id } = req.params;
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      return res.status(400).json({ success: false, message: "ID tidak valid" });
    }

    // REPLACED: const pengajuan = await BebasAsrama.findByIdWithMahasiswa(id); 
    const pengajuan = await prisma.suratbebasasrama.findUnique({
      where: {
        Surat_id: numericId
      },
      include: {
        mahasiswa: true
      }
    });

    if (!pengajuan) {
      return res.status(404).json({ success: false, message: "Data pengajuan tidak ditemukan." });
    }

    const doc = new PDFDocument({ size: 'A4', margin: 80 });
    const signaturePath = path.join(__dirname, '../public/image/kepala_asrama/ttdme.png');
    const tahunSekarang = new Date().getFullYear();
    const textOptions = { indent: 30 };


    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="surat_bebas_asrama_${pengajuan.mahasiswa.nim}.pdf"`);

    doc.pipe(res);

    // Judul Surat
    doc.font('Times-Bold').fontSize(14).text(`SURAT KETERANGAN BEBAS ASRAMA UNIVERSITAS ANDALAS ${tahunSekarang}`, { align: 'center' });
    doc.font('Times-Roman').fontSize(11).text(`Nomor: ${pengajuan.nomor_pengajuan}`, { align: 'center' });
    doc.moveDown(2);

    // Isi
    doc.text('Yang bertanda tangan di bawah ini, Kepala Asrama Mahasiswa, menerangkan bahwa:');
    doc.moveDown();

    // Data Mahasiswa (diambil dari database)
    doc.text(`Nama               : ${pengajuan.mahasiswa.nama}`, textOptions);
    doc.text(`NIM                : ${pengajuan.mahasiswa.nim}`, textOptions);
    doc.text(`Jurusan            : ${pengajuan.mahasiswa.jurusan}`, textOptions);
    doc.moveDown();

    doc.text('Telah menyelesaikan seluruh kewajiban dan administrasi di Asrama Universitas Andalas dan dinyatakan telah BEBAS ASRAMA.', { align: 'justify' });
    doc.moveDown();

    doc.text('Demikian surat keterangan ini dibuat untuk dapat dipergunakan sebagaimana mestinya.', { align: 'justify' });
    doc.moveDown(4);

    // Tanda Tangan

    doc.text(`Padang, ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`, { align: 'right' });
    doc.text('Kepala Asrama Mahasiswa,', { align: 'right' });
    doc.moveDown(1);

    const imageWidth = 150;
    const xPosition = doc.page.width - doc.page.margins.right - imageWidth;

    doc.image(signaturePath, xPosition, doc.y, {
      width: imageWidth
    });

    doc.moveDown(6);

    doc.text('Asmiruddin Abdullah S, S.E', { align: 'right' });
    doc.text('NIP. 19801234 200501 1 001', { align: 'right' });

    doc.end();

  } catch (err) {
    console.error("Gagal membuat surat:", err);
    res.status(500).json({ success: false, message: "Gagal mengunduh surat." });
  }
};

const getTagihanMahasiswa = async (req, res) => {
  try {

    console.log("Menerima ID dari URL:", req.params.id);
    console.log("Tipe data ID dari URL:", typeof req.params.id);

    const mahasiswaId = req.params.id;
    const numericId = parseInt(mahasiswaId, 10);
    if (isNaN(numericId)) {
      return res.status(400).json({ success: false, message: "ID Mahasiswa tidak valid." });
    }

    // REPLACED: const data = await Pembayaran.findByMahasiswaId(mahasiswaId);
    const data = await prisma.pembayaran.findMany({
      where: {
        mahasiswa_id: numericId
      },
      include: {
        suratbebasasrama: true
      }
    });

    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: "Tagihan untuk mahasiswa ini tidak ditemukan." });
    }

    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Gagal mengambil data tagihan." });
  }
};

const getRiwayatPengajuan = async (req, res) => {
  try {
    const mahasiswaId = req.params.id;
    const numericId = parseInt(mahasiswaId, 10);
    if (isNaN(numericId)) {
      return res.status(400).json({ success: false, message: "ID Mahasiswa tidak valid." });
    }

    // REPLACED: const riwayat = await BebasAsrama.findByMahasiswaId(mahasiswaId);
    const riwayat = await prisma.suratbebasasrama.findMany({
      where: {
        mahasiswa_id: numericId
      },
      orderBy: {
        tanggal_pengajuan: 'desc'
      }
    });

    res.json({ success: true, data: riwayat || [] });
  } catch (err) {
    console.error("Gagal ambil riwayat pengajuan:", err);
    res.status(500).json({ success: false, message: "Gagal mengambil riwayat pengajuan." });
  }
};

// controller/conBbsAsr.js

const checkActiveSubmission = async (req, res) => {
  try {
    const mahasiswaId = req.params.id;
    const numericId = parseInt(mahasiswaId, 10);
    if (isNaN(numericId)) {
      return res.status(400).json({ success: false, message: "ID Mahasiswa tidak valid." });
    }

    // REPLACED: const activeSubmission = await BebasAsrama.findActiveByMahasiswaId(mahasiswaId);
    const activeSubmission = await prisma.suratbebasasrama.findFirst({
      where: {
        mahasiswa_id: numericId,
        NOT: {
          status_pengajuan: 'SELESAI'
        }
      }
    });

    if (activeSubmission) {
      res.json({
        hasActive: true,
        message: "Anda sudah memiliki pengajuan yang sedang diproses. Batalkan pengajuan sebelumnya untuk membuat yang baru."
      });
    } else {
      res.json({ hasActive: false });
    }
  } catch (err) {
    console.error("Gagal cek pengajuan aktif:", err);
    res.status(500).json({ success: false, message: "Gagal memeriksa status pengajuan." });
  }
};


module.exports = {
  showBebasAsrama,
  ajukanBebasAsrama,
  getStatusBebasAsrama,
  deleteBebasAsrama,
  downloadSurat,
  getTagihanMahasiswa,
  getRiwayatPengajuan,
  checkActiveSubmission
};
