// Mock prisma client (supaya tidak benar-benar query DB)
module.exports = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
  mahasiswa: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  pengelolaasrama: {
    create: jest.fn(),
  },
};
