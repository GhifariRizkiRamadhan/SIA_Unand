const { prisma } = require('../config/database');

const BebasAsrama = {

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
        pembayaran: true,
        kerusakanFasilitas: true
      }
    });

    // DEBUG LOG
    // console.log(`[DEBUG] Pembayaran untuk surat ${numericId}:`, result?.pembayaran);
    
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
        pembayaran: true,
        kerusakanFasilitas: true
    
      },
  
      orderBy: {
        tanggal_pengajuan: 'desc'
      }
    });
  } catch (error) {
    throw error;
  }
},

async updateStatus(id, status_pengajuan) {
  try {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      throw new Error("ID harus berupa angka yang valid.");
    }


    return await prisma.suratbebasasrama.update({
      where: { Surat_id: numericId },
      data: { status_pengajuan }
    });
  } catch (error) {
    throw error;
  }
},

  async findByIdAndDelete(id) {
    try {
  
      const numericId = parseInt(id, 10);
      if (isNaN(numericId)) {
        throw new Error("ID pengajuan harus berupa angka yang valid.");
      }

      return await prisma.suratbebasasrama.delete({
        where: {
          Surat_id: numericId 
        }
      });
    } catch (error) {
  
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
        data: dataToUpdate 
      });


      return updatedData;

    } catch (error) {
      throw error;
    }
  },

async findByIdWithMahasiswa(id) {
  try {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      throw new Error("ID harus berupa angka yang valid.");
    }

    return await prisma.suratbebasasrama.findUnique({
      where: {
        Surat_id: numericId
      },
      include: {
        mahasiswa: true 
      }
    });
  } catch (error) {
    throw error;
  }
},
async findByMahasiswaId(id) {
  try {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      throw new Error("ID Mahasiswa harus berupa angka.");
    }

    return await prisma.suratbebasasrama.findMany({
      where: {
        mahasiswa_id: numericId
      },

      orderBy: {
        tanggal_pengajuan: 'desc'
      }
    });
  } catch (error) {
    throw error;
  }
},
 async findByIdWithPembayaran(id) {
    try {
      const numericId = parseInt(id, 10);
      if (isNaN(numericId)) {
        throw new Error("ID harus berupa angka yang valid.");
      }
      
      return await prisma.suratbebasasrama.findUnique({
        where: { Surat_id: numericId },
        include: {
          pembayaran: true 
        }
      });
    } catch (error) {
      throw error;
    }
  },

async findActiveByMahasiswaId(mahasiswaId) {
    try {
        return await prisma.suratbebasasrama.findFirst({
            where: {
                mahasiswa_id: mahasiswaId,
                NOT: {
                    status_pengajuan: 'SELESAI' 
                }
            }
        });
    } catch (error) {
        throw error;
    }
}
};

module.exports = BebasAsrama;
