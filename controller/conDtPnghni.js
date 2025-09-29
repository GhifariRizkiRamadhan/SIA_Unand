require('dotenv').config();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const ejs = require('ejs');
const User = require('../models/userModels');
const path = require('path');

const showDtPenghuni = async (req, res) => {
  try {
    // Ambil user_id dari session atau JWT
    const userId = req.session?.user_id || req.user?.user_id;
    if (!userId) {
      return res.redirect('/login');
    }

    // Ambil data user dari database
    const user = await User.findById(userId);

    // Render isi bebasAsrama.ejs sebagai body
    const body = await ejs.renderFile(
      path.join(__dirname, '../views/pengelola/dataPenghuni.ejs'),
      { user }
    );

    res.render('layouts/main', {
      title: 'Data Penghuni',
      pageTitle: 'Data Penghuni',
      activeMenu: 'pengelola-data-penghuni',
      body,
      user: {
        name: user.name,
        role: user.role,
        avatar: user.avatar || user.name.charAt(0)
      },
      activePage: "",
      error: null,
      success: null
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { message: error.message });
  }
};

module.exports = {
  showDtPenghuni
};