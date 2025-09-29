const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    
    const isApiRequest = req.accepts('json');

    if (!token) {
      if (isApiRequest) {
        return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
      }
      return res.redirect('/login');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    req.user = {
      user_id: decoded.user_id,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name
    };

    if (decoded.role === 'mahasiswa') {
      const mahasiswa = await prisma.mahasiswa.findFirst({
        where: { user_id: decoded.user_id },
        select: { mahasiswa_id: true } 
      });
      if (mahasiswa) {
        req.user.mahasiswa_id = mahasiswa.mahasiswa_id;
      }
    } 

    else if (decoded.role === 'pengelola') {
      const pengelola = await prisma.pengelolaasrama.findFirst({
        where: { user_id: decoded.user_id },
        select: { Pengelola_id: true } 
      });
      if (pengelola) {
        req.user.pengelola_id = pengelola.Pengelola_id;
      }
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.clearCookie('token');

    if (req.accepts('json')) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Invalid token' });
    }

    res.redirect('/login');
  }
};

// Middleware to check if user is already logged in
const redirectIfAuthenticated = (req, res, next) => {
  try {
    const token = req.cookies.token;
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      return redirectByRole(res, decoded);

    }
    
    next();
  } catch (error) {
    // Token is invalid, continue to login/register
    res.clearCookie('token');
    next();
  }
};

// Middleware untuk mengecek role pengelola
const requirePengelola = (req, res, next) => {
  if (!req.user) {
    return res.redirect('/login');
  }
  
  if (req.user.role !== 'pengelola') {
    return res.redirect('/mahasiswa/dashboard');
  }
  
  next();
};

// Middleware untuk mengecek role mahasiswa
const requireMahasiswa = (req, res, next) => {
  if (!req.user) {
    return res.redirect('/login');
  }
  
  if (req.user.role !== 'mahasiswa') {
    return res.redirect('/pengelola/dashboard');
  }
  
  next();
};


module.exports = {
  authMiddleware,
  redirectIfAuthenticated,
  requirePengelola,
  requireMahasiswa
};