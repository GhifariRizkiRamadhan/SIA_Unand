// file: prisma/seeder/userSeed.js

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function main() {
  // Gunakan import() dinamis di dalam fungsi async
  const { v4: uuidv4 } = await import('uuid');

  const hashedPassword = bcrypt.hashSync('pengelola123', 10);
  const userId = uuidv4();

  // Lanjutkan dengan kode Prisma Anda
  await prisma.user.create({
    data: {
      user_id: userId,
      name: 'Admin Pengelola',
      email: 'pengelola@example.com',
      password: hashedPassword,
      role: 'pengelola',
    },
  });

  console.log('Seeding selesai! ✅');
}

const prisma = new PrismaClient();
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });