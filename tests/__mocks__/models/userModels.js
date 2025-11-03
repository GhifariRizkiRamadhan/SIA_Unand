// Mock untuk models/userModels.js
const User = {
  create: jest.fn(async (userData) => ({
    user_id: userData.user_id || 'mahasiswa_123',
    name: userData.name,
    email: userData.email,
    role: userData.role || 'mahasiswa',
  })),

  findByEmail: jest.fn(async (email) => {
    if (email === 'found@mail.com') {
      return {
        user_id: '1',
        email,
        name: 'Found User',
        password: 'hashedPassword',
        role: 'mahasiswa',
      };
    }
    return null;
  }),

  findById: jest.fn(async (user_id) => {
    if (user_id === '1') {
      return { user_id: '1', name: 'Test User' };
    }
    return null;
  }),

  countAll: jest.fn(async () => 10),

  verifyPassword: jest.fn(async (plainPassword, hashedPassword) => {
    // Simulasikan bcrypt.compare
    return hashedPassword === `hashed-${plainPassword}` || hashedPassword === plainPassword;
  }),

  emailExists: jest.fn(async (email) => {
    // return true jika email === 'sudah@mail.com' biar test register relevan
    return email === 'sudah@mail.com';
  }),

  nimExists: jest.fn(async (nim) => {
    // return true jika NIM === '123' biar test NIM sudah terdaftar bisa lewat
    return nim === '123' && process.env.TEST_FORCE_NIM_EXISTS === 'true';
  }),
};

module.exports = User;