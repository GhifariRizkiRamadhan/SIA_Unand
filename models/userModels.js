const { prisma } = require('../config/database');
const bcrypt = require('bcrypt');

const User = {
  // Create new user
  async create(userData) {
    try {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      const user = await prisma.user.create({
        data: {
          user_id: userData.user_id,
          name: userData.name,
          email: userData.email,
          password: hashedPassword,
          role: userData.role
        }
      });

      // If user is mahasiswa, create mahasiswa record
      if (userData.role === 'mahasiswa') {
        await prisma.mahasiswa.create({
          data: {
            nim: userData.nim,
            nama: userData.name,
            user_id: userData.user_id,
            status: 'aktif'
          }
        });
      }

      // If user is pengelola, create pengelolaasrama record
      if (userData.role === 'pengelola') {
        await prisma.pengelolaasrama.create({
          data: {
            user_id: userData.user_id
          }
        });
      }

      return user;
    } catch (error) {
      throw error;
    }
  },

  // Find user by email
  async findByEmail(email) {
    try {
      const user = await prisma.user.findUnique({
        where: { email }
      });
      return user;
    } catch (error) {
      throw error;
    }
  },

  // Verify password
  async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  },

  // Check if email exists
  async emailExists(email) {
    try {
      const user = await prisma.user.findUnique({
        where: { email }
      });
      return !!user;
    } catch (error) {
      throw error;
    }
  },

  // Check if NIM exists (for mahasiswa)
  async nimExists(nim) {
    try {
      const mahasiswa = await prisma.mahasiswa.findUnique({
        where: { nim }
      });
      return !!mahasiswa;
    } catch (error) {
      throw error;
    }
  }
};

module.exports = User;