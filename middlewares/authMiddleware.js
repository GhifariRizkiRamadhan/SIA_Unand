const jwt = require('jsonwebtoken');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    
    if (!token) {
      return res.redirect('/login');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    req.user = {
      user_id: decoded.user_id,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.clearCookie('token');
    res.redirect('/login');
  }
};

// Middleware to check if user is already logged in
const redirectIfAuthenticated = (req, res, next) => {
  try {
    const token = req.cookies.token;
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Redirect based on role
      if (decoded.role === 'mahasiswa') {
        return res.redirect('/mahasiswa/dashboard');
      } else if (decoded.role === 'pengelola') {
        return res.redirect('/pengelola/dashboard');
      } else {
        return res.redirect('/dashboard');
      }
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