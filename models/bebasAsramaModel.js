const { prisma } = require('../config/database');

const BebasAsrama = {
  // Create pengajuan baru
  // Di file models/bebasAsramaModel.js

async create(data) {
  try {
    const pengajuan = await prisma.suratbebasasrama.create({
      data: {
        mahasiswa_id: data.mahasiswa_id,
        Pengelola_id: data.Pengelola_id || null,
        nomor_pengajuan: data.nomor_pengajuan,
        total_biaya: data.total_biaya,
        status_pengajuan: data.status_pengajuan || 'VERIFIKASI_FASILITAS',
        fasilitas_status: data.fasilitas_status || null,
        biaya_tambahan: data.biaya_tambahan || null
      }
    });
    return pengajuan;
  } catch (error) {
    throw error;
  }
},
  // Get pengajuan by id
async findById(id) {
  try {
    console.log("ID diterima di dalam model:", id);
    const numericId = parseInt(id, 10);
    console.log("ID setelah diubah menjadi angka:", numericId);

    if (isNaN(numericId)) {
      throw new Error('ID yang diberikan tidak valid, harus berupa angka.');
    }

    return await prisma.suratbebasasrama.findUnique({
      where: { Surat_id: numericId },
      include: {
        mahasiswa: {
          include: {
            user: true
          }
        },
        pengelolaasrama: true,
        pembayaran: true
      }
    });
  } catch (error) {
    throw error;
  }
},

  // Get all pengajuan
  async findAll() {
    try {
      return await prisma.suratbebasasrama.findMany({
        include: {
          mahasiswa: {
            include: {
              user: true
            }
          },
          pengelolaasrama: true,
          pembayaran: true
        }
      });
    } catch (error) {
      throw error;
    }
  },

  // Update status pengajuan (approve/reject)
  async updateStatus(id, status_pengajuan) {
    try {
      return await prisma.suratbebasasrama.update({
        where: { Surat_id: id },
        data: { status_pengajuan }
      });
    } catch (error) {
      throw error;
    }
  },
  async findByIdAndDelete(id) {
    try {
      // 1. Konversi ID dari string ke integer, karena ID dari URL selalu string
      const numericId = parseInt(id, 10);
      if (isNaN(numericId)) {
        throw new Error("ID pengajuan harus berupa angka yang valid.");
      }

      // 2. Gunakan prisma.delete untuk menghapus data berdasarkan ID unik
      return await prisma.suratbebasasrama.delete({
        where: {
          // Pastikan 'Surat_id' adalah nama primary key di skema Anda
          Surat_id: numericId 
        }
      });
    } catch (error) {
      // Lempar error agar bisa ditangkap oleh controller
      throw error;
    }
  },

  async findByIdAndUpdate(id, dataToUpdate, options = {}) {
    try {
      const numericId = parseInt(id, 10);
      if (isNaN(numericId)) {
        throw new Error("ID pengajuan harus berupa angka yang valid.");
      }

      const updatedData = await prisma.suratbebasasrama.update({
        where: {
          Surat_id: numericId 
        },
        data: dataToUpdate // dataToUpdate adalah objek berisi semua field baru
      });


      return updatedData;

    } catch (error) {
      throw error;
    }
  },
  // Di dalam objek model BebasAsrama

async findByIdWithMahasiswa(id) {
  try {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      throw new Error("ID harus berupa angka yang valid.");
    }

    // Gunakan findUnique dengan 'include' untuk mengambil relasi
    return await prisma.suratbebasasrama.findUnique({
      where: {
        Surat_id: numericId
      },
      // 'include' akan mengambil semua data dari model mahasiswa yang terhubung
      include: {
        mahasiswa: true 
      }
    });
  } catch (error) {
    throw error;
  }
},
};

module.exports = BebasAsrama;
