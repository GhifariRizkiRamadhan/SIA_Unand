const { prisma } = require('../config/database');

const Pembayaran = {
  // Create new pembayaran
  async create(data) {
    try {
        return await prisma.pembayaran.create({
                data: {
                    amount: data.amount,
                    bukti_pembayaran: data.bukti_pembayaran,
                    status_bukti: 'BELUM_DIVERIFIKASI',
                    mahasiswa_id: data.mahasiswa_id,
                    surat_id: data.surat_id
                }
            });
    } catch (error) {
      throw error;
    }
  },
async findById(id) {
  try {
    const pembayaranId = parseInt(id, 10); 
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


  async updateStatus(id, status_bukti) {
        try {

            const numericId = parseInt(id, 10);
            if (isNaN(numericId)) throw new Error("ID harus berupa angka.");

            return await prisma.pembayaran.update({
                where: { pembayaran_id: numericId },
                data: { status_bukti } 
            });
        } catch (error) {
            throw error;
        }
    },

async findByMahasiswaId(id) {
    try {
      const numericId = parseInt(id, 10);

      if (isNaN(numericId)) {
        throw new Error("ID Mahasiswa harus berupa angka yang valid.");
      }


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
      const numericId = parseInt(id, 10);
      if (isNaN(numericId)) {
        throw new Error("ID pembayaran harus berupa angka yang valid.");
      }
      return await prisma.pembayaran.update({
        where: {
          pembayaran_id: numericId 
        },
        data: dataToUpdate 
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
        suratbebasasrama: true 
      }
    });
  } catch (error) {
    throw error;
  }
},
async updateStatusBySuratId(suratId, newStatus) {
    try {
        const numericSuratId = parseInt(suratId, 10);
        if (isNaN(numericSuratId)) {
            throw new Error("ID Surat harus berupa angka.");
        }

    
        return await prisma.pembayaran.updateMany({
            where: {
                surat_id: numericSuratId
            },
            data: {
                status_bukti: newStatus 
            }
        });
    } catch (error) {
        throw error;
    }
},

async resetPaymentStatusBySuratId(suratId) {
    try {
        const numericSuratId = parseInt(suratId, 10);
        if (isNaN(numericSuratId)) {
            throw new Error("ID Surat harus berupa angka.");
        }


        return await prisma.pembayaran.updateMany({
            where: {
                surat_id: numericSuratId
            },
            data: {
                status_bukti: 'TIDAK_VALID',
                bukti_pembayaran: null 
            }
        });
    } catch (error) {
        throw error;
    }
},
};


module.exports = Pembayaran;
