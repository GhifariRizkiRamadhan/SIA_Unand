// file: prisma/seeder/pembayaranSeed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.pembayaran.createMany({
    data: [
      {
        amount: 1500000.00,
        payment_date: new Date("2025-01-15"),
        bukti_pembayaran: "uploads/bukti/bukti1.png",
        status_bukti: "VALID",
        mahasiswa_id: 1, // pastikan mahasiswa_id=1 ada di tabel mahasiswa
        surat_id: 3      // pastikan surat_id=1 ada di tabel suratbebasasrama
      },
      {
        amount: 2000000.00,
        payment_date: new Date("2025-02-10"),
        bukti_pembayaran: null,
        status_bukti: "BELUM_DIVERIFIKASI",
        mahasiswa_id: 2,
        surat_id: 4
      }
    ]
  });

  console.log("✅ Seeder pembayaran selesai");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
