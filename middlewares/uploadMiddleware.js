const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Pastikan folder uploads ada
const ensureDirectoryExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Storage & Filter Arsip
// =======================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/';
    ensureDirectoryExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Sanitize filename
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${sanitizedName}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /zip|rar|tar|7z/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only archives are allowed'));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
}).any();

// Storage & Filter Gambar
// =======================
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'public/uploads/pemberitahuan';
    ensureDirectoryExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename dengan extension yang benar
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const nameWithoutExt = path.parse(sanitizedName).name;
    
    cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
  }
});

const imageFilter = (req, file, cb) => {
  console.log('🖼️ File info:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    fieldname: file.fieldname
  });

  // Allowed MIME types
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp'
  ];

  // Allowed extensions
  const allowedExtensions = /\.(jpg|jpeg|png|gif|webp)$/i;

  const extname = allowedExtensions.test(file.originalname);
  const mimetype = allowedMimeTypes.includes(file.mimetype);

  if (extname && mimetype) {
    console.log('✅ File accepted:', file.originalname);
    return cb(null, true);
  } else {
    console.log('❌ File rejected:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      extname: extname,
      mimetypeValid: mimetype
    });
    cb(new Error('Only image files are allowed (JPG, JPEG, PNG, GIF, WebP)'));
  }
};

const uploadImage = multer({
  storage: imageStorage,
  fileFilter: imageFilter,
  limits: { 
    fileSize: 5 * 1024 * 1024, // max 5MB
    files: 1 // hanya 1 file
  }
}).single('image'); // field name = "image"

// Wrapper function untuk better error handling
const uploadImageWithErrorHandling = (req, res, next) => {
  uploadImage(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error('Multer Error:', err);
      
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File terlalu besar. Maksimal 5MB'
        });
      }
      
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          message: 'Hanya bisa upload 1 file'
        });
      }
      
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          message: 'Field file tidak valid. Gunakan field "image"'
        });
      }
      
      return res.status(400).json({
        success: false,
        message: 'Error upload: ' + err.message
      });
    } else if (err) {
      console.error('Upload Error:', err);
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    
    // Log successful upload
    if (req.file) {
      console.log('✅ File uploaded successfully:', {
        originalname: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        path: req.file.path
      });
    }
    
    next();
  });
};


// Storage & Filter Bukti Pembayaran
// =======================
const buktiStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/bukti';
    ensureDirectoryExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const nameWithoutExt = path.parse(sanitizedName).name;
    
    cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
  }
});

const buktiFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  const allowedExtensions = /\.(jpg|jpeg|png)$/i;

  const extname = allowedExtensions.test(file.originalname);
  const mimetype = allowedMimeTypes.includes(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only JPG and PNG images are allowed for bukti pembayaran'));
  }
};

const uploadBukti = multer({
  storage: buktiStorage,
  fileFilter: buktiFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // max 5MB
}).single('bukti'); // field name = "bukti"


module.exports = {
  upload,
  uploadImage: uploadImageWithErrorHandling,
  uploadBukti
};

// =======================
// IZIN KELUAR: Upload Dokumen Pendukung (PDF/DOC/DOCX)
// =======================
const izinStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'public/uploads/izin';
    ensureDirectoryExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const nameWithoutExt = path.parse(sanitizedName).name;
    cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
  }
});

const izinFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  const allowedExtensions = /\.(pdf|doc|docx)$/i;

  const extname = allowedExtensions.test(file.originalname);
  const mimetype = allowedMimeTypes.includes(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only PDF/DOC/DOCX files are allowed for izin document'));
  }
};

const uploadIzinDokumenSingle = multer({
  storage: izinStorage,
  fileFilter: izinFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 } // 10MB
}).single('document');

const uploadIzinDokumen = (req, res, next) => {
  uploadIzinDokumenSingle(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'File terlalu besar. Maksimal 10MB' });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ success: false, message: 'Field file tidak valid. Gunakan field "document"' });
      }
      return res.status(400).json({ success: false, message: 'Error upload: ' + err.message });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

// =======================
// PELAPORAN: Upload Foto Kerusakan (JPG/PNG)
// =======================
const pelaporanStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'public/uploads/pelaporan';
    ensureDirectoryExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const nameWithoutExt = path.parse(sanitizedName).name;
    cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
  }
});

const pelaporanFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  const allowedExtensions = /\.(jpg|jpeg|png)$/i;

  const extname = allowedExtensions.test(file.originalname);
  const mimetype = allowedMimeTypes.includes(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only JPG/PNG images are allowed for pelaporan'));
  }
};

const uploadFotoKerusakanSingle = multer({
  storage: pelaporanStorage,
  fileFilter: pelaporanFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 } // 5MB
}).single('photo');

const uploadFotoKerusakan = (req, res, next) => {
  uploadFotoKerusakanSingle(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'Ukuran foto terlalu besar. Maksimal 5MB' });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ success: false, message: 'Field file tidak valid. Gunakan field "photo"' });
      }
      return res.status(400).json({ success: false, message: 'Error upload: ' + err.message });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

// Tambahkan ke exports
module.exports.uploadIzinDokumen = uploadIzinDokumen;
module.exports.uploadFotoKerusakan = uploadFotoKerusakan;