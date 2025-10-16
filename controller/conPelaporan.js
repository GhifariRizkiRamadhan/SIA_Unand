require('dotenv').config();
const ejs = require('ejs');
const path = require('path');
const { prisma } = require('../config/database');
const { createKerusakanNotification } = require('./notification');

const showFormPelaporan = async (req, res) => {
  try {
    const user = { name: req.user.name, role: req.user.role, avatar: req.user.avatar || req.user.name?.charAt(0) };
    const body = await ejs.renderFile(path.join(__dirname, '../views/mahasiswa/pelaporanForm.ejs'), { user });
    res.render('layouts/main', { 
      title: 'Pelaporan Kerusakan - MYASRAMA', 
      pageTitle: 'Pelaporan Kerusakan', 
      activeMenu: 'pelaporan', 
      user, body });
  } catch (error) {
    console.error('showFormPelaporan error:', error);
    res.status(500).render('error', { message: error.message });
  }
};

const submitPelaporan = async (req, res) => {
  try {
    const mahasiswaId = req.user.mahasiswa_id;
    const { jenis, description, location } = req.body;
    const photoPath = req.file ? req.file.path.replace('public', '') : null;

    // Validasi server-side
    if (!jenis || typeof jenis !== 'string' || jenis.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Jenis kerusakan wajib diisi dan minimal 3 karakter' });
    }
    if (!description || description.trim().length < 10) {
      return res.status(400).json({ success: false, message: 'Deskripsi minimal 10 karakter' });
    }
    if (!location || location.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Lokasi minimal 2 karakter' });
    }

    const laporan = await prisma.pelaporankerusakan.create({
      data: {
        description: description.trim(),
        location: location.trim(),
        jenis: jenis.trim(),
        photo: photoPath,
        mahasiswa_id: mahasiswaId
        // date_submitted akan otomatis diisi oleh Prisma dengan waktu sekarang
      }
    });

    // Create notification for pengelola
    await createKerusakanNotification(mahasiswaId, laporan.laporan_id);
    
    res.status(201).json({ success: true, data: laporan });
  } catch (error) {
    console.error('submitPelaporan error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const listPelaporanMahasiswa = async (req, res) => {
  try {
    const mahasiswaId = req.user.mahasiswa_id;
    const list = await prisma.pelaporankerusakan.findMany({ where: { mahasiswa_id: mahasiswaId }, orderBy: { date_submitted: 'desc' } });
    res.json({ success: true, data: list });
  } catch (error) {
    console.error('listPelaporanMahasiswa error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const showPelaporanPengelola = async (req, res) => {
  try {
    const user = { name: req.user.name, role: req.user.role, avatar: req.user.avatar || req.user.name?.charAt(0) };
    const body = await ejs.renderFile(path.join(__dirname, '../views/pengelola/pelaporanAdmin.ejs'), { user });
    res.render('layouts/main', { title: 'Pelaporan Kerusakan - MYASRAMA', pageTitle: 'Pelaporan Kerusakan', activeMenu: 'pelaporan-admin', user, body });
  } catch (error) {
    console.error('showPelaporanPengelola error:', error);
    res.status(500).render('error', { message: error.message });
  }
};

const listPelaporanPengelola = async (req, res) => {
  try {
    const list = await prisma.pelaporankerusakan.findMany({ orderBy: { date_submitted: 'desc' }, include: { mahasiswa: { select: { nama: true, nim: true } } } });
    res.json({ success: true, data: list });
  } catch (error) {
    console.error('listPelaporanPengelola error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateStatusPelaporan = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowed = ['ditinjau','ditangani','selesai'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Status tidak valid' });
    }
    
    // Retrieve the laporan with mahasiswa information
    const currentLaporan = await prisma.pelaporankerusakan.findUnique({
      where: { laporan_id: Number(id) },
      include: { mahasiswa: true }
    });

    if (!currentLaporan) {
      return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan' });
    }

    // Update status
    const laporan = await prisma.pelaporankerusakan.update({ 
      where: { laporan_id: Number(id) }, 
      data: { status } 
    });

    // Create notification for mahasiswa about status update
    await createKerusakanNotification(currentLaporan.mahasiswa_id, laporan.laporan_id, status);
    
    res.json({ success: true, data: laporan });
  } catch (error) {
    console.error('updateStatusPelaporan error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { showFormPelaporan, submitPelaporan, listPelaporanMahasiswa, showPelaporanPengelola, listPelaporanPengelola, updateStatusPelaporan };