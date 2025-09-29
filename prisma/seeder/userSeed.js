// file: prisma/seeder/userSeed.js

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const { v4: uuidv4 } = await import('uuid');

  // Data user yang mau di-seed
  const users = [
    {
      name: 'Admin Pengelola',
      email: 'adminpengelola@example.com',
      password: 'pengelola123',
      role: 'pengelola',
    },
    {
      name: 'Mahasiswa A',
      email: 'mahasiswa@example.com',
      password: 'mahasiswa123',
      role: 'mahasiswa',
      nim: '20250001',
    },
  ];

  for (const u of users) {
    const hashedPassword = bcrypt.hashSync(u.password, 10);
    const userId = uuidv4();

    if (u.role === 'pengelola') {
      // create user + pengelolaasrama
      await prisma.user.create({
        data: {
          user_id: userId,
          name: u.name,
          email: u.email,
          password: hashedPassword,
          role: u.role,
          pengelolaasrama: {
            create: {}, // row kosong karena relasi hanya butuh user_id
          },
        },
      });
      console.log(`✅ User pengelola "${u.name}" berhasil ditambahkan`);
    } else if (u.role === 'mahasiswa') {
      // create user + mahasiswa
      await prisma.user.create({
        data: {
          user_id: userId,
          name: u.name,
          email: u.email,
          password: hashedPassword,
          role: u.role,
          mahasiswa: {
            create: {
              nim: u.nim,
              nama: u.name,
            },
          },
        },
      });
      console.log(`✅ User mahasiswa "${u.name}" berhasil ditambahkan`);
    } else {
      console.warn(`⚠️ Role "${u.role}" tidak dikenali, user "${u.name}" dilewati`);
    }
  }

  console.log('🌱 Seeding selesai!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
