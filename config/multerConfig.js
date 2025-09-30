const multer = require('multer');
const path = require('path');

// Storage untuk foto mahasiswa
const mahasiswaStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/image/mahasiswa')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'mahasiswa-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Hanya file gambar (JPG, JPEG, PNG) yang diperbolehkan!'));
  }
};

const uploadMahasiswaFoto = multer({ 
  storage: mahasiswaStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: fileFilter
});

module.exports = { uploadMahasiswaFoto };