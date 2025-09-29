require('dotenv').config();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const ejs = require('ejs');
const User = require('../models/userModels');
const path = require('path');
const BebasAsrama = require('../models/bebasAsramaModel');
const Pembayaran = require('../models/pembayaranModel');
const PDFDocument = require('pdfkit');

const showBebasAsrama = async (req, res) => {
  try {
    const userId = req.session?.user_id || req.user?.user_id;
    if (!userId) return res.redirect('/login');

    const user = await User.findById(userId);

    const body = await ejs.renderFile(
      path.join(__dirname, '../views/mahasiswa/bebasAsrama.ejs'),
      { user }
    );

    res.render('layouts/main', {
      title: 'Surat Bebas Asrama',
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

    const pengajuan = await BebasAsrama.create({
      mahasiswa_id: mahasiswaId,
      nomor_pengajuan: `SB-${Date.now()}`,
      total_biaya: req.body.total_biaya || 2000000,
      status_pengajuan: "VERIFIKASI_FASILITAS"
    });

    res.json({ success: true, data: pengajuan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Gagal ajukan bebas asrama" });
  }
};

// Mahasiswa cek status pengajuan
const getStatusBebasAsrama = async (req, res) => {
  try {
    const pengajuan = await BebasAsrama.findById(req.params.id);
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
    await BebasAsrama.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Pengajuan dihapus" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Gagal hapus pengajuan" });
  }
};

// Unduh surat bebas asrama (sementara dummy file)
const downloadSurat = async (req, res) => {
  try {
    const { id } = req.params; // Ambil ID surat dari URL

    // 1. Ambil data pengajuan dari database, termasuk data mahasiswa terkait
    const pengajuan = await BebasAsrama.findByIdWithMahasiswa(id); // Anda perlu buat fungsi ini

    if (!pengajuan) {
      return res.status(404).json({ success: false, message: "Data pengajuan tidak ditemukan." });
    }

    // 2. Buat dokumen PDF baru
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    // 3. Atur header respons agar browser mengunduh file
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="surat_bebas_asrama_${pengajuan.mahasiswa.nim}.pdf"`);

    // 4. "Salurkan" output PDF langsung ke respons
    doc.pipe(res);

    // 5. Mulai tulis konten PDF
    // Header
    doc.fontSize(16).text('ASRAMA MAHASISWA UNIVERSITAS ABC', { align: 'center', underline: true });
    doc.moveDown();

    // Judul Surat
    doc.fontSize(14).text('SURAT KETERANGAN BEBAS ASRAMA', { align: 'center' });
    doc.fontSize(11).text(`Nomor: ${pengajuan.nomor_pengajuan}`, { align: 'center' });
    doc.moveDown(2);

    // Isi
    doc.text('Yang bertanda tangan di bawah ini, Kepala Asrama Mahasiswa, menerangkan bahwa:');
    doc.moveDown();

    // Data Mahasiswa (diambil dari database)
    doc.text(`    Nama Lengkap       : ${pengajuan.mahasiswa.nama}`);
    doc.text(`    NIM                : ${pengajuan.mahasiswa.nim}`);
    doc.text(`    Fakultas / Jurusan : -`); // Tambahkan ini jika ada datanya
    doc.moveDown();

    doc.text('Telah menyelesaikan seluruh kewajiban dan administrasi terkait hunian di Asrama Mahasiswa dan dinyatakan telah BEBAS ASRAMA.');
    doc.moveDown();
    
    doc.text('Demikian surat keterangan ini dibuat untuk dapat dipergunakan sebagaimana mestinya.');
    doc.moveDown(4);

    // Tanda Tangan
    doc.text(`Kota Cerdas, ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`);
    doc.text('Kepala Asrama Mahasiswa,');
    doc.moveDown(5);
    doc.text('(Nama Lengkap Anda)');
    doc.text('NIP. 19801234 200501 1 001');

    // 6. Finalisasi PDF
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

    // 2. Panggil fungsi model yang mencari berdasarkan ID
    //    Kita akan membuat fungsi findByMahasiswaId di langkah berikutnya
    const data = await Pembayaran.findByMahasiswaId(mahasiswaId);

    // 3. (Opsional tapi disarankan) Cek jika data tidak ditemukan
    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: "Tagihan untuk mahasiswa ini tidak ditemukan." });
    }

    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Gagal mengambil data tagihan." });
  }
};

module.exports = {
  showBebasAsrama,
  ajukanBebasAsrama,
  getStatusBebasAsrama,
  deleteBebasAsrama,
  downloadSurat,
  getTagihanMahasiswa
};
