// file: prisma/seeder/suratBebasAsramaSeed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.suratbebasasrama.createMany({
    data: [
      {
        nomor_pengajuan: "SB-001",
        tanggal_pengajuan: new Date("2025-03-01"),
        total_biaya: 1500000.00,
        status_pengajuan: "MENUNGGU_PEMBAYARAN",
        mahasiswa_id: 1,
        Pengelola_id: 1
      },
      {
        nomor_pengajuan: "SB-002",
        tanggal_pengajuan: new Date("2025-03-10"),
        total_biaya: 2000000.00,
        status_pengajuan: "VERIFIKASI_FASILITAS",
        mahasiswa_id: 2,
        Pengelola_id: null
      }
    ]
  });

  console.log("✅ Seeder surat bebas asrama selesai");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
