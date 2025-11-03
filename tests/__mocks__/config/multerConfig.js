// tests/__mocks__/config/multerConfig.js
module.exports = {
  uploadMahasiswaFoto: {
    single: () => (req, res, next) => {
      // Simulasikan file agar req.file selalu ada
      req.file = { filename: 'dummy.png', path: 'public/image/mahasiswa/dummy.png' };
      next();
    },
  },
};