require('dotenv').config();
const ejs = require('ejs');
const path = require('path');
const { prisma } = require('../config/database');
const { createIzinKeluarNotification } = require('./notification');

const showFormMahasiswa = async (req, res) => {
  try {
    const mahasiswa = await prisma.mahasiswa.findUnique({
      where: { mahasiswa_id: req.user.mahasiswa_id },
      select: { nama: true, nim: true }
    });

    const user = {
      name: req.user.name,
      role: req.user.role,
      avatar: req.user.avatar || req.user.name?.charAt(0)
    };

    const body = await ejs.renderFile(
      path.join(__dirname, '../views/mahasiswa/izinKeluarForm.ejs'),
      { user, profil: mahasiswa, error: null, success: null }
    );

    res.render('layouts/main', {
      title: 'Pengajuan Surat Izin',
      pageTitle: 'Pengajuan Surat Izin',
      activeMenu: 'pengajuan-surat-izin',
      user,
      body
    });
  } catch (error) {
    console.error('showFormMahasiswa error:', error);
    res.status(500).render('error', { message: error.message });
  }
};

const submitIzinMahasiswa = async (req, res) => {
  try {
    const mahasiswaId = req.user.mahasiswa_id;
    if (!mahasiswaId) {
      return res.status(400).json({ success: false, message: 'Mahasiswa tidak valid' });
    }

    const { reason, date_out, time_out, date_return, time_return } = req.body;

    if (!reason || !date_out || !time_out || !date_return || !time_return) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Dokumen pendukung wajib diunggah' });
    }

    const outDateTime = new Date(`${date_out}T${time_out}:00`);
    const returnDateTime = new Date(`${date_return}T${time_return}:00`);

    if (isNaN(outDateTime.getTime()) || isNaN(returnDateTime.getTime())) {
      return res.status(400).json({ success: false, message: 'Format tanggal/jam tidak valid' });
    }

    if (returnDateTime <= outDateTime) {
      return res.status(400).json({ success: false, message: 'Tanggal/jam kembali harus setelah tanggal/jam keluar' });
    }

    const documentPath = req.file.path.replace('public', ''); // serve via /public

    const izin = await prisma.izinkeluar.create({
      data: {
        reason,
        date_requested: new Date(),
        submitted_at: new Date(),
        date_out: outDateTime,
        date_return: returnDateTime,
        document: documentPath,
        mahasiswa_id: mahasiswaId,
        status: 'pending'
      }
    });

    // Kirim notifikasi ke pengelola
    await createIzinKeluarNotification(mahasiswaId, izin.izin_id);

    return res.status(201).json({ success: true, data: izin });
  } catch (error) {
    console.error('submitIzinMahasiswa error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const listIzinMahasiswa = async (req, res) => {
  try {
    const mahasiswaId = req.user.mahasiswa_id;
    const daftar = await prisma.izinkeluar.findMany({
      where: { mahasiswa_id: mahasiswaId },
      orderBy: { submitted_at: 'desc' }
    });

    return res.json({ success: true, data: daftar });
  } catch (error) {
    console.error('listIzinMahasiswa error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const showIzinPengelola = async (req, res) => {
  try {
    const user = {
      name: req.user.name,
      role: req.user.role,
      avatar: req.user.avatar || req.user.name?.charAt(0)
    };

    const body = await ejs.renderFile(
      path.join(__dirname, '../views/pengelola/izinKeluarTable.ejs'),
      { user }
    );

    res.render('layouts/main', {
      title: 'Perizinan',
      pageTitle: 'Perizinan',
      activeMenu: 'perizinan',
      user,
      body
    });
  } catch (error) {
    console.error('showIzinPengelola error:', error);
    res.status(500).render('error', { message: error.message });
  }
};

const listIzinPengelola = async (req, res) => {
  try {
    const list = await prisma.izinkeluar.findMany({
      orderBy: { submitted_at: 'desc' },
      include: { mahasiswa: { select: { nama: true, nim: true } } }
    });
    return res.json({ success: true, data: list });
  } catch (error) {
    console.error('listIzinPengelola error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const approveIzin = async (req, res) => {
  try {
    const { id } = req.params;
    const izinId = Number(id);
    if (!izinId || Number.isNaN(izinId)) {
      return res.status(400).json({ success: false, message: 'ID izin tidak valid' });
    }

    const pengelolaId = req.user.pengelola_id || null;
    const current = await prisma.izinkeluar.findUnique({ where: { izin_id: izinId } });
    if (!current) {
      return res.status(404).json({ success: false, message: 'Pengajuan izin tidak ditemukan' });
    }

    if (current.status !== 'pending') {
      return res.status(409).json({ success: false, message: 'Hanya pengajuan berstatus pending yang dapat di-approve' });
    }

    const izin = await prisma.izinkeluar.update({
      where: { izin_id: izinId },
      data: { status: 'approved', date_approved: new Date(), Pengelola_id: pengelolaId }
    });

    // Kirim notifikasi ke mahasiswa
    await createIzinKeluarNotification(current.mahasiswa_id, izinId, 'disetujui');
    
    return res.json({ success: true, data: izin });
  } catch (error) {
    console.error('approveIzin error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const rejectIzin = async (req, res) => {
  try {
    const { id } = req.params;
    const izinId = Number(id);
    if (!izinId || Number.isNaN(izinId)) {
      return res.status(400).json({ success: false, message: 'ID izin tidak valid' });
    }

    const { notes } = req.body;
    if (!notes || !String(notes).trim()) {
      return res.status(400).json({ success: false, message: 'Catatan penolakan wajib diisi' });
    }
    const pengelolaId = req.user.pengelola_id || null;

    const current = await prisma.izinkeluar.findUnique({ where: { izin_id: izinId } });
    if (!current) {
      return res.status(404).json({ success: false, message: 'Pengajuan izin tidak ditemukan' });
    }

    if (current.status !== 'pending') {
      return res.status(409).json({ success: false, message: 'Hanya pengajuan berstatus pending yang dapat di-reject' });
    }

    const izin = await prisma.izinkeluar.update({
      where: { izin_id: izinId },
      data: { status: 'rejected', notes: String(notes).trim(), Pengelola_id: pengelolaId }
    });

    // Kirim notifikasi ke mahasiswa
    await createIzinKeluarNotification(current.mahasiswa_id, izinId, 'ditolak');
    
    return res.json({ success: true, data: izin });
  } catch (error) {
    console.error('rejectIzin error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update catatan izin (untuk edit notes oleh pengelola)
const updateIzinNotes = async (req, res) => {
  try {
    const { id } = req.params;
    const izinId = Number(id);
    if (!izinId || Number.isNaN(izinId)) {
      return res.status(400).json({ success: false, message: 'ID izin tidak valid' });
    }

    const { notes } = req.body;
    if (!notes || !String(notes).trim()) {
      return res.status(400).json({ success: false, message: 'Catatan wajib diisi' });
    }

    const pengelolaId = req.user.pengelola_id || null;

    const current = await prisma.izinkeluar.findUnique({ where: { izin_id: izinId } });
    if (!current) {
      return res.status(404).json({ success: false, message: 'Pengajuan izin tidak ditemukan' });
    }

    const izin = await prisma.izinkeluar.update({
      where: { izin_id: izinId },
      data: { notes: String(notes).trim(), Pengelola_id: pengelolaId }
    });

    return res.json({ success: true, data: izin });
  } catch (error) {
    console.error('updateIzinNotes error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Reset status izin kembali ke pending (membatalkan keputusan)
const resetIzinStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const izinId = Number(id);
    if (!izinId || Number.isNaN(izinId)) {
      return res.status(400).json({ success: false, message: 'ID izin tidak valid' });
    }

    const current = await prisma.izinkeluar.findUnique({ where: { izin_id: izinId } });
    if (!current) {
      return res.status(404).json({ success: false, message: 'Pengajuan izin tidak ditemukan' });
    }

    if (current.status === 'pending') {
      return res.status(409).json({ success: false, message: 'Pengajuan sudah berstatus pending' });
    }

    const izin = await prisma.izinkeluar.update({
      where: { izin_id: izinId },
      data: { 
        status: 'pending', 
        date_approved: null, 
        Pengelola_id: null,
        notes: null // Clear notes when resetting
      }
    });

    return res.json({ success: true, data: izin, message: 'Status berhasil direset ke pending' });
  } catch (error) {
    console.error('resetIzinStatus error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  showFormMahasiswa,
  listIzinMahasiswa,
  submitIzinMahasiswa,
  showIzinPengelola,
  listIzinPengelola,
  approveIzin,
  rejectIzin,
  updateIzinNotes,
  resetIzinStatus
};