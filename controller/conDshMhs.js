require('dotenv').config();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const showDashboard = async (req, res) => {
  try {
    res.render("layouts/main", { 
        title: 'Dashboard',
        pageTitle: 'Dashboard',
        activeMenu: 'dashboard',
        user: {
            name: 'Erano',
            role: 'Mahasiswa',
            avatar: 'E'
        },
        activePage: "",
        error: null,
        success: null
    });
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ message: error });
  }
};

module.exports = {
    showDashboard
};