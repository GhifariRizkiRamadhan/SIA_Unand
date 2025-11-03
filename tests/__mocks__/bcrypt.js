// Mock prisma client (supaya tidak benar-benar query DB)
module.exports = {
   hash: jest.fn().mockResolvedValue('hashedPassword'),
  compare: jest.fn((plain, hashed) => plain === '1234'), // return true kalau password = '1234'
};
