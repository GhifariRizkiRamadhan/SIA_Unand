// Mock bcrypt agar tidak hashing sungguhan
module.exports = {
  hash: jest.fn().mockResolvedValue('hashedPassword'),
  compare: jest.fn((plain, hashed) => plain === '1234'), // return true kalau password = '1234'
};
