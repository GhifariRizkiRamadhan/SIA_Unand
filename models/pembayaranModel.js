const { prisma } = require('../config/database');

const Pembayaran = {
  // Create new pembayaran
  async create(data) {
    try {
      const pembayaran = await prisma.pembayaran.create({
        data: {
          user_id: data.user_id,
          amount: data.amount,
          bukti: data.bukti,
          status: data.status || 'pending',
          surat_id: data.surat_id
        }
      });
      return pembayaran;
    } catch (error) {
      throw error;
    }
  },
async findById(id) {
  try {
    const pembayaranId = parseInt(id, 10); // pastikan menjadi integer
    return await prisma.pembayaran.findUnique({
      where: { pembayaran_id: pembayaranId },
      include: {
            mahasiswa: true,
            suratbebasasrama: true
        }
    });
  } catch (error) {
    throw error;
  }
},


  async findAll() {
    try {
        return await prisma.pembayaran.findMany({
        include: {
            mahasiswa: true,
            suratbebasasrama: true
        }
        });
    } catch (error) {
        throw error;
    }
 },


  // Update status pembayaran (approve/reject)
  async updateStatus(id, status) {
    try {
      return await prisma.pembayaran.update({
        where: { pembayaran_id: id },
        data: { status }
      });
    } catch (error) {
      throw error;
    }
  }, 

async findByMahasiswaId(id) {
    try {
      // 1. Konversi ID dari string ke integer
      const numericId = parseInt(id, 10);

      // 2. Validasi jika ID bukan angka
      if (isNaN(numericId)) {
        throw new Error("ID Mahasiswa harus berupa angka yang valid.");
      }

      // 3. Cari data menggunakan ID yang sudah menjadi angka
      return await prisma.pembayaran.findMany({
        where: {
          mahasiswa_id: numericId
        },
        include: {
          suratbebasasrama: true 
        }
      });
    } catch (error) {
      throw error;
    }
  },

  async findByIdAndUpdate(id, dataToUpdate) {
    try {
      // Konversi ID ke integer, karena ID dari parameter bisa berupa string
      const numericId = parseInt(id, 10);
      if (isNaN(numericId)) {
        throw new Error("ID pembayaran harus berupa angka yang valid.");
      }

      // Gunakan prisma.pembayaran.update untuk mengubah data
      return await prisma.pembayaran.update({
        where: {
          pembayaran_id: numericId // Pastikan 'pembayaran_id' adalah nama primary key di skema Anda
        },
        data: dataToUpdate // 'dataToUpdate' adalah objek berisi field yang ingin diubah
      });
    } catch (error) {
      throw error;
    }
  },
  async findByIdWithSurat(id) {
  try {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) return null;

    return await prisma.pembayaran.findUnique({
      where: { pembayaran_id: numericId },
      include: {
        suratbebasasrama: true // <-- Ini akan mengambil data surat terkait
      }
    });
  } catch (error) {
    throw error;
  }
}
};


module.exports = Pembayaran;
